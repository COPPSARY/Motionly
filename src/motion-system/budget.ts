/**
 * Motion budget.
 *
 * The numbers the doctrine publishes, the engine enforces, and the inspector
 * checks. Kept in one dependency-free module so every consumer — the component
 * builders, the layout solver, the audit, and the AI prompt — reads the same
 * values and none of them can drift.
 */

export const MOTION_BUDGET = {
  /** Longest single entrance, in seconds. A longer buildup is a staggered group. */
  maxEntry: 0.8,
  /** Longer than this reads as drift rather than intent. */
  maxMove: 2.8,
  /** Shorter than this does not register. */
  minMove: 0.08,
  /** Longest stretch with nothing in flight, in seconds. */
  maxDeadZone: 1.4,
  /** Fraction of the smaller box that must overlap before it counts as a collision. */
  collisionRatio: 0.55,
  /** Frames sampled for geometry checks. */
  samples: 16,
  /** An exit runs this fraction of its entrance. */
  exitRatio: 0.75,
} as const;

/**
 * The dramatic comma: the pause between a major action and its result.
 * A beat that jumps straight from action to result loses the result.
 */
export const STILLNESS_BEFORE_CLIMAX = { min: 0.3, max: 0.75 } as const;

/** Shared transition values, adapted from the transitions.dev usage scale. */
export const TRANSITION_TOKENS = {
  duration: {
    stagger: 0.04,
    micro: 0.08,
    quick: 0.15,
    fast: 0.25,
    medium: 0.35,
    slow: 0.4,
    emphasis: 0.5,
  },
  easing: {
    smoothOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inOut: 'sine.inOut',
    linear: 'linear',
  },
  distance: { micro: 4, small: 6, base: 8, medium: 12, large: 30 },
  scale: { modal: 0.96, dropdown: 0.97, tooltip: 0.98, close: 0.99 },
  blur: { small: 2, medium: 3, large: 8 },
} as const;
