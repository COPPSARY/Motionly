import type { Clip } from '../types/scene';

export type ClipTiming = Pick<Clip, 'start' | 'duration' | 'trimIn' | 'trimOut'>;

const DEFAULT_MINIMUM_DURATION = 1 / 60;

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
 */
export function trimClipStart(
  input: ClipTiming,
  requestedStart: number,
  minimum = DEFAULT_MINIMUM_DURATION
): ClipTiming {
  const clip = normalized(input);
  const min = Math.min(clip.duration, minimumDuration(minimum));
  const requestedDelta = finite(requestedStart, clip.start) - clip.start;
  const delta = Math.min(clip.duration - min, Math.max(-clip.trimIn, requestedDelta));
  return {
    ...clip,
    start: clip.start + delta,
    duration: clip.duration - delta,
    trimIn: clip.trimIn + delta,
  };
}

/**
 * Move the right timeline edge. Extending consumes trimOut; shortening adds it.
 * duration + trimOut remains constant.
 */
export function trimClipEnd(
  input: ClipTiming,
  requestedEnd: number,
  minimum = DEFAULT_MINIMUM_DURATION
): ClipTiming {
  const clip = normalized(input);
  const min = Math.min(clip.duration, minimumDuration(minimum));
  const currentEnd = clip.start + clip.duration;
  const requestedDelta = finite(requestedEnd, currentEnd) - currentEnd;
  const delta = Math.min(clip.trimOut, Math.max(min - clip.duration, requestedDelta));
  return {
    ...clip,
    duration: clip.duration + delta,
    trimOut: clip.trimOut - delta,
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
