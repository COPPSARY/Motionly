import type { AnimationNode, KeyframeNode } from '../types/parser';
import {
  keyframeOffsetAtTime as offsetAtTime,
  moveKeyframe as moveFrames,
  removeKeyframe as removeFrame,
  upsertKeyframe as upsertFrame,
} from './keyframe-editing';

export const TIMELINE_SNAP_THRESHOLD_PX = 6;

export function keyframeOffsetAtTime(time: number, animation: AnimationNode): number {
  const delay = finite(animation.delay, 0);
  const duration = Math.max(0.001, finite(animation.duration, 1));
  return offsetAtTime(time, delay, duration);
}

export function upsertKeyframe(
  animation: AnimationNode,
  offset: number,
  properties: Record<string, unknown>
): KeyframeNode[] {
  return upsertFrame(animation.keyframes ?? [], offset, properties);
}

export function moveKeyframe(
  keyframes: KeyframeNode[],
  currentOffset: number,
  nextOffset: number
): KeyframeNode[] {
  return moveFrames(keyframes, currentOffset, nextOffset);
}

export function removeKeyframe(keyframes: KeyframeNode[], offset: number): KeyframeNode[] {
  return removeFrame(keyframes, offset);
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

function finite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
