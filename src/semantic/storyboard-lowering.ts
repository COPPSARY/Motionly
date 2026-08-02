/**
 * Storyboard lowering.
 *
 * Turns a project written as a storyboard — an ordered list of `scene` blocks
 * plus objects that declare which scene they belong to — into ordinary AST the
 * rest of the pipeline already understands.
 *
 *   scene intro { duration 5s background #05060a label "Intro" }
 *   text title  { scene intro  value "Motionly" ... }
 *
 * becomes a `scene` element with resolved absolute timing plus a `text` element
 * parented to it. The engine's `scene` kind already owns a background, a
 * per-scene camera with depth parallax, an enter/exit envelope, and evaluates its
 * children in **parent-local time** — so scene-relative authoring costs the
 * evaluator and renderer nothing.
 *
 * The pass is opt-in and additive. It only engages for a project that actually
 * declares a storyboard (see `usesStoryboard`), which means every project written
 * before scenes existed compiles exactly as it did before.
 *
 * It runs before motion-system lowering so that layouts, showcases, and
 * components attached to a scene already carry their `parent` when those passes
 * resolve slots and pacing.
 */

import { parseTime } from '../core/units';
import type { ASTNode, ElementNode, ProgramNode } from '../types/parser';
import {
  isSceneTransitionKind,
  lowerSceneRoots,
  lowerSceneTransitions,
  planScenes,
  storyboardDuration,
  type SceneMember,
  type ScenePlan,
  type SceneSpec,
  type SceneTransitionKind,
} from '../motion-system/scenes';
import type { CameraFraming } from '../motion-system/beats';

export interface StoryboardLowering {
  program: ProgramNode;
  storyboard: ScenePlan[];
}

/** Kinds that never take part in a storyboard as members. */
const NON_MEMBER_KINDS = new Set(['scene', 'theme', 'beat', 'transition']);

/** Kinds whose own compiler builds an entrance, so a boundary must not add one. */
const SELF_ANIMATED_KINDS = new Set(['component', 'showcase', 'archetype', 'layout']);

/** Properties a scene block owns for the storyboard and that must not leak downstream. */
const STORYBOARD_SCENE_PROPERTIES = new Set([
  'transition',
  'transitionDuration',
  'easing',
  'zoom',
  'label',
]);

/**
 * Whether this project is organized as a storyboard.
 *
 * The signal is explicit membership (`scene NAME` on an object) or a scene block
 * that carries storyboard intent (`label`, `transition`). Anything else is a
 * legacy project whose top-level `scene` elements are hand-timed containers, and
 * it is left completely alone.
 */
export function usesStoryboard(program: ProgramNode): boolean {
  for (const node of program.body) {
    if (node.type !== 'Element') continue;
    if (node.kind === 'scene' && !node.properties['parent']) {
      if (node.properties['label'] !== undefined) return true;
      if (node.properties['transition'] !== undefined) return true;
      continue;
    }
    if (NON_MEMBER_KINDS.has(node.kind)) continue;
    if (String(node.properties['scene'] ?? '')) return true;
  }
  return false;
}

/** The storyboard's scene blocks, in authored order. */
export function storyboardScenes(program: ProgramNode): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode =>
      node.type === 'Element' && node.kind === 'scene' && !node.properties['parent']
  );
}

export function lowerStoryboard(program: ProgramNode): StoryboardLowering {
  if (!usesStoryboard(program)) return { program, storyboard: [] };

  const sceneNodes = storyboardScenes(program);
  if (!sceneNodes.length) {
    const orphan = memberEntries(program)[0];
    throw new Error(
      `"${orphan?.node.name ?? 'An object'}" declares scene "${orphan?.scene ?? ''}" but the project has no scene blocks.`
    );
  }

  const sceneNames = new Set(sceneNodes.map((node) => node.name));
  const animated = animatedTargets(program);
  const membersByScene = new Map<string, SceneMember[]>();

  for (const entry of memberEntries(program)) {
    if (!sceneNames.has(entry.scene)) {
      throw new Error(
        `Object "${entry.node.name}" references missing scene "${entry.scene}". Declare it with: scene ${entry.scene} { duration 4s }`
      );
    }
    const members = membersByScene.get(entry.scene) ?? [];
    const identity = String(entry.node.properties['identity'] ?? '');
    members.push({
      id: entry.node.name,
      ...(identity ? { identity } : {}),
      ...(isAnimated(entry.node, animated) ? { animated: true } : {}),
    });
    membersByScene.set(entry.scene, members);
  }

  const camera = resolveCameraFraming(program);
  const options = { canvasDuration: canvasDuration(program), camera };
  const storyboard = planScenes(
    sceneNodes.map((node) => sceneSpec(node, membersByScene.get(node.name) ?? [])),
    options
  );

  const roots = new Map(
    lowerSceneRoots(storyboard, new Map(sceneNodes.map((n) => [n.name, n]))).map((node) => [
      node.name,
      node,
    ])
  );

  const body: ASTNode[] = [];
  for (const node of program.body) {
    if (node.type === 'Canvas') {
      body.push(withStoryboardDuration(node, storyboard));
      continue;
    }
    if (node.type !== 'Element') {
      body.push(node);
      continue;
    }
    if (node.kind === 'scene' && roots.has(node.name)) {
      body.push(roots.get(node.name)!);
      continue;
    }
    body.push(attachMember(node));
  }
  body.push(...lowerSceneTransitions(storyboard));

  return { program: { ...program, body }, storyboard };
}

/**
 * Strip the membership sugar and parent the object to its scene.
 *
 * An object that already declares a `parent` (a layout slot, a group, a showcase
 * part) keeps it — the scene is then its ancestor, not its direct parent, and the
 * evaluator's parent-local time still resolves through the chain.
 */
function attachMember(node: ElementNode): ElementNode {
  const scene = String(node.properties['scene'] ?? '');
  const identity = node.properties['identity'];
  if (!scene && identity === undefined) return node;
  const properties = { ...node.properties };
  delete properties['scene'];
  delete properties['identity'];
  if (scene && !properties['parent']) properties['parent'] = scene;
  return { ...node, properties };
}

function memberEntries(program: ProgramNode): Array<{ node: ElementNode; scene: string }> {
  const entries: Array<{ node: ElementNode; scene: string }> = [];
  for (const node of program.body) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    const scene = String(node.properties['scene'] ?? '');
    if (scene) entries.push({ node, scene });
  }
  return entries;
}

function sceneSpec(node: ElementNode, members: readonly SceneMember[]): SceneSpec {
  const transition = String(node.properties['transition'] ?? '');
  if (transition && !isSceneTransitionKind(transition)) {
    throw new Error(
      `Scene "${node.name}" has unsupported transition "${transition}". Available: sharedElement, cameraMove, continuous, cut. Scene boundaries never fade.`
    );
  }
  return {
    name: node.name,
    members: members.map((member) => ({ ...member })),
    ...(node.properties['start'] !== undefined
      ? { start: timeValue(node.properties['start'], 0) }
      : {}),
    ...(node.properties['duration'] !== undefined
      ? { duration: timeValue(node.properties['duration'], 0) }
      : {}),
    ...(node.properties['label'] !== undefined ? { label: String(node.properties['label']) } : {}),
    ...(node.properties['background'] !== undefined
      ? { background: String(node.properties['background']) }
      : {}),
    ...(node.properties['cameraX'] !== undefined
      ? { cameraX: numberValue(node.properties['cameraX'], 0) }
      : {}),
    ...(node.properties['cameraY'] !== undefined
      ? { cameraY: numberValue(node.properties['cameraY'], 0) }
      : {}),
    ...(node.properties['zoom'] !== undefined
      ? { zoom: numberValue(node.properties['zoom'], 1) }
      : node.properties['cameraZoom'] !== undefined
        ? { zoom: numberValue(node.properties['cameraZoom'], 1) }
        : {}),
    ...(transition ? { transition: transition as SceneTransitionKind } : {}),
    ...(node.properties['transitionDuration'] !== undefined
      ? { transitionDuration: timeValue(node.properties['transitionDuration'], 0.8) }
      : {}),
    ...(node.properties['easing'] !== undefined
      ? { easing: String(node.properties['easing']) }
      : {}),
  };
}

/**
 * The storyboard is authoritative for project length: a canvas shorter than the
 * scenes it holds would clip the last scene, which is never what the author meant.
 */
function withStoryboardDuration(
  node: Extract<ASTNode, { type: 'Canvas' }>,
  storyboard: readonly ScenePlan[]
): ASTNode {
  const total = storyboardDuration(storyboard);
  const declared = timeValue(node.properties['duration'], 10);
  if (total <= declared) return node;
  return { ...node, properties: { ...node.properties, duration: `${total}s` } };
}

function animatedTargets(program: ProgramNode): Set<string> {
  const targets = new Set<string>();
  for (const node of program.body) {
    if (node.type === 'Animation') targets.add(node.target);
  }
  return targets;
}

function isAnimated(node: ElementNode, targets: ReadonlySet<string>): boolean {
  if (targets.has(node.name)) return true;
  if (SELF_ANIMATED_KINDS.has(node.kind)) return true;
  return (
    node.properties['animation'] !== undefined || node.properties['textAnimation'] !== undefined
  );
}

function canvasDuration(program: ProgramNode): number {
  const canvas = program.body.find((node) => node.type === 'Canvas');
  if (!canvas || !('properties' in canvas)) return 10;
  return timeValue(canvas.properties['duration'], 10);
}

function resolveCameraFraming(program: ProgramNode): CameraFraming {
  const camera = program.body.find((node) => node.type === 'Camera');
  const properties = camera && 'properties' in camera ? camera.properties : {};
  return {
    x: numberValue(properties['x'], 0),
    y: numberValue(properties['y'], 0),
    zoom: numberValue(properties['zoom'], 1),
  };
}

function timeValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  const parsed = parseTime(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Names of the scene-block properties that exist only for the storyboard. */
export function storyboardOnlyProperties(): ReadonlySet<string> {
  return STORYBOARD_SCENE_PROPERTIES;
}
