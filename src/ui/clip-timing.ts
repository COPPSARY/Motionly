import type { Clip } from '../types/scene';

export type ClipTiming = Pick<Clip, 'start' | 'duration' | 'trimIn' | 'trimOut'>;

export interface PlacedMediaClip {
  start: number;
  duration: number;
  timelineDuration: number;
}

const DEFAULT_MINIMUM_DURATION = 1 / 60;

/**
 * Timeline length given to content that carries no length of its own — stills,
 * SVG, text. Videos, GIFs, Lottie and audio bring their own duration instead.
 */
export const DEFAULT_STATIC_DURATION = 3;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function minimumDuration(value?: number): number {
  return Math.max(
    Number.EPSILON,
    finite(value ?? DEFAULT_MINIMUM_DURATION, DEFAULT_MINIMUM_DURATION)
  );
}

function normalized(clip: ClipTiming): ClipTiming {
  return {
    start: Math.max(0, finite(clip.start, 0)),
    duration: Math.max(0, finite(clip.duration, 0)),
    trimIn: Math.max(0, finite(clip.trimIn, 0)),
    trimOut: Math.max(0, finite(clip.trimOut, 0)),
  };
}

/**
 * Place imported media at full source length, extending the project instead of
 * trimming it. Sources without a length of their own (stills, SVG) get the
 * short static default rather than the whole timeline.
 */
export function placeMediaClip(
  requestedStart: number,
  sourceDuration: number,
  timelineDuration: number,
  fallbackDuration = DEFAULT_STATIC_DURATION,
  minimum = DEFAULT_MINIMUM_DURATION
): PlacedMediaClip {
  const currentTimeline = Math.max(0, finite(timelineDuration, 0));
  const start = Math.min(currentTimeline, Math.max(0, finite(requestedStart, 0)));
  const fallback = Math.max(
    minimumDuration(minimum),
    finite(fallbackDuration, DEFAULT_STATIC_DURATION)
  );
  const duration = Math.max(
    minimumDuration(minimum),
    finite(sourceDuration, 0) > 0 ? sourceDuration : fallback
  );
  return {
    start,
    duration,
    timelineDuration: Math.max(currentTimeline, start + duration),
  };
}

/** Move a clip on the project timeline without changing its source window. */
export function moveClip(
  input: ClipTiming,
  requestedStart: number,
  timelineDuration = Number.POSITIVE_INFINITY
): ClipTiming {
  const clip = normalized(input);
  const latest = Math.max(0, finite(timelineDuration, Number.POSITIVE_INFINITY));
  const start = Math.min(latest, Math.max(0, finite(requestedStart, clip.start)));
  return { ...clip, start };
}

/**
 * Move the left timeline edge. Positive deltas consume source at the beginning;
 * negative deltas restore available trimIn. trimIn + duration remains constant.
 *
 * `staticSource` marks content with no source timeline to run out of (a still,
 * an SVG): its edge moves freely back to time 0 and trimIn stays untouched.
 */
export function trimClipStart(
  input: ClipTiming,
  requestedStart: number,
  minimum = DEFAULT_MINIMUM_DURATION,
  staticSource = false
): ClipTiming {
  const clip = normalized(input);
  const min = Math.min(clip.duration, minimumDuration(minimum));
  const requestedDelta = finite(requestedStart, clip.start) - clip.start;
  const earliestDelta = staticSource ? -clip.start : -clip.trimIn;
  const delta = Math.min(clip.duration - min, Math.max(earliestDelta, requestedDelta));
  return {
    ...clip,
    start: clip.start + delta,
    duration: clip.duration - delta,
    trimIn: staticSource ? clip.trimIn : clip.trimIn + delta,
  };
}

/**
 * Move the right timeline edge. Extending consumes trimOut; shortening adds it.
 * duration + trimOut remains constant.
 *
 * `staticSource` marks content with no source timeline to run out of, so it can
 * be stretched to any length instead of being capped by the remaining trimOut.
 */
export function trimClipEnd(
  input: ClipTiming,
  requestedEnd: number,
  minimum = DEFAULT_MINIMUM_DURATION,
  staticSource = false
): ClipTiming {
  const clip = normalized(input);
  const min = Math.min(clip.duration, minimumDuration(minimum));
  const currentEnd = clip.start + clip.duration;
  const requestedDelta = finite(requestedEnd, currentEnd) - currentEnd;
  const bounded = Math.max(min - clip.duration, requestedDelta);
  const delta = staticSource ? bounded : Math.min(clip.trimOut, bounded);
  return {
    ...clip,
    duration: clip.duration + delta,
    trimOut: staticSource ? clip.trimOut : clip.trimOut - delta,
  };
}

/** Split one source window into two adjacent, non-overlapping source windows. */
export function splitClip(
  input: ClipTiming,
  playhead: number,
  minimum = DEFAULT_MINIMUM_DURATION
): [ClipTiming, ClipTiming] | null {
  const clip = normalized(input);
  const min = minimumDuration(minimum);
  const offset = finite(playhead, clip.start) - clip.start;
  if (offset < min || clip.duration - offset < min) return null;

  return [
    {
      ...clip,
      duration: offset,
      trimOut: clip.trimOut + clip.duration - offset,
    },
    {
      ...clip,
      start: clip.start + offset,
      duration: clip.duration - offset,
      trimIn: clip.trimIn + offset,
    },
  ];
}
