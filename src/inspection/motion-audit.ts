/**
 * Motion quality audit.
 *
 * The project inspector proves a project is *valid* — finite numbers, stable
 * round trip, no empty frames. This audits whether it is *good*: the failures
 * that make generated motion look machine-made rather than designed.
 *
 * Every check is a pure function of the evaluated scene, so the audit runs
 * headlessly with no browser and no renderer. Findings are advisory by default;
 * `severity: 'error'` marks the ones that are almost always real bugs.
 */

import { evaluateScene } from '../animation/evaluator';
import { ARRIVAL } from '../motion-system/layout';
import { MOTION_BUDGET } from '../motion-system/budget';
import type { Animation, Scene } from '../types/scene';

export const MOTION_FINDING_KINDS = [
  /** Two unrelated elements sit on top of each other. */
  'collision',
  /** A visible element is entirely outside the canvas. */
  'offscreen',
  /** A visible element has no width or height. */
  'degenerate',
  /** A stretch of time where nothing meaningful is in flight. */
  'dead-zone',
  /** One entrance is slower than the single-entry budget. */
  'entry-over-budget',
  /** A move is so slow it reads as drift. */
  'paced-slow',
  /** A move is too fast to register. */
  'paced-fast',
  /** A group cascade spreads past one beat. */
  'stagger-window',
  /** A group cascade has arbitrary gaps instead of an accelerating wave. */
  'uneven-stagger',
] as const;

export type MotionFindingKind = (typeof MOTION_FINDING_KINDS)[number];

export interface MotionFinding {
  kind: MotionFindingKind;
  severity: 'error' | 'warn';
  /** Element or animation target, when the finding is about one thing. */
  target?: string;
  /** Time in seconds the finding was observed, when time-specific. */
  at?: number;
  detail: string;
}

export interface MotionAudit {
  ok: boolean;
  findings: MotionFinding[];
  counts: Record<string, number>;
}

/** Budget constants live in the motion system so every consumer shares them. */
export { MOTION_BUDGET } from '../motion-system/budget';

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Audit a built scene for motion-quality problems. */
export function auditScene(scene: Scene): MotionAudit {
  // Ambient background and effect layers run long on purpose; they are
  // atmosphere, not moves, so pacing and cascade rules do not apply to them.
  const ambient = new Set(
    scene.elements
      .filter((element) => {
        const layer = String(element.properties.layer ?? 'content');
        return element.kind === 'effect' || layer === 'background' || layer === 'effects';
      })
      .map((element) => element.id)
  );
  const authored = scene.animations.filter(
    (animation) => !ambient.has(animation.target) && !ambient.has(rootOf(animation.target))
  );
  const findings: MotionFinding[] = [
    ...auditPacing(authored),
    ...auditCascades(authored),
    ...auditCoverage(scene),
    ...auditGeometry(scene),
  ];
  const counts: Record<string, number> = {};
  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  return {
    ok: findings.every((finding) => finding.severity !== 'error'),
    findings,
    counts,
  };
}

function rootOf(target: string): string {
  return target.includes('__') ? target.split('__')[0]! : target;
}

/** Is this animation an entrance? Entrances start below full opacity. */
function isEntrance(animation: Animation): boolean {
  const start = animation.keyframes.length ? animation.keyframes[0]!.properties : animation.from;
  return start['opacity'] !== undefined && Number(start['opacity']) < 1;
}

function isVisibilityStep(animation: Animation): boolean {
  const keys = new Set([
    ...Object.keys(animation.from),
    ...Object.keys(animation.to),
    ...animation.keyframes.flatMap((frame) => Object.keys(frame.properties)),
  ]);
  return keys.size === 1 && keys.has('opacity');
}

function auditPacing(animations: readonly Animation[]): MotionFinding[] {
  const findings: MotionFinding[] = [];
  for (const animation of animations) {
    if (animation.repeat === 'infinite') continue;
    if (isEntrance(animation) && animation.duration > MOTION_BUDGET.maxEntry) {
      findings.push({
        kind: 'entry-over-budget',
        severity: 'warn',
        target: animation.target,
        detail: `Entrance runs ${animation.duration.toFixed(2)}s, over the ${MOTION_BUDGET.maxEntry}s single-entry budget. Split it into a staggered group instead of one slow element.`,
      });
    }
    if (animation.duration > MOTION_BUDGET.maxMove) {
      findings.push({
        kind: 'paced-slow',
        severity: 'warn',
        target: animation.target,
        detail: `Move runs ${animation.duration.toFixed(2)}s, which reads as drift rather than intent.`,
      });
    }
    if (
      animation.duration > 0 &&
      animation.duration < MOTION_BUDGET.minMove &&
      !isVisibilityStep(animation)
    ) {
      findings.push({
        kind: 'paced-fast',
        severity: 'warn',
        target: animation.target,
        detail: `Move runs ${animation.duration.toFixed(3)}s, too short to register.`,
      });
    }
  }
  return findings;
}

/**
 * Group animations that plausibly form one cascade and inspect their delays.
 *
 * Grouping is per component instance for generated parts (`name__part`) and
 * across roots otherwise, so one component's internal choreography is never
 * merged with another's into a cascade that does not exist.
 */
function auditCascades(animations: readonly Animation[]): MotionFinding[] {
  const groups = new Map<string, number[]>();
  for (const animation of animations) {
    if (animation.repeat === 'infinite' || !isEntrance(animation)) continue;
    const key = `${animation.duration}:${animation.easing}:${cascadeGroup(animation.target)}`;
    groups.set(key, [...(groups.get(key) ?? []), animation.delay]);
  }

  const findings: MotionFinding[] = [];
  for (const [key, delays] of groups) {
    // A cascade is temporally local. Arrivals seconds apart belong to different
    // beats, so split each group into contiguous runs before judging it.
    for (const cluster of clusterDelays(delays)) {
      if (cluster.length < 3) continue;
      const window = cluster.at(-1)! - cluster[0]!;
      if (window > ARRIVAL.maxStaggerWindow + 0.01) {
        findings.push({
          kind: 'stagger-window',
          severity: 'warn',
          at: Number(cluster[0]!.toFixed(3)),
          detail: `A cascade of ${cluster.length} elements (${key}) spans ${window.toFixed(2)}s from ${cluster[0]!.toFixed(2)}s, past the ${ARRIVAL.maxStaggerWindow}s one-beat window. Tighten the stagger so the group lands as one arrival.`,
        });
      }
      const gaps = cluster
        .slice(1)
        .map((delay, index) => Number((delay - cluster[index]!).toFixed(4)));
      const positive = gaps.filter((gap) => gap > 0.0001);
      // Only exact uniformity is reported. "Gaps appear to grow" cannot be
      // trusted here: this group is the entrance subset of a component's
      // animations, and a subsequence of a correctly decaying cascade has larger
      // apparent gaps wherever a non-entrance step was filtered out. A check that
      // cries wolf gets ignored, which is worse than not having it.
      if (positive.length >= 2 && new Set(positive).size === 1) {
        findings.push({
          kind: 'uneven-stagger',
          severity: 'warn',
          at: Number(cluster[0]!.toFixed(3)),
          detail: `A cascade of ${cluster.length} elements uses identical ${positive[0]}s gaps — a queue, not a wave. Shrink each successive gap so the group accelerates.`,
        });
      }
    }
  }
  return findings;
}

/**
 * Split delays into contiguous runs. A gap larger than this threshold means the
 * next arrival belongs to a different moment, not the same cascade.
 */
function clusterDelays(delays: readonly number[]): number[][] {
  const sorted = [...delays].sort((left, right) => left - right);
  const clusters: number[][] = [];
  for (const delay of sorted) {
    const current = clusters.at(-1);
    if (current && delay - current.at(-1)! <= CASCADE_GAP) current.push(delay);
    else clusters.push([delay]);
  }
  return clusters;
}

/**
 * Longest gap that still reads as part of the same cascade.
 *
 * This is what separates a cascade from staged reveals. Cascade gaps are small
 * and shrinking (0.04–0.12s), so the group reads as one arrival. Staged reveals
 * are deliberately further apart — separate beats of information, not one group —
 * and must not be judged against the one-beat cascade window.
 */
const CASCADE_GAP = 0.2;

/**
 * Find stretches where nothing meaningful is in flight.
 *
 * Infinite loops deliberately do not count as coverage: idle drift is what a
 * waiting video looks like, not sustained motion.
 */
/**
 * Which cascade does this target belong to?
 *
 * Split text fragments (`title__words_3`) belong to their own text element, and
 * generated component parts (`card__price`) belong to their component. Anything
 * else is a root-level element that may cascade with its siblings.
 */
function cascadeGroup(target: string): string {
  const fragment = /^(.*)__(?:words|chars|lines)_\d+$/.exec(target);
  if (fragment) return fragment[1]!;
  return target.includes('__') ? target.split('__')[0]! : '';
}

function auditCoverage(scene: Scene): MotionFinding[] {
  const timelineOffsets = animationTimelineOffsets(scene);
  const intervals = scene.animations
    .filter((animation) => animation.repeat !== 'infinite' && animation.duration > 0)
    .map((animation) => {
      const start = animation.delay + (timelineOffsets.get(animation.target) ?? 0);
      return [start, start + animation.duration] as const;
    })
    .sort((left, right) => left[0] - right[0]);

  const findings: MotionFinding[] = [];
  let cursor = 0;
  const report = (start: number, end: number) => {
    if (end - start <= MOTION_BUDGET.maxDeadZone) return;
    const idle = scene.animations.some(
      (animation) => animation.repeat === 'infinite' && animation.delay < end
    );
    findings.push({
      kind: 'dead-zone',
      severity: 'warn',
      at: Number(start.toFixed(3)),
      detail: `Nothing is in flight from ${start.toFixed(2)}s to ${end.toFixed(2)}s (${(end - start).toFixed(2)}s).${idle ? ' Idle drift is running, which does not count — it reads as waiting.' : ''} Give the beat a sustained-motion route or add story.`,
    });
  };

  for (const [start, end] of intervals) {
    if (start > cursor) report(cursor, start);
    cursor = Math.max(cursor, end);
  }
  if (cursor < scene.canvas.duration) report(cursor, scene.canvas.duration);
  return findings;
}

/** Child animation delays are local to their parent scene/group window. */
function animationTimelineOffsets(scene: Scene): Map<string, number> {
  const byId = new Map(scene.elements.map((element) => [element.id, element]));
  const offsets = new Map<string, number>();
  const resolving = new Set<string>();
  const resolve = (id: string): number => {
    const cached = offsets.get(id);
    if (cached !== undefined) return cached;
    if (resolving.has(id)) return 0;
    resolving.add(id);
    const element = byId.get(id);
    const parent = byId.get(String(element?.properties.parent ?? ''));
    const offset = parent ? resolve(parent.id) + finiteNumber(parent.properties.start, 0) : 0;
    offsets.set(id, offset);
    resolving.delete(id);
    return offset;
  };
  for (const element of scene.elements) resolve(element.id);
  return offsets;
}

/** Geometry checks sampled across the timeline. */
function auditGeometry(scene: Scene): MotionFinding[] {
  const findings: MotionFinding[] = [];
  const seen = new Set<string>();
  const ancestors = ancestorMap(scene);
  const transitionPairs = new Set(
    scene.transitions.flatMap((transition) => [
      `${transition.from}:${transition.to}`,
      `${transition.to}:${transition.from}`,
    ])
  );
  const scenePairs = pairedSceneTransitions(scene);
  const sceneByElement = sceneAncestorMap(scene, ancestors);
  const samples = Math.max(2, MOTION_BUDGET.samples);
  // An element that travels off frame is exiting, which is legitimate. Only an
  // element that is never on screen while visible is a real problem, so track
  // both counts and report at the end.
  const visibility = new Map<string, { visible: number; offscreen: number; at: number }>();

  for (let index = 0; index < samples; index += 1) {
    const time = (scene.canvas.duration * index) / (samples - 1);
    const evaluated = evaluateScene(scene, Math.min(time, scene.canvas.duration));
    const boxes: Box[] = [];

    for (const element of evaluated.elements) {
      if (element.kind === 'group' || element.kind === 'scene') continue;
      const render = element.render as unknown as Record<string, unknown>;
      if (Number(render['opacity'] ?? 1) <= 0.02) continue;
      const layer = String(render['layer'] ?? 'content');
      const width = Number(render['width']);
      const height = Number(render['height']);

      if (
        (render['width'] !== null && Number.isFinite(width) && width <= 0) ||
        (render['height'] !== null && Number.isFinite(height) && height <= 0)
      ) {
        push(findings, seen, {
          kind: 'degenerate',
          severity: 'warn',
          target: element.id,
          at: Number(time.toFixed(3)),
          detail: `Visible with no area (${width}x${height}).`,
        });
        continue;
      }
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        continue;
      }

      const box: Box = {
        id: element.id,
        x: Number(render['x'] ?? 0),
        y: Number(render['y'] ?? 0),
        width,
        height,
      };
      const record = visibility.get(element.id) ?? { visible: 0, offscreen: 0, at: time };
      record.visible += 1;
      if (isOffscreen(box, scene)) {
        record.offscreen += 1;
        visibility.set(element.id, record);
        continue;
      }
      visibility.set(element.id, record);
      if (layer !== 'background' && layer !== 'effects') boxes.push(box);
    }

    for (const [position, box] of boxes.entries()) {
      for (const other of boxes.slice(position + 1)) {
        if (related(ancestors, box.id, other.id, transitionPairs, sceneByElement, scenePairs))
          continue;
        if (!comparable(box, other)) continue;
        const ratio = overlapRatio(box, other);
        if (ratio < MOTION_BUDGET.collisionRatio) continue;
        push(findings, seen, {
          kind: 'collision',
          severity: 'warn',
          target: `${box.id} / ${other.id}`,
          at: Number(time.toFixed(3)),
          detail: `Two similarly sized, unrelated elements overlap by ${(ratio * 100).toFixed(0)}% at ${time.toFixed(2)}s.`,
        });
      }
    }
  }

  for (const [id, record] of visibility) {
    if (record.visible >= 2 && record.offscreen === record.visible) {
      push(findings, seen, {
        kind: 'offscreen',
        severity: 'warn',
        target: id,
        detail: 'Visible for its whole life but never inside the canvas.',
      });
    }
  }
  return findings;
}

/**
 * Containment is composition, not collision: a button sitting on a panel or a
 * label inside a card is intended. Only similarly sized elements stacked on each
 * other are a real overlap bug.
 */
function comparable(left: Box, right: Box): boolean {
  const leftArea = left.width * left.height;
  const rightArea = right.width * right.height;
  if (leftArea <= 0 || rightArea <= 0) return false;
  const ratio = leftArea > rightArea ? leftArea / rightArea : rightArea / leftArea;
  return ratio <= 2.5;
}

/** One finding per kind+target, so a sampled problem is not reported 16 times. */
function push(findings: MotionFinding[], seen: Set<string>, finding: MotionFinding): void {
  const key = `${finding.kind}:${finding.target ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(finding);
}

function ancestorMap(scene: Scene): Map<string, Set<string>> {
  const parents = new Map(
    scene.elements.map((element) => [element.id, String(element.properties.parent ?? '')])
  );
  const map = new Map<string, Set<string>>();
  for (const element of scene.elements) {
    const chain = new Set<string>();
    let cursor = parents.get(element.id) ?? '';
    while (cursor && !chain.has(cursor)) {
      chain.add(cursor);
      cursor = parents.get(cursor) ?? '';
    }
    map.set(element.id, chain);
  }
  return map;
}

/** Parent/child, component siblings, and shared-transition counterparts may overlap. */
function related(
  ancestors: Map<string, Set<string>>,
  left: string,
  right: string,
  transitionPairs: Set<string>,
  sceneByElement: Map<string, string>,
  scenePairs: Set<string>
): boolean {
  if (ancestors.get(left)?.has(right) || ancestors.get(right)?.has(left)) return true;
  const leftRoot = rootOf(left);
  const rightRoot = rootOf(right);
  const leftScene = sceneByElement.get(left);
  const rightScene = sceneByElement.get(right);
  return Boolean(
    (leftRoot && (leftRoot === rightRoot || transitionPairs.has(`${leftRoot}:${rightRoot}`))) ||
    (leftScene && rightScene && scenePairs.has(`${leftScene}:${rightScene}`))
  );
}

function sceneAncestorMap(scene: Scene, ancestors: Map<string, Set<string>>): Map<string, string> {
  const sceneIds = new Set(
    scene.elements.filter((element) => element.kind === 'scene').map((element) => element.id)
  );
  return new Map(
    scene.elements.map((element) => [
      element.id,
      [...(ancestors.get(element.id) ?? [])].find((ancestor) => sceneIds.has(ancestor)) ?? '',
    ])
  );
}

function pairedSceneTransitions(scene: Scene): Set<string> {
  const scenes = scene.elements.filter((element) => element.kind === 'scene');
  const pairs = new Set<string>();
  for (const outgoing of scenes) {
    const outgoingProps = outgoing.properties as unknown as Record<string, unknown>;
    if (!outgoingProps['transitionOut']) continue;
    const outgoingEnd =
      finiteNumber(outgoing.properties.start, 0) + finiteNumber(outgoing.properties.duration, 0);
    for (const incoming of scenes) {
      const incomingProps = incoming.properties as unknown as Record<string, unknown>;
      if (incoming === outgoing || !incomingProps['transitionIn']) continue;
      const incomingStart = finiteNumber(incoming.properties.start, 0);
      if (
        incomingStart >= outgoingEnd ||
        incomingStart < finiteNumber(outgoing.properties.start, 0)
      )
        continue;
      pairs.add(`${outgoing.id}:${incoming.id}`);
      pairs.add(`${incoming.id}:${outgoing.id}`);
    }
  }
  return pairs;
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isOffscreen(box: Box, scene: Scene): boolean {
  const halfWidth = scene.canvas.width / 2;
  const halfHeight = scene.canvas.height / 2;
  return (
    box.x + box.width / 2 < -halfWidth ||
    box.x - box.width / 2 > halfWidth ||
    box.y + box.height / 2 < -halfHeight ||
    box.y - box.height / 2 > halfHeight
  );
}

function overlapRatio(left: Box, right: Box): number {
  const width =
    Math.min(left.x + left.width / 2, right.x + right.width / 2) -
    Math.max(left.x - left.width / 2, right.x - right.width / 2);
  const height =
    Math.min(left.y + left.height / 2, right.y + right.height / 2) -
    Math.max(left.y - left.height / 2, right.y - right.height / 2);
  if (width <= 0 || height <= 0) return 0;
  const smaller = Math.min(left.width * left.height, right.width * right.height);
  return smaller > 0 ? (width * height) / smaller : 0;
}
