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
