/**
 * Scenes: the organizational layer of a Motionly project.
 *
 * A project is a storyboard — an ordered list of scenes — not one long pile of
 * objects on a global timeline. A scene owns its components, its camera, its
 * background, its own timeline, its audio, and its duration. Selecting a scene
 * opens that scene's timeline; the top-level timeline only ever shows the
 * storyboard, so it stays readable no matter how large the project grows.
 *
 * Scenes are **organizational boundaries, not animation boundaries.** Nothing is
 * cleared at a scene edge. A component that exists on both sides of a boundary
 * keeps its identity and transforms across it; only the components that are
 * genuinely leaving get an exit and only the genuinely new ones get an entrance.
 * That is what makes a storyboard read as one motion graphic instead of a stack
 * of slides.
 *
 * Layering (why this module changes nothing downstream):
 *
 *   scene blocks  ──planScenes──▶ ScenePlan[]  ──lowerScenes──▶ ordinary AST
 *                                     │
 *                                     └──▶ storyboard on the scene graph
 *                                          (editor, inspector, AI)
 *
 * Lowering targets the `scene` element kind the engine already renders: it owns a
 * background, a per-scene camera with depth parallax, an enter/exit envelope, and
 * — critically — evaluates its children in **parent-local time**. Scene-relative
 * authoring therefore needs no evaluator or renderer change at all. Every scene
 * boundary artifact this module emits is a `transition` element or an
 * `Animation`, both of which already exist.
 */

import { TRANSITION_TOKENS } from './budget';
import type { AnimationNode, ASTNode, ElementNode } from '../types/parser';
import type { CameraFraming } from './beats';

/**
 * How a boundary between two scenes is crossed.
 *
 * There is no `fade`. Fading the frame is the move that makes generated video
 * feel like a slideshow, and the doctrine forbids it: transform between shots,
 * never dissolve.
 */
export const SCENE_TRANSITION_KINDS = [
  /** Shared components hand off; the rest exit and enter around them. */
  'sharedElement',
  /** The camera reframes across the boundary. */
  'cameraMove',
  /** Nothing is marked at all — the composition simply keeps evolving. */
  'continuous',
  /** An explicit, documented hard change. Use rarely. */
  'cut',
] as const;

export type SceneTransitionKind = (typeof SCENE_TRANSITION_KINDS)[number];

export function isSceneTransitionKind(value: string): value is SceneTransitionKind {
  return (SCENE_TRANSITION_KINDS as readonly string[]).includes(value);
}

const DEFAULT_EASING: Record<SceneTransitionKind, string> = {
  sharedElement: TRANSITION_TOKENS.easing.smoothOut,
  cameraMove: TRANSITION_TOKENS.easing.smoothOut,
  continuous: 'sine.inOut',
  cut: 'power2.in',
};

/** Shortest scene worth calling a scene. */
export const MIN_SCENE_DURATION = 0.5;

/**
 * One member of a scene.
 *
 * `identity` is the persistent component id. Two members in different scenes
 * that share an identity are the same logical component, so the storyboard can
 * detect shared elements automatically instead of asking the author to wire
 * every handoff by hand. A member with no identity falls back to its element id,
 * which means reusing the same element name across scenes also works.
 */
export interface SceneMember {
  id: string;
  identity?: string;
  /** True when the member already carries authored or preset motion. */
  animated?: boolean;
}

/** A scene as authored, before absolute times are resolved. */
export interface SceneSpec {
  name: string;
  start?: number;
  duration?: number;
  label?: string;
  background?: string;
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
  /** Transition **into** this scene, from the previous one. */
  transition?: SceneTransitionKind;
  transitionDuration?: number;
  easing?: string;
  members?: readonly SceneMember[];
}

/** Which components cross a boundary, which leave, and which arrive. */
export interface SceneParticipation {
  /** Components present on both sides, paired by persistent identity. */
  shared: Array<{ identity: string; from: string; to: string }>;
  /** Components that only exist before the boundary. */
  exit: string[];
  /** Components that only exist after the boundary. */
  enter: string[];
}

export interface SceneTransitionPlan {
  kind: SceneTransitionKind;
  /** Absolute time of the boundary. */
  at: number;
  duration: number;
  easing: string;
  participation: SceneParticipation;
}

/** A scene with absolute timing, neighbours, and a resolved boundary plan. */
export interface ScenePlan {
  name: string;
  index: number;
  start: number;
  duration: number;
  end: number;
  label?: string;
  background?: string;
  camera: CameraFraming;
  /** Previous scene name, or null for the opening scene. */
  previous: string | null;
  /** Next scene name, or null for the closing scene. */
  next: string | null;
  members: SceneMember[];
  /** Persistent identity → element id, for this scene only. */
  identities: Record<string, string>;
  /** Transition into this scene. Null on the opening scene. */
  transition: SceneTransitionPlan | null;
}

export interface ScenePlanOptions {
  /** Canvas duration, used to size scenes that declare none. */
  canvasDuration: number;
  /** Resting camera framing the first scene departs from. */
  camera: CameraFraming;
}

/**
 * Resolve a storyboard into absolute scene plans.
 *
 * Scenes run back to back unless a `start` is given. A scene with no duration
 * takes an even share of whatever canvas time is left, so a five-scene
 * storyboard on a 30s canvas paces itself and the author only pins the scenes
 * that actually matter.
 */
export function planScenes(specs: readonly SceneSpec[], options: ScenePlanOptions): ScenePlan[] {
  if (!specs.length) return [];

  assertUniqueNames(specs);

  const explicitTotal = specs.reduce((total, spec) => total + (spec.duration ?? 0), 0);
  const unsized = specs.filter((spec) => spec.duration === undefined).length;
  const remaining = Math.max(0, options.canvasDuration - explicitTotal);
  const share = unsized ? Math.max(MIN_SCENE_DURATION, remaining / unsized) : 0;

  const plans: ScenePlan[] = [];
  let cursor = 0;

  for (const [index, spec] of specs.entries()) {
    const start = spec.start ?? cursor;
    const duration = Math.max(MIN_SCENE_DURATION, spec.duration ?? share);
    const previous = plans[index - 1];
    const inherited = previous?.camera ?? options.camera;
    const camera: CameraFraming = {
      x: round(spec.cameraX ?? inherited.x),
      y: round(spec.cameraY ?? inherited.y),
      zoom: round(spec.zoom ?? inherited.zoom),
    };
    const members = (spec.members ?? []).map((member) => ({ ...member }));

    plans.push({
      name: spec.name,
      index,
      start: round(start),
      duration: round(duration),
      end: round(start + duration),
      ...(spec.label ? { label: spec.label } : {}),
      ...(spec.background ? { background: spec.background } : {}),
      camera,
      previous: previous?.name ?? null,
      next: null,
      members,
      identities: identityMap(members),
      transition: null,
    });

    cursor = start + duration;
  }

  for (const [index, plan] of plans.entries()) {
    plan.next = plans[index + 1]?.name ?? null;
    const spec = specs[index]!;
    const previous = plans[index - 1];
    if (!previous) continue;
    plan.transition = planSceneTransition({
      at: plan.start,
      participation: classifyParticipation(previous, plan),
      cameraChanged: framingChanged(previous.camera, plan.camera),
      ...(spec.transition ? { kind: spec.transition } : {}),
      ...(spec.easing ? { easing: spec.easing } : {}),
      ...(spec.transitionDuration !== undefined
        ? { duration: spec.transitionDuration }
        : { duration: Math.min(0.9, Math.max(0.35, plan.duration * 0.22)) }),
    });
  }

  return plans;
}

/**
 * Classify every component around a boundary as shared, exiting, or entering.
 *
 * This is the mechanism behind natural continuity. A logo that appears in both
 * scenes is *not* an exit followed by an entrance — it is one component that
 * moves and resizes. Only what genuinely leaves is animated out.
 */
export function classifyParticipation(previous: ScenePlan, next: ScenePlan): SceneParticipation {
  const shared: SceneParticipation['shared'] = [];
  const exit: string[] = [];
  const enter: string[] = [];

  for (const member of previous.members) {
    const identity = identityOf(member);
    const match = next.identities[identity];
    if (match) shared.push({ identity, from: member.id, to: match });
    else exit.push(member.id);
  }
  for (const member of next.members) {
    const identity = identityOf(member);
    if (!previous.identities[identity]) enter.push(member.id);
  }

  return { shared, exit, enter };
}

export interface SceneTransitionRequest {
  /** Authored kind, or undefined to let the planner infer one. */
  kind?: SceneTransitionKind;
  at: number;
  duration?: number;
  easing?: string;
  participation: SceneParticipation;
  cameraChanged: boolean;
}

/**
 * Choose the transition for one scene boundary.
 *
 * Authored kinds win. Otherwise the storyboard itself decides: a shared
 * component means a handoff, a reframe means a camera move, and everything else
 * simply keeps going. No branch of this function can produce a frame fade.
 */
export function planSceneTransition(request: SceneTransitionRequest): SceneTransitionPlan {
  const inferred: SceneTransitionKind = request.participation.shared.length
    ? 'sharedElement'
    : request.cameraChanged
      ? 'cameraMove'
      : 'continuous';
  const kind = request.kind ?? inferred;
  return {
    kind,
    at: round(request.at),
    duration: round(
      request.duration ?? (kind === 'cut' ? 0.001 : TRANSITION_TOKENS.duration.emphasis)
    ),
    easing: request.easing ?? DEFAULT_EASING[kind],
    participation: request.participation,
  };
}

/**
 * Patch the authored `scene` blocks with their resolved storyboard timing.
 *
 * The scene root gets its `start` — the time origin its children are evaluated
 * against — and deliberately **not** a `duration`. That single omission is what
 * makes scenes organizational rather than animation boundaries: the engine culls a
 * child once its ancestor's window closes, so writing the scene length onto the
 * element would clear the composition at every edge and reintroduce the slideshow.
 *
 * The length still exists — it lives on the plan, where the strip, the pacing, and
 * the boundary planner read it — it just is not a cage. Components that genuinely
 * leave are animated out by `lowerSceneTransitions`; components that persist simply
 * persist. An author who wants a hard clear asks for it with `clear`.
 *
 * Returned nodes are ordinary `scene` elements, so the scene graph, evaluator, and
 * renderer see nothing new.
 */
export function lowerSceneRoots(
  plans: readonly ScenePlan[],
  nodesByName: ReadonlyMap<string, ElementNode>
): ElementNode[] {
  const roots: ElementNode[] = [];
  for (const plan of plans) {
    const node = nodesByName.get(plan.name);
    if (!node) continue;
    const properties: Record<string, unknown> = {
      ...node.properties,
      start: `${plan.start}s`,
      cameraX: plan.camera.x,
      cameraY: plan.camera.y,
      cameraZoom: plan.camera.zoom,
    };
    delete properties['transition'];
    delete properties['transitionDuration'];
    delete properties['easing'];
    delete properties['zoom'];
    delete properties['label'];
    delete properties['clear'];
    delete properties['duration'];
    // `clear` is the explicit opt-in to the old cage: the scene closes and takes
    // whatever is still inside it with it.
    if (isTruthy(node.properties['clear'])) properties['duration'] = `${plan.duration}s`;
    if (plan.label !== undefined) properties['label'] = plan.label;
    roots.push({ ...node, properties });
  }
  return roots;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === '' || value === 1;
}

/**
 * Lower scene boundaries into engine primitives.
 *
 * | participation | lowers to                                                |
 * | ------------- | -------------------------------------------------------- |
 * | shared        | `transition {}` — the evaluator's shared-element machinery |
 * | exit          | a short transform-out on that component only              |
 * | enter         | a transform-in, staggered as a wave, only when it has none |
 *
 * Entrances are skipped for members that already carry authored or preset
 * motion, so a storyboard never double-animates an element. Exits and entrances
 * both move — opacity is binary at the endpoints, per the arrival doctrine.
 */
export function lowerSceneTransitions(plans: readonly ScenePlan[]): ASTNode[] {
  const nodes: ASTNode[] = [];

  for (const [index, plan] of plans.entries()) {
    const transition = plan.transition;
    if (!transition || transition.kind === 'cut') continue;
    const previous = plans[index - 1];
    if (
      previous &&
      transition.kind === 'cameraMove' &&
      transition.participation.shared.length === 0
    ) {
      nodes.push(...cameraBoundaryAnimations(previous, plan, transition, index));
      continue;
    }
    const { shared, exit, enter } = transition.participation;
    if (previous && transition.kind === 'continuous' && shared.length === 0) {
      nodes.push(...continuousBoundaryAnimations(previous, plan, transition, index));
      continue;
    }
    // Exits, retirements, and entrances target members, and a member is evaluated
    // in its own scene's local time. Emitting the absolute boundary time here would
    // fire them a whole scene late, so each side is rebased onto the scene that
    // owns it.
    const exitOrigin = previous?.start ?? 0;

    for (const [pairIndex, pair] of shared.entries()) {
      if (pair.from === pair.to) continue;
      nodes.push({
        type: 'Element',
        kind: 'transition',
        name: `${plan.name}__shared_${pairIndex}`,
        properties: {
          from: pair.from,
          to: pair.to,
          at: `${transition.at}s`,
          duration: `${transition.duration}s`,
          easing: transition.easing,
        },
      });
      // Retire the source once the handoff has landed. The engine's shared-element
      // machinery only drives both endpoints *inside* the transition window; after
      // it, the source would sit there fully visible next to the component it just
      // handed off to. Nothing culls it, because a scene is not a cage.
      nodes.push(retireAnimation(pair.from, handoffEnd(transition) - exitOrigin));
    }

    const exitDuration = TRANSITION_TOKENS.duration.medium;
    for (const [exitIndex, id] of exit.entries()) {
      nodes.push(exitAnimation(id, transition.at - exitOrigin, exitDuration, exitIndex));
    }

    const entering = enter.filter((id) => !isAnimated(plan, id));
    for (const [enterIndex, id] of entering.entries()) {
      nodes.push(enterAnimation(id, transition.at - plan.start, enterIndex));
    }
  }

  return nodes;
}

function continuousBoundaryAnimations(
  previous: ScenePlan,
  next: ScenePlan,
  transition: SceneTransitionPlan,
  index: number
): AnimationNode[] {
  const mode = index % 5;
  if (mode === 1 || mode === 4) {
    const sign = mode === 1 ? 1 : -1;
    return [
      sceneRootAnimation(
        previous.name,
        transition,
        { x: 0, scale: 1, rotationY: 0 },
        { x: -sign * 2200, scale: 1.01, rotationY: sign * 2.5 }
      ),
      sceneRootAnimation(
        next.name,
        transition,
        { x: sign * 2200, scale: 0.99, rotationY: -sign * 2.5 },
        { x: 0, scale: 1, rotationY: 0 }
      ),
    ];
  }
  if (mode === 3) {
    return [
      sceneRootAnimation(
        previous.name,
        transition,
        { x: 0, y: 0, scale: 1, rotationY: 0 },
        { x: -40, y: -24, scale: 1.14, rotationY: -1.5 }
      ),
      sceneRootAnimation(
        next.name,
        transition,
        { x: 40, y: 24, scale: 0.88, rotationY: 1.5 },
        { x: 0, y: 0, scale: 1, rotationY: 0 }
      ),
    ];
  }
  if (mode === 2) {
    return [
      sceneRootAnimation(
        previous.name,
        transition,
        { x: 0, y: 0, scale: 1, opacity: 1 },
        { x: -20, y: -16, scale: 1.08, opacity: 0 }
      ),
      sceneRootAnimation(
        next.name,
        transition,
        { x: 20, y: 16, scale: 0.88, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1 }
      ),
    ];
  }
  const sign = -1;
  return [
    sceneRootAnimation(
      previous.name,
      transition,
      { y: 0, scale: 1, rotationX: 0 },
      { y: -sign * 1400, scale: 1.01, rotationX: sign * 1.25 }
    ),
    sceneRootAnimation(
      next.name,
      transition,
      { y: sign * 1400, scale: 0.99, rotationX: -sign * 1.25 },
      { y: 0, scale: 1, rotationX: 0 }
    ),
  ];
}

/**
 * Reframe complete scene roots from the authored camera relationship.
 * A camera zoom produces depth, a camera pan produces directional travel, and
 * an otherwise unchanged framing gets a restrained alternating page turn.
 */
function cameraBoundaryAnimations(
  previous: ScenePlan,
  next: ScenePlan,
  transition: SceneTransitionPlan,
  index: number
): AnimationNode[] {
  const dx = next.camera.x - previous.camera.x;
  const dy = next.camera.y - previous.camera.y;
  const zoom = next.camera.zoom - previous.camera.zoom;

  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sign = Math.sign(horizontal ? dx || 1 : dy || 1);
    const delta = Math.abs(horizontal ? dx : dy);
    const travel = Math.min(240, Math.max(96, delta * 1.4));
    const offset = horizontal ? { x: sign * travel, y: 0 } : { x: 0, y: sign * travel };
    return [
      sceneRootAnimation(
        previous.name,
        transition,
        { x: 0, y: 0, scale: 1, rotationY: 0, rotationX: 0 },
        {
          x: -offset.x,
          y: -offset.y,
          scale: 1.01,
          rotationY: horizontal ? -sign * 1.25 : 0,
          rotationX: horizontal ? 0 : sign,
        }
      ),
      sceneRootAnimation(
        next.name,
        transition,
        {
          x: offset.x,
          y: offset.y,
          scale: 0.99,
          rotationY: horizontal ? sign * 1.25 : 0,
          rotationX: horizontal ? 0 : -sign,
        },
        { x: 0, y: 0, scale: 1, rotationY: 0, rotationX: 0 }
      ),
    ];
  }

  if (Math.abs(zoom) > 0.001) {
    const pushingIn = zoom > 0;
    return [
      sceneRootAnimation(
        previous.name,
        transition,
        { x: 0, y: 0, scale: 1, blur: 0 },
        {
          x: 0,
          y: pushingIn ? -12 : 12,
          scale: pushingIn ? 1.06 : 0.96,
          rotationY: 0,
          blur: TRANSITION_TOKENS.blur.medium,
        }
      ),
      sceneRootAnimation(
        next.name,
        transition,
        {
          x: 0,
          y: pushingIn ? 12 : -12,
          scale: pushingIn ? 0.96 : 1.04,
          rotationY: 0,
          blur: TRANSITION_TOKENS.blur.medium,
        },
        { x: 0, y: 0, scale: 1, rotationY: 0, blur: 0 }
      ),
    ];
  }

  const sign = index % 2 === 0 ? 1 : -1;
  return [
    sceneRootAnimation(
      previous.name,
      transition,
      { x: 0, y: 0, scale: 1, rotationY: 0 },
      { x: -sign * 96, y: 0, scale: 1.01, rotationY: sign * 0.75 }
    ),
    sceneRootAnimation(
      next.name,
      transition,
      { x: sign * 96, y: 0, scale: 0.99, rotationY: -sign * 0.75 },
      { x: 0, y: 0, scale: 1, rotationY: 0 }
    ),
  ];
}

function sceneRootAnimation(
  target: string,
  transition: SceneTransitionPlan,
  from: Record<string, number>,
  to: Record<string, number>
): AnimationNode {
  return {
    type: 'Animation',
    target,
    from,
    to,
    keyframes: [],
    delay: round(transition.at),
    duration: Math.max(0.001, transition.duration),
    easing: transition.easing,
  };
}

/**
 * Members that carry no motion of their own and never take part in a boundary —
 * the blind spot of a storyboard. Reported so the inspector can surface a
 * component that would sit frozen inside its scene.
 */
export function staticMembers(plans: readonly ScenePlan[]): string[] {
  const moving = new Set<string>();
  for (const plan of plans) {
    const participation = plan.transition?.participation;
    if (!participation) continue;
    for (const id of participation.enter) moving.add(id);
    // A shared component is carried across the boundary by a handoff, which is
    // motion on both endpoints.
    for (const pair of participation.shared) {
      moving.add(pair.from);
      moving.add(pair.to);
    }
    for (const id of participation.exit) moving.add(id);
  }
  const still: string[] = [];
  for (const plan of plans) {
    for (const member of plan.members) {
      if (member.animated) continue;
      if (moving.has(member.id)) continue;
      still.push(member.id);
    }
  }
  return still;
}

/** Scene start times by name, used to resolve `scene NAME` membership timing. */
export function sceneStarts(plans: readonly ScenePlan[]): Map<string, number> {
  return new Map(plans.map((plan) => [plan.name, plan.start]));
}

/** The scene a given time falls inside, or null before the first / after the last. */
export function sceneAt(plans: readonly ScenePlan[], time: number): ScenePlan | null {
  return plans.find((plan) => time >= plan.start && time < plan.end) ?? null;
}

/** Total storyboard length: the end of the last scene. */
export function storyboardDuration(plans: readonly ScenePlan[]): number {
  return plans.reduce((total, plan) => Math.max(total, plan.end), 0);
}

function exitAnimation(target: string, at: number, duration: number, index: number): AnimationNode {
  // Exits leave the frame instead of dissolving. The scene is uncaged, so the
  // transform is what keeps the outgoing element from lingering on screen.
  const lead = round(Math.max(0, at - duration * 0.6));
  const direction = index % 2 === 0 ? -1 : 1;
  return {
    type: 'Animation',
    target,
    from: { opacity: 1, y: 0, scale: 1 },
    to: { opacity: 1, x: direction * 260, y: -96, scale: 0.98 },
    keyframes: [],
    delay: round(lead + index * 0.05),
    duration,
    easing: TRANSITION_TOKENS.easing.smoothOut,
  };
}

function retireAnimation(target: string, at: number): AnimationNode {
  return {
    type: 'Animation',
    target,
    from: { opacity: 0 },
    to: { opacity: 0 },
    keyframes: [],
    delay: round(at),
    duration: 0.001,
    easing: 'linear',
  };
}

function handoffEnd(transition: SceneTransitionPlan): number {
  return round(transition.at + transition.duration / 2);
}

function enterAnimation(target: string, at: number, index: number): AnimationNode {
  // A group entrance is a wave, not a queue: the gap shrinks as the cascade runs
  // so the whole arrival lands inside half a second.
  const gap = TRANSITION_TOKENS.duration.micro * 0.84 ** index;
  return {
    type: 'Animation',
    target,
    from: { opacity: 0, y: TRANSITION_TOKENS.distance.medium, blur: TRANSITION_TOKENS.blur.medium },
    to: { opacity: 1, y: 0, blur: 0 },
    keyframes: [],
    delay: round(at + index * gap),
    duration: TRANSITION_TOKENS.duration.emphasis,
    easing: TRANSITION_TOKENS.easing.smoothOut,
  };
}

function isAnimated(plan: ScenePlan, id: string): boolean {
  return Boolean(plan.members.find((member) => member.id === id)?.animated);
}

function identityOf(member: SceneMember): string {
  return member.identity ?? member.id;
}

function identityMap(members: readonly SceneMember[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const member of members) {
    const identity = identityOf(member);
    if (!(identity in map)) map[identity] = member.id;
  }
  return map;
}

function framingChanged(previous: CameraFraming, next: CameraFraming): boolean {
  return (
    Math.abs(next.x - previous.x) > 0.01 ||
    Math.abs(next.y - previous.y) > 0.01 ||
    Math.abs(next.zoom - previous.zoom) > 0.001
  );
}

function assertUniqueNames(specs: readonly SceneSpec[]): void {
  const seen = new Set<string>();
  for (const spec of specs) {
    if (seen.has(spec.name)) throw new Error(`Duplicate scene "${spec.name}".`);
    seen.add(spec.name);
  }
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

/** Prompt text describing the scene contract to the AI. */
export function scenePrompt(): string {
  return [
    'Scenes are how a project is organized. Build the storyboard before any animation:',
    '- scene NAME { duration 5s background #05060a label "Intro" } declares one scene.',
    '- Omit start to run scenes back to back; omit duration to split the canvas evenly.',
    '- Every object belongs to exactly one scene: put `scene NAME` on the text, image, component, layout, or showcase.',
    '- A scene owns its components, camera, background, timeline, audio, and duration. Its children are timed relative to the scene start, so write scene-local delays.',
    '- Scenes are organizational boundaries, NOT animation boundaries. Nothing is cleared at a boundary.',
    '- Give a component that appears in several scenes the same `identity NAME`. Motionly then detects it as shared and it moves and resizes across the boundary instead of disappearing and reappearing.',
    '- At each boundary every component is shared, exit, or enter. Only genuine exits animate out and only genuine arrivals animate in.',
    '- Boundary transitions: sharedElement (default when something is shared), cameraMove (default when the framing changes), continuous, cut. There is no fade.',
    '- Generate in this order: storyboard → scenes → scene contents → shared identities → boundary transitions → the animation inside each scene.',
  ].join('\n');
}
