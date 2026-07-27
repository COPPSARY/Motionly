/**
 * Beat system.
 *
 * A beat is a change in focus, not a slide. Beats deliberately do **not** emit a
 * `scene` root: nothing is cleared between them, so objects persist and
 * transform across the whole film instead of being created and destroyed shot by
 * shot. That single decision is what removes the PowerPoint feel.
 *
 * What a beat owns:
 * - a time window (`start`, `duration`), inherited from the previous beat when
 *   omitted, so a beat list reads as a storyboard;
 * - a focal subject and a camera framing for it, lowered to `animate camera`;
 * - the transition into the beat, delegated to the transition planner;
 * - a label, kept on the plan so the editor and inspector can show the beat.
 *
 * Elements, layouts, and showcases attach to a beat with `beat NAME`, and the
 * compiler resolves their entrance delay from that beat's start. Timing becomes
 * a storyboard decision rather than a pile of hand-tuned delays.
 */

import type { ASTNode, AnimationNode } from '../types/parser';
import { STILLNESS_BEFORE_CLIMAX } from './budget';
import {
  lowerBeatTransition,
  planBeatTransition,
  requiresEndpoints,
  type BeatTransitionKind,
  type BeatTransitionPlan,
} from './transitions';

export interface CameraFraming {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Sustained-motion routes.
 *
 * Every beat between its entrance and its exit is owned by exactly one route.
 * The rule this enforces: idle drift — float, breathe, glow pulse — is not
 * sustained motion. It reads as "the video is waiting." A beat that finishes
 * entering with time left over is a planning problem, and the fix is more story,
 * not more wobble.
 *
 * The test: pause anywhere inside the beat and something meaningful must be
 * mid-flight — a reveal landing, the camera traveling, the product doing what the
 * narration says.
 */
export const BEAT_ROUTES = [
  /** Content is held back and paid off in stages, so the frame keeps gaining information. */
  'stagedReveals',
  /** A mapped camera path: establish wide, travel, arrive on the subject. */
  'cameraIntent',
  /** The product behaves over time: progress advances, counts tick, highlights step. */
  'uiLife',
  /** Elements act out a beat: a card files into a stack, a result assembles. */
  'sequence',
  /** A cursor walks the eye to a control and its click ignites the next beat. */
  'cursorLed',
  /** Deliberate stillness — the only route that may hold a composed frame still. */
  'hold',
] as const;

export type BeatRoute = (typeof BEAT_ROUTES)[number];

export function isBeatRoute(value: string): value is BeatRoute {
  return (BEAT_ROUTES as readonly string[]).includes(value);
}

export interface BeatSpec {
  name: string;
  start?: number;
  duration?: number;
  focus?: string;
  zoom?: number;
  cameraX?: number;
  cameraY?: number;
  transition?: BeatTransitionKind;
  from?: string;
  to?: string;
  transitionDuration?: number;
  easing?: string;
  label?: string;
  /** Sustained-motion route; inferred from the beat's own content when omitted. */
  route?: BeatRoute;
  /** Number of blocks attached to this beat, used to infer and validate the route. */
  attachments?: number;
}

export interface BeatPlan {
  name: string;
  index: number;
  start: number;
  duration: number;
  end: number;
  focus?: string;
  label?: string;
  camera: CameraFraming;
  transition: BeatTransitionPlan | null;
  /** What keeps this beat performing between its entrance and its exit. */
  route: BeatRoute;
}

export interface BeatPlanOptions {
  /** Canvas duration, used to size beats that declare none. */
  canvasDuration: number;
  /** Resting camera framing the first beat departs from. */
  camera: CameraFraming;
}

const MIN_BEAT = 0.4;

/**
 * Resolve a beat list into an absolute plan.
 *
 * Beats run back to back unless a `start` is given. A beat with no duration
 * takes an even share of whatever canvas time is left, so a five-beat storyboard
 * on a 30s canvas paces itself.
 */
export function planBeats(specs: readonly BeatSpec[], options: BeatPlanOptions): BeatPlan[] {
  if (!specs.length) return [];

  const explicitTotal = specs.reduce((total, spec) => total + (spec.duration ?? 0), 0);
  const unsized = specs.filter((spec) => spec.duration === undefined).length;
  const remaining = Math.max(0, options.canvasDuration - explicitTotal);
  const share = unsized ? Math.max(MIN_BEAT, remaining / unsized) : 0;

  const plans: BeatPlan[] = [];
  let cursor = 0;
  let camera = { ...options.camera };

  for (const [index, spec] of specs.entries()) {
    const start = spec.start ?? cursor;
    const duration = Math.max(MIN_BEAT, spec.duration ?? share);
    const previous = plans[index - 1];
    const next: CameraFraming = {
      x: spec.cameraX ?? (spec.focus ? camera.x : (previous?.camera.x ?? camera.x)),
      y: spec.cameraY ?? (spec.focus ? camera.y : (previous?.camera.y ?? camera.y)),
      zoom: spec.zoom ?? previous?.camera.zoom ?? camera.zoom,
    };
    const focusChanged = Boolean(spec.focus && previous && spec.focus !== previous.focus);
    const kind = spec.transition;
    if (kind && requiresEndpoints(kind) && !(spec.from && spec.to)) {
      throw new Error(
        `Beat "${spec.name}" transition ${kind} needs both from and to element names.`
      );
    }
    const transition =
      index === 0 && !kind
        ? null
        : planBeatTransition({
            at: start,
            focusChanged,
            ...(kind ? { kind } : {}),
            ...(spec.from ? { from: spec.from } : {}),
            ...(spec.to ? { to: spec.to } : {}),
            ...(spec.easing ? { easing: spec.easing } : {}),
            ...(spec.transitionDuration !== undefined
              ? { duration: spec.transitionDuration }
              : { duration: Math.min(0.9, duration * 0.3) }),
          });

    plans.push({
      name: spec.name,
      index,
      start: round(start),
      duration: round(duration),
      end: round(start + duration),
      ...(spec.focus ? { focus: spec.focus } : {}),
      ...(spec.label ? { label: spec.label } : {}),
      camera: { x: round(next.x), y: round(next.y), zoom: round(next.zoom) },
      transition,
      route: resolveRoute(spec, next, previous?.camera ?? options.camera),
    });
    camera = next;
    cursor = start + duration;
  }

  return plans;
}

/**
 * Lower beats into AST nodes: camera moves plus planned transitions.
 *
 * No scene roots, no clearing animations, no global fades — the persistent
 * composition is reframed rather than replaced.
 */
export function lowerBeats(plans: readonly BeatPlan[], options: BeatPlanOptions): ASTNode[] {
  const nodes: ASTNode[] = [];
  let previous = options.camera;

  for (const plan of plans) {
    const moved =
      Math.abs(plan.camera.x - previous.x) > 0.01 ||
      Math.abs(plan.camera.y - previous.y) > 0.01 ||
      Math.abs(plan.camera.zoom - previous.zoom) > 0.001;
    if (moved) {
      const duration = Math.min(1.3, Math.max(0.5, plan.duration * 0.4));
      const move: AnimationNode = {
        type: 'Animation',
        target: 'camera',
        from: { x: previous.x, y: previous.y, zoom: previous.zoom },
        to: { x: plan.camera.x, y: plan.camera.y, zoom: plan.camera.zoom },
        keyframes: [],
        delay: plan.start,
        duration: round(duration),
        easing: plan.transition?.kind === 'cameraMove' ? plan.transition.easing : 'sine.inOut',
      };
      nodes.push(move);
      previous = plan.camera;
    }
    if (plan.transition) {
      nodes.push(...lowerBeatTransition(plan.transition, `${plan.name}__transition`));
    }
  }

  return nodes;
}

/** Beat start times by name, used to resolve `beat NAME` entrance delays. */
export function beatStarts(plans: readonly BeatPlan[]): Map<string, number> {
  return new Map(plans.map((plan) => [plan.name, plan.start]));
}

/**
 * Resolve the route, validating an authored one against what the beat actually
 * contains. A route is a claim about how the beat performs; if the content cannot
 * support the claim, that is a planning bug worth failing on rather than a frame
 * that quietly sits still.
 */
function resolveRoute(spec: BeatSpec, camera: CameraFraming, previous: CameraFraming): BeatRoute {
  const moves =
    Math.abs(camera.x - previous.x) > 0.01 ||
    Math.abs(camera.y - previous.y) > 0.01 ||
    Math.abs(camera.zoom - previous.zoom) > 0.001;
  const attachments = spec.attachments ?? 0;

  if (!spec.route) {
    if (moves) return 'cameraIntent';
    if (attachments >= 2) return 'stagedReveals';
    return 'hold';
  }

  if (spec.route === 'cameraIntent' && !moves && !spec.focus) {
    throw new Error(
      `Beat "${spec.name}" claims route cameraIntent but never moves the camera. Give it zoom, cameraX/cameraY, or focus — or pick another route.`
    );
  }
  if (spec.route === 'stagedReveals' && attachments < 2) {
    const subject = attachments === 1 ? '1 block attaches' : `${attachments} blocks attach`;
    throw new Error(
      `Beat "${spec.name}" claims route stagedReveals but only ${subject} to it. Staged reveals need at least two things to pay off in sequence.`
    );
  }
  return spec.route;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

/** Prompt text describing the beat contract to the AI. */
export function beatPrompt(): string {
  return [
    'Beats replace disconnected scenes. A beat is a change in focus, never a slide:',
    '- beat NAME { start 4s duration 6s focus subjectId zoom 1.3 route cameraIntent label "Product reveal" }',
    '- Beats never clear the composition. Objects persist and transform across beats.',
    '- Omit start to run beats back to back; omit duration to split the canvas evenly.',
    '- Attach content to a beat with beat NAME on a layout, showcase, component, text, or image; its entrance delay resolves from the beat start.',
    '- focus plus zoom reframes the persistent composition with a camera move.',
    '- Every beat is owned by one sustained-motion route: stagedReveals, cameraIntent, uiLife, sequence, cursorLed, or hold.',
    '- Idle drift (float, breathe, glow pulse) is NOT sustained motion. A beat with time left after its entrance needs more story, not wobble.',
    `- Schedule ${STILLNESS_BEFORE_CLIMAX.min}-${STILLNESS_BEFORE_CLIMAX.max}s of stillness between a major action and its result.`,
  ].join('\n');
}
