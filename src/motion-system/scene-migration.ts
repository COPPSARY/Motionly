/**
 * Scene migration.
 *
 * Every project written before scenes existed is one long composition on a global
 * timeline. This module lifts such a project into a storyboard without touching a
 * single animation, so opening an old project and pressing "Organize into scenes"
 * is a safe, reviewable, reversible edit rather than a rewrite.
 *
 * Three strategies, one entry point:
 *
 * - `beats`   — the project already storyboards with `beat` blocks. Each beat
 *               becomes a scene of the same name, length, label, and framing, and
 *               everything attached with `beat NAME` becomes `scene NAME`. This is
 *               the highest-fidelity path because the story structure is explicit.
 * - `segment` — no beats, but the entrance times cluster. Splitting where the
 *               composition goes quiet recovers the story structure that was
 *               implied by the timing all along.
 * - `single`  — wrap the whole project in one scene. Always correct, never clever.
 *
 * `auto` picks beats, then segment, then single.
 *
 * The output is an AST, so the caller serializes it with the normal serializer and
 * the user sees an ordinary `.motion` diff.
 */

import { parseTime } from '../core/units';
import { parsePresetCall } from '../animation-library/preset-parser';
import type { ASTNode, ElementNode, ProgramNode } from '../types/parser';
import { MIN_SCENE_DURATION } from './scenes';

export type MigrationStrategy = 'auto' | 'beats' | 'segment' | 'single';

export interface MigrationOptions {
  strategy?: MigrationStrategy;
  /** Quiet gap, in seconds, that ends a segment. */
  gap?: number;
  /** Name given to the single scene produced by the `single` strategy. */
  name?: string;
  /**
   * Explicit scene start times, in seconds. Supplying these turns segmentation
   * from a guess into an instruction — the author already knows where the story
   * turns, and a heuristic will always find extra splits inside a staggered
   * cascade. Also what the editor's "split scene here" uses.
   */
  boundaries?: readonly number[];
  /** Scene names, positionally matched to `boundaries`. */
  names?: readonly string[];
  /** Scene labels, positionally matched to `boundaries`. */
  labels?: readonly string[];
}

export interface SceneMigration {
  program: ProgramNode;
  /** The strategy that actually ran. `none` means the project was already a storyboard. */
  strategy: MigrationStrategy | 'none';
  /** Names of the scenes the migration created, in order. */
  scenes: string[];
  /** One line per decision, for the editor to show before the user accepts. */
  notes: string[];
}

/** Kinds that are never storyboard members. */
const NON_MEMBER_KINDS = new Set(['scene', 'theme', 'beat', 'transition']);

const DEFAULT_GAP = 1.4;

/**
 * Lift a legacy project into a storyboard.
 *
 * Returns the project unchanged when it already declares scene membership — the
 * migration is idempotent, so running it twice is harmless.
 */
export function migrateToScenes(
  program: ProgramNode,
  options: MigrationOptions = {}
): SceneMigration {
  if (alreadyStoryboarded(program)) {
    return {
      program,
      strategy: 'none',
      scenes: storyboardNames(program),
      notes: ['Project is already organized into scenes.'],
    };
  }

  const beats = elementsOfKind(program, 'beat');
  const requested = options.strategy ?? 'auto';
  const strategy: Exclude<MigrationStrategy, 'auto'> =
    requested !== 'auto'
      ? requested
      : options.boundaries?.length
        ? 'segment'
        : beats.length
          ? 'beats'
          : segmentBoundaries(program, options.gap ?? DEFAULT_GAP).length > 1
            ? 'segment'
            : 'single';

  if (strategy === 'beats') return migrateFromBeats(program, beats);
  if (strategy === 'segment') return migrateBySegment(program, options);
  return migrateToSingleScene(program, options.name ?? 'main');
}

/**
 * Rebase members into scene-local time.
 *
 * A scene evaluates its children in parent-local time, so an object moved into a
 * scene that starts at 6s would have its 6s entrance pushed out to 12s. Migration
 * is a reorganization, not a retiming: every member's own `start`, `delay`, and the
 * delay of every animation targeting it shift back by its scene's start.
 *
 * Mutates `body` in place — it is already a fresh array owned by the caller.
 */
function rebaseIntoScenes(body: ASTNode[], offsets: ReadonlyMap<string, number>): void {
  const shiftByTarget = new Map<string, number>();

  for (const [index, node] of body.entries()) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    const scene = String(node.properties['scene'] ?? '');
    const offset = offsets.get(scene) ?? 0;
    if (!scene || offset <= 0) continue;
    shiftByTarget.set(node.name, offset);

    const properties = { ...node.properties };
    for (const key of ['start', 'delay', 'clickAt', 'exitAt'] as const) {
      if (properties[key] === undefined) continue;
      properties[key] = `${round(Math.max(0, timeValue(properties[key], 0) - offset))}s`;
    }
    // Most real projects carry their timing inside a preset call, not an `animate`
    // block. Shifting only the block would leave the preset firing at double time.
    for (const key of ['animation', 'textAnimation', 'cameraAnimation'] as const) {
      if (properties[key] === undefined) continue;
      properties[key] = shiftPresetDelay(String(properties[key]), offset);
    }
    body[index] = { ...node, properties };
  }

  for (const [index, node] of body.entries()) {
    if (node.type !== 'Animation') continue;
    const offset = shiftByTarget.get(node.target);
    if (!offset) continue;
    body[index] = {
      ...node,
      delay: `${round(Math.max(0, timeValue(node.delay, 0) - offset))}s`,
    };
  }
}

/**
 * Shift the `delay` argument of a preset call, leaving every other argument — and
 * the original spelling of the call — untouched.
 */
function shiftPresetDelay(value: string, offset: number): string {
  return value.replace(/(\bdelay\s+)([^\s,)]+)/g, (_match, prefix: string, raw: string) => {
    const parsed = timeValue(raw, Number.NaN);
    if (!Number.isFinite(parsed)) return `${prefix}${raw}`;
    return `${prefix}${round(Math.max(0, parsed - offset))}s`;
  });
}

/** Absolute start per scene, resolved the way the storyboard planner resolves it. */
function sceneOffsets(
  scenes: ReadonlyArray<{ name: string; start?: number; duration?: number }>,
  canvasTotal: number
): Map<string, number> {
  const explicit = scenes.reduce((total, scene) => total + (scene.duration ?? 0), 0);
  const unsized = scenes.filter((scene) => scene.duration === undefined).length;
  const share = unsized
    ? Math.max(MIN_SCENE_DURATION, Math.max(0, canvasTotal - explicit) / unsized)
    : 0;

  const offsets = new Map<string, number>();
  let cursor = 0;
  for (const scene of scenes) {
    const start = scene.start ?? cursor;
    offsets.set(scene.name, round(start));
    cursor = start + Math.max(MIN_SCENE_DURATION, scene.duration ?? share);
  }
  return offsets;
}

/**
 * Beats already are the story structure, so this is a rename with promotion: the
 * beat's window, label, and framing move onto a scene block and its attachments
 * become members.
 */
function migrateFromBeats(program: ProgramNode, beats: readonly ElementNode[]): SceneMigration {
  const names = beats.map((beat) => beat.name);
  const known = new Set(names);
  const body: ASTNode[] = [];
  const notes: string[] = [];

  for (const node of program.body) {
    if (node.type === 'Element' && node.kind === 'beat') {
      body.push(sceneBlock(node.name, beatToSceneProperties(node)));
      continue;
    }
    if (node.type !== 'Element') {
      body.push(node);
      continue;
    }
    const beat = String(node.properties['beat'] ?? '');
    if (!beat || !known.has(beat) || NON_MEMBER_KINDS.has(node.kind)) {
      body.push(node);
      continue;
    }
    const properties = { ...node.properties };
    delete properties['beat'];
    properties['scene'] = beat;
    body.push({ ...node, properties });
  }

  // An object that belonged to no beat has no scene to live in. Rather than guess,
  // put it in the first scene and say so.
  const adopted = adoptOrphans(body, names[0]);
  if (adopted.length) {
    notes.push(
      `Moved ${adopted.length} unattached object${adopted.length === 1 ? '' : 's'} into "${names[0]}": ${adopted.join(', ')}.`
    );
  }
  notes.unshift(`Promoted ${names.length} beat${names.length === 1 ? '' : 's'} to scenes.`);

  rebaseIntoScenes(
    body,
    sceneOffsets(
      beats.map((beat) => ({
        name: beat.name,
        ...(beat.properties['start'] !== undefined
          ? { start: timeValue(beat.properties['start'], 0) }
          : {}),
        ...(beat.properties['duration'] !== undefined
          ? { duration: timeValue(beat.properties['duration'], 0) }
          : {}),
      })),
      canvasDuration(program)
    )
  );

  return { program: { ...program, body }, strategy: 'beats', scenes: names, notes };
}

/**
 * Recover story structure from timing. Entrances cluster because the author (or
 * the AI) already thought in shots; a quiet gap is where one shot ended.
 */
function migrateBySegment(program: ProgramNode, options: MigrationOptions): SceneMigration {
  const gap = options.gap ?? DEFAULT_GAP;
  const explicit = options.boundaries?.length ? [...options.boundaries] : null;
  const boundaries = (explicit ?? segmentBoundaries(program, gap))
    .map((value) => round(value))
    .sort((left, right) => left - right);
  if (boundaries.length <= 1 && !explicit) return migrateToSingleScene(program, 'main');

  const total = canvasDuration(program);
  const taken = new Set(elementNames(program));
  const scenes = boundaries.map((start, index) => {
    const name = uniqueName(options.names?.[index] ?? `scene${index + 1}`, taken);
    taken.add(name);
    return {
      name,
      label: options.labels?.[index] ?? titleCase(options.names?.[index] ?? `Scene ${index + 1}`),
      start,
      end: boundaries[index + 1] ?? total,
    };
  });

  const body: ASTNode[] = [];
  const sceneBlocks = scenes.map((scene) =>
    sceneBlock(scene.name, {
      duration: `${round(Math.max(MIN_SCENE_DURATION, scene.end - scene.start))}s`,
      label: scene.label,
    })
  );

  let inserted = false;
  for (const node of program.body) {
    if (!inserted && node.type === 'Element' && !NON_MEMBER_KINDS.has(node.kind)) {
      body.push(...sceneBlocks);
      inserted = true;
    }
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind) || node.properties['parent']) {
      body.push(node);
      continue;
    }
    const at = entranceTime(program, node);
    const owner = [...scenes].reverse().find((scene) => at >= scene.start - 1e-6) ?? scenes[0]!;
    body.push({ ...node, properties: { ...node.properties, scene: owner.name } });
  }
  if (!inserted) body.push(...sceneBlocks);

  rebaseIntoScenes(body, new Map(scenes.map((scene) => [scene.name, round(scene.start)])));

  return {
    program: { ...program, body },
    strategy: 'segment',
    scenes: scenes.map((scene) => scene.name),
    notes: explicit
      ? [`Split the timeline into ${scenes.length} scenes at the boundaries you supplied.`]
      : [
          `Split the timeline into ${scenes.length} scenes at gaps longer than ${gap}s.`,
          'Review the boundaries: they came from timing, not from intent.',
        ],
  };
}

/** The always-correct fallback: one scene holding everything. */
function migrateToSingleScene(program: ProgramNode, name: string): SceneMigration {
  const unique = uniqueName(name, new Set(elementNames(program)));
  const body: ASTNode[] = [];
  let inserted = false;

  for (const node of program.body) {
    if (!inserted && node.type === 'Element' && !NON_MEMBER_KINDS.has(node.kind)) {
      body.push(
        sceneBlock(unique, { duration: `${round(canvasDuration(program))}s`, label: 'Main' })
      );
      inserted = true;
    }
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind) || node.properties['parent']) {
      body.push(node);
      continue;
    }
    body.push({ ...node, properties: { ...node.properties, scene: unique } });
  }
  if (!inserted) {
    body.push(
      sceneBlock(unique, { duration: `${round(canvasDuration(program))}s`, label: 'Main' })
    );
  }

  return {
    program: { ...program, body },
    strategy: 'single',
    scenes: [unique],
    notes: [
      `Wrapped the project in one scene "${unique}".`,
      'Split it where the story changes, then give recurring components a shared identity.',
    ],
  };
}

/**
 * Entrance times, deduplicated and sorted, split wherever the composition goes
 * quiet for longer than `gap`.
 */
export function segmentBoundaries(program: ProgramNode, gap = DEFAULT_GAP): number[] {
  const times = new Set<number>();
  for (const node of program.body) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    if (node.properties['parent']) continue;
    times.add(round(entranceTime(program, node)));
  }
  const sorted = [...times].sort((left, right) => left - right);
  if (!sorted.length) return [];

  const boundaries = [0];
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! - sorted[index - 1]! > gap) boundaries.push(sorted[index]!);
  }
  return boundaries;
}

/**
 * When a component recurs across scenes, give it one persistent identity so the
 * storyboard recognizes the handoff instead of destroying and rebuilding it.
 * Matches on the shared prefix of ids like `logo`, `logoSmall`, `logo_2`.
 */
export function suggestIdentities(program: ProgramNode): Map<string, string> {
  const bySceneMember = new Map<string, string[]>();
  for (const node of program.body) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    const scene = String(node.properties['scene'] ?? '');
    if (!scene) continue;
    const stem = identityStem(node.name);
    const members = bySceneMember.get(stem) ?? [];
    members.push(node.name);
    bySceneMember.set(stem, members);
  }

  const identities = new Map<string, string>();
  for (const [stem, members] of bySceneMember) {
    if (members.length < 2) continue;
    for (const member of members) identities.set(member, stem);
  }
  return identities;
}

function identityStem(name: string): string {
  return (
    name
      .replace(/[_-]?\d+$/, '')
      .replace(/(Small|Large|Big|Mini|Alt|Copy|Wide|Tall)$/, '')
      .trim() || name
  );
}

function beatToSceneProperties(node: ElementNode): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  if (node.properties['start'] !== undefined) properties['start'] = node.properties['start'];
  if (node.properties['duration'] !== undefined)
    properties['duration'] = node.properties['duration'];
  properties['label'] = String(node.properties['label'] ?? node.name);
  if (node.properties['zoom'] !== undefined) properties['zoom'] = node.properties['zoom'];
  if (node.properties['cameraX'] !== undefined) properties['cameraX'] = node.properties['cameraX'];
  if (node.properties['cameraY'] !== undefined) properties['cameraY'] = node.properties['cameraY'];
  return properties;
}

function sceneBlock(name: string, properties: Record<string, unknown>): ElementNode {
  return { type: 'Element', kind: 'scene', name, properties };
}

function adoptOrphans(body: ASTNode[], sceneName: string | undefined): string[] {
  if (!sceneName) return [];
  const adopted: string[] = [];
  for (const [index, node] of body.entries()) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    if (node.properties['scene'] || node.properties['parent']) continue;
    body[index] = { ...node, properties: { ...node.properties, scene: sceneName } };
    adopted.push(node.name);
  }
  return adopted;
}

function alreadyStoryboarded(program: ProgramNode): boolean {
  return program.body.some(
    (node) =>
      node.type === 'Element' &&
      !NON_MEMBER_KINDS.has(node.kind) &&
      Boolean(String(node.properties['scene'] ?? ''))
  );
}

function storyboardNames(program: ProgramNode): string[] {
  return elementsOfKind(program, 'scene')
    .filter((node) => !node.properties['parent'])
    .map((node) => node.name);
}

/**
 * When an element first matters.
 *
 * Three places carry that answer, and a real project uses all of them: the
 * element's own window, the delay inside its animation preset call, and the delay
 * of any `animate` block targeting it. Reading only the last one is why an
 * ordinary preset-driven project used to look like a single flat scene.
 */
function entranceTime(program: ProgramNode, node: ElementNode): number {
  const candidates: number[] = [];

  const own = timeValue(node.properties['start'], Number.NaN);
  if (Number.isFinite(own)) candidates.push(own);

  for (const key of ['animation', 'textAnimation', 'cameraAnimation'] as const) {
    const value = node.properties[key];
    if (value === undefined) continue;
    const delay = parsePresetCall(value).options['delay'];
    if (delay === undefined) continue;
    const parsed = timeValue(delay, Number.NaN);
    if (Number.isFinite(parsed)) candidates.push(parsed);
  }

  const declaredDelay = timeValue(node.properties['delay'], Number.NaN);
  if (Number.isFinite(declaredDelay)) candidates.push(declaredDelay);

  for (const candidate of program.body) {
    if (candidate.type !== 'Animation' || candidate.target !== node.name) continue;
    const parsed = timeValue(candidate.delay, Number.NaN);
    if (Number.isFinite(parsed)) candidates.push(parsed);
  }

  return candidates.length ? Math.min(...candidates) : 0;
}

function elementsOfKind(program: ProgramNode, kind: string): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode => node.type === 'Element' && node.kind === kind
  );
}

function elementNames(program: ProgramNode): string[] {
  return program.body.flatMap((node) =>
    node.type === 'Element' || node.type === 'Import' ? [node.name] : []
  );
}

function uniqueName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

function canvasDuration(program: ProgramNode): number {
  const canvas = program.body.find((node) => node.type === 'Canvas');
  if (!canvas || !('properties' in canvas)) return 10;
  return timeValue(canvas.properties['duration'], 10);
}

function timeValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  const parsed = parseTime(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function titleCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}
