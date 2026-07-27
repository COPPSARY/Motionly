/**
 * Beat transition planner.
 *
 * Professional motion connects shots by transforming what is already on screen,
 * not by fading the frame. The planner turns a beat sequence into concrete
 * transition plans and lowers each plan onto mechanisms the engine already has:
 *
 * | kind          | lowers to                                                  |
 * | ------------- | ---------------------------------------------------------- |
 * | sharedElement | `transition {}` — the evaluator's shared-element machinery |
 * | objectMorph   | `transition {}` with a tighter curve on one subject         |
 * | layoutMorph   | paired group animations: outgoing recedes, incoming inherits|
 * | cameraMove    | nothing here; the beat's own camera move carries the cut    |
 * | continuous    | nothing at all; the composition simply keeps evolving       |
 * | cut           | nothing; an explicit, documented hard change               |
 *
 * Inference is deliberately conservative. `sharedElement` and `objectMorph`
 * require both endpoints to exist or the scene graph rejects the project, so
 * they are only ever produced when the author named them. When a beat merely
 * changes focus, the planner defaults to `cameraMove` — still a transformation,
 * never a fade.
 */

import type { AnimationNode, ASTNode } from '../types/parser';

export const BEAT_TRANSITION_KINDS = [
  'sharedElement',
  'objectMorph',
  'layoutMorph',
  'cameraMove',
  'continuous',
  'cut',
] as const;

export type BeatTransitionKind = (typeof BEAT_TRANSITION_KINDS)[number];

/** Kinds that need a source and destination element. */
const PAIRED = new Set<BeatTransitionKind>(['sharedElement', 'objectMorph', 'layoutMorph']);

export interface BeatTransitionPlan {
  kind: BeatTransitionKind;
  /** Absolute time the transition starts. */
  at: number;
  duration: number;
  from?: string;
  to?: string;
  easing: string;
}

export function isBeatTransitionKind(value: string): value is BeatTransitionKind {
  return (BEAT_TRANSITION_KINDS as readonly string[]).includes(value);
}

export function requiresEndpoints(kind: BeatTransitionKind): boolean {
  return PAIRED.has(kind);
}

const DEFAULT_EASING: Record<BeatTransitionKind, string> = {
  sharedElement: 'power3.inOut',
  objectMorph: 'power2.inOut',
  layoutMorph: 'power3.inOut',
  cameraMove: 'sine.inOut',
  continuous: 'sine.inOut',
  cut: 'power2.in',
};

export interface BeatTransitionRequest {
  /** Authored kind, or undefined to let the planner infer one. */
  kind?: BeatTransitionKind;
  from?: string;
  to?: string;
  easing?: string;
  duration?: number;
  /** Beat boundary the transition sits on. */
  at: number;
  /** Whether the focal subject changed across this boundary. */
  focusChanged: boolean;
}

/**
 * Choose the transition for one beat boundary.
 *
 * Authored kinds win. Otherwise: a focus change becomes a camera move, and a
 * held focus stays continuous — the composition evolves without a visual cut.
 */
export function planBeatTransition(request: BeatTransitionRequest): BeatTransitionPlan {
  const kind = request.kind ?? (request.focusChanged ? 'cameraMove' : 'continuous');
  return {
    kind,
    at: round(request.at),
    duration: round(request.duration ?? (kind === 'cut' ? 0.001 : 0.8)),
    ...(request.from ? { from: request.from } : {}),
    ...(request.to ? { to: request.to } : {}),
    easing: request.easing ?? DEFAULT_EASING[kind],
  };
}

/**
 * Lower a transition plan into AST nodes.
 *
 * `id` names the emitted transition element. Plans that ride on camera motion or
 * pure continuity emit nothing, by design.
 */
export function lowerBeatTransition(plan: BeatTransitionPlan, id: string): ASTNode[] {
  if (plan.kind === 'cameraMove' || plan.kind === 'continuous' || plan.kind === 'cut') return [];
  if (!plan.from || !plan.to) return [];

  if (plan.kind === 'layoutMorph') {
    // The outgoing arrangement recedes while the incoming one inherits its
    // scale, so cards feel rearranged rather than replaced.
    const outgoing: AnimationNode = {
      type: 'Animation',
      target: plan.from,
      from: { opacity: 1, scale: 1 },
      to: { opacity: 0, scale: 0.94 },
      keyframes: [],
      delay: plan.at,
      duration: round(plan.duration * 0.7),
      easing: plan.easing,
    };
    const incoming: AnimationNode = {
      type: 'Animation',
      target: plan.to,
      from: { opacity: 0, scale: 1.06 },
      to: { opacity: 1, scale: 1 },
      keyframes: [],
      delay: round(plan.at + plan.duration * 0.25),
      duration: round(plan.duration * 0.75),
      easing: plan.easing,
    };
    return [outgoing, incoming];
  }

  return [
    {
      type: 'Element',
      kind: 'transition',
      name: id,
      properties: {
        from: plan.from,
        to: plan.to,
        at: `${plan.at}s`,
        duration: `${plan.duration}s`,
        easing: plan.easing,
      },
    },
  ];
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

/** Prompt text describing the transition contract to the AI. */
export function transitionPrompt(): string {
  return [
    'Beat transitions (transformation, never a frame fade):',
    '- sharedElement: one element hands off to another (card expands into a detail screen). Needs from and to.',
    '- objectMorph: one subject becomes another (logo becomes product icon). Needs from and to.',
    '- layoutMorph: an arrangement rearranges into another (bento grid becomes a timeline). Needs from and to group ids.',
    '- cameraMove: the camera reframes the persistent composition. Default when focus changes.',
    '- continuous: nothing cuts; the composition keeps evolving. Default when focus is held.',
    '- cut: explicit hard change. Use rarely.',
  ].join('\n');
}
