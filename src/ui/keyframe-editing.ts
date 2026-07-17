import type { KeyframeNode } from '../types/parser';

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function sorted(frames: KeyframeNode[]): KeyframeNode[] {
  return [...frames].sort((a, b) => a.offset - b.offset);
}

export function seedKeyframes(
  frames: KeyframeNode[] | undefined,
  from: Record<string, unknown> = {},
  to: Record<string, unknown> = {}
): KeyframeNode[] {
  if (frames?.length)
    return frames.map((frame) => ({ ...frame, properties: { ...frame.properties } }));
  return [
    { offset: 0, properties: { ...from } },
    { offset: 1, properties: { ...to } },
  ];
}

export function upsertKeyframe(
  frames: KeyframeNode[],
  offset: number,
  properties: Record<string, unknown>,
  tolerance = 1e-6
): KeyframeNode[] {
  const nextOffset = clampOffset(offset);
  const existing = frames.find((frame) => Math.abs(frame.offset - nextOffset) <= tolerance);
  if (existing) {
    return sorted(
      frames.map((frame) =>
        frame === existing
          ? { ...frame, offset: nextOffset, properties: { ...frame.properties, ...properties } }
          : { ...frame, properties: { ...frame.properties } }
      )
    );
  }
  return sorted([...frames, { offset: nextOffset, properties: { ...properties } }]);
}

/** Set the easing that governs the transition into the keyframe at `offset`. */
export function setKeyframeEasing(
  frames: KeyframeNode[],
  offset: number,
  easing: string,
  tolerance = 1e-6
): KeyframeNode[] {
  return frames.map((frame) =>
    Math.abs(frame.offset - offset) <= tolerance
      ? { ...frame, properties: { ...frame.properties }, easing: easing || undefined }
      : { ...frame, properties: { ...frame.properties } }
  );
}

export function moveKeyframe(
  frames: KeyframeNode[],
  previousOffset: number,
  nextOffset: number,
  tolerance = 1e-6
): KeyframeNode[] {
  const index = frames.findIndex((frame) => Math.abs(frame.offset - previousOffset) <= tolerance);
  if (index < 0) return frames;
  const moved = frames.map((frame, frameIndex) =>
    frameIndex === index
      ? { ...frame, offset: clampOffset(nextOffset), properties: { ...frame.properties } }
      : { ...frame, properties: { ...frame.properties } }
  );
  return sorted(moved);
}

export function removeKeyframe(
  frames: KeyframeNode[],
  offset: number,
  tolerance = 1e-6
): KeyframeNode[] {
  return frames
    .filter((frame) => Math.abs(frame.offset - offset) > tolerance)
    .map((frame) => ({ ...frame, properties: { ...frame.properties } }));
}
