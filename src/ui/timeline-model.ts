import type { AnimationNode, KeyframeNode } from '../types/parser';

export const TIMELINE_SNAP_THRESHOLD_PX = 6;

export function keyframeOffsetAtTime(time: number, animation: AnimationNode): number {
  const delay = finite(animation.delay, 0);
  const duration = Math.max(0.001, finite(animation.duration, 1));
  return clamp((time - delay) / duration, 0, 1);
}

export function upsertKeyframe(
  animation: AnimationNode,
  offset: number,
  properties: Record<string, unknown>
): KeyframeNode[] {
  const normalized = clamp(offset, 0, 1);
  const frames = cloneKeyframes(animation.keyframes ?? []);
  const existing = frames.find((frame) => Math.abs(frame.offset - normalized) < 0.0005);
  if (existing) existing.properties = { ...existing.properties, ...properties };
  else frames.push({ offset: normalized, properties: { ...properties } });
  return sortKeyframes(frames);
}

export function moveKeyframe(
  keyframes: KeyframeNode[],
  currentOffset: number,
  nextOffset: number
): KeyframeNode[] {
  const frames = cloneKeyframes(keyframes);
  const frame = closestKeyframe(frames, currentOffset);
  if (!frame) return frames;
  frame.offset = clamp(nextOffset, 0, 1);
  return sortKeyframes(frames);
}

export function removeKeyframe(keyframes: KeyframeNode[], offset: number): KeyframeNode[] {
  const frame = closestKeyframe(keyframes, offset);
  if (!frame) return cloneKeyframes(keyframes);
  return cloneKeyframes(keyframes).filter((candidate) => candidate.offset !== frame.offset);
}

export function snapTimelineTime(options: {
  time: number;
  totalDuration: number;
  laneWidth: number;
  playhead: number;
  ownTargets?: number[];
}): number {
  const { totalDuration, laneWidth, playhead } = options;
  const time = clamp(options.time, 0, totalDuration);
  const threshold = (TIMELINE_SNAP_THRESHOLD_PX / Math.max(1, laneWidth)) * totalDuration;
  const targets = [0, totalDuration, playhead, ...(options.ownTargets ?? [])].map((target) =>
    clamp(target, 0, totalDuration)
  );
  const nearest = targets.reduce<{ target: number; distance: number } | null>((best, target) => {
    const distance = Math.abs(time - target);
    return !best || distance < best.distance ? { target, distance } : best;
  }, null);
  return nearest && nearest.distance <= threshold ? nearest.target : time;
}

export function snapClipStart(options: {
  start: number;
  duration: number;
  totalDuration: number;
  laneWidth: number;
  playhead: number;
}): number {
  const maxStart = Math.max(0, options.totalDuration - options.duration);
  const start = clamp(options.start, 0, maxStart);
  const threshold =
    (TIMELINE_SNAP_THRESHOLD_PX / Math.max(1, options.laneWidth)) * options.totalDuration;
  const deltas = [
    -start,
    options.totalDuration - (start + options.duration),
    options.playhead - start,
    options.playhead - (start + options.duration),
  ];
  const delta = deltas.reduce((best, candidate) =>
    Math.abs(candidate) < Math.abs(best) ? candidate : best
  );
  return Math.abs(delta) <= threshold ? clamp(start + delta, 0, maxStart) : start;
}

function closestKeyframe(keyframes: KeyframeNode[], offset: number): KeyframeNode | undefined {
  return keyframes.reduce<KeyframeNode | undefined>(
    (best, frame) =>
      !best || Math.abs(frame.offset - offset) < Math.abs(best.offset - offset) ? frame : best,
    undefined
  );
}

function cloneKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  return keyframes.map((frame) => ({ offset: frame.offset, properties: { ...frame.properties } }));
}

function sortKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  return keyframes.sort((left, right) => left.offset - right.offset);
}

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
