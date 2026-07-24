import type { KeyframeNode } from '../types/parser';

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function snapshot<T>(value: T): T {
  return structuredClone(value);
}

function sorted(frames: KeyframeNode[]): KeyframeNode[] {
  return [...frames].sort((a, b) => a.offset - b.offset);
}

function logEdit(operation: string, before: KeyframeNode[], after: KeyframeNode[]): void {
  const debug = globalThis as typeof globalThis & { __MOTIONLY_DEBUG_KEYFRAMES__?: boolean };
  if (!debug.__MOTIONLY_DEBUG_KEYFRAMES__) return;
  console.debug(`[Motionly keyframes] ${operation} before`, snapshot(before));
  console.debug(`[Motionly keyframes] ${operation} after`, snapshot(after));
}

export function mergeCoincidentKeyframes(frames: KeyframeNode[], tolerance = 1e-6): KeyframeNode[] {
  return sorted(snapshot(frames)).reduce<KeyframeNode[]>((merged, frame) => {
    const previous = merged[merged.length - 1];
    if (previous && Math.abs(previous.offset - frame.offset) <= tolerance) {
      previous.properties = { ...previous.properties, ...frame.properties };
      if (frame.easing) previous.easing = frame.easing;
    } else {
      merged.push(frame);
    }
    return merged;
  }, []);
}

export function animatedProperties(frames: KeyframeNode[] | undefined): string[] {
  return [...new Set((frames ?? []).flatMap((frame) => Object.keys(frame.properties)))];
}

export function keyframeOffsetAtTime(time: number, delay: number, duration: number): number {
  return clampOffset((time - delay) / Math.max(duration, 1e-6));
}

export function hasKeyframeProperties(
  frames: KeyframeNode[] | undefined,
  offset: number,
  properties: string[],
  tolerance = 1e-6
): boolean {
  const frame = frames?.find((candidate) => Math.abs(candidate.offset - offset) <= tolerance);
  return Boolean(frame && properties.every((property) => property in frame.properties));
}

export function seedKeyframes(
  frames: KeyframeNode[] | undefined,
  from: Record<string, unknown> = {},
  to: Record<string, unknown> = {}
): KeyframeNode[] {
  if (frames?.length) return snapshot(frames);
  return [
    { offset: 0, properties: snapshot(from) },
    { offset: 1, properties: snapshot(to) },
  ];
}

export function upsertKeyframe(
  frames: KeyframeNode[],
  offset: number,
  properties: Record<string, unknown>,
  tolerance = 1e-6
): KeyframeNode[] {
  const nextOffset = clampOffset(offset);
  const before = snapshot(frames);
  const next = snapshot(frames);
  const existing = next.find((frame) => Math.abs(frame.offset - nextOffset) <= tolerance);
  if (existing) {
    existing.offset = nextOffset;
    existing.properties = { ...existing.properties, ...snapshot(properties) };
  } else {
    next.push({ offset: nextOffset, properties: snapshot(properties) });
  }
  const after = sorted(next);
  logEdit(existing ? 'update' : 'add', before, after);
  return after;
}

/** Set the easing that governs the transition into the keyframe at `offset`. */
export function setKeyframeEasing(
  frames: KeyframeNode[],
  offset: number,
  easing: string,
  tolerance = 1e-6
): KeyframeNode[] {
  return snapshot(frames).map((frame) =>
    Math.abs(frame.offset - offset) <= tolerance ? { ...frame, easing: easing || undefined } : frame
  );
}

export function moveKeyframe(
  frames: KeyframeNode[],
  previousOffset: number,
  nextOffset: number,
  tolerance = 1e-6
): KeyframeNode[] {
  const moved = snapshot(frames);
  const index = moved.findIndex((frame) => Math.abs(frame.offset - previousOffset) <= tolerance);
  if (index < 0) return moved;
  const next = clampOffset(nextOffset);
  moved[index]!.offset = next;
  const collision = moved.findIndex(
    (frame, frameIndex) => frameIndex !== index && Math.abs(frame.offset - next) <= tolerance
  );
  if (collision >= 0) {
    const source = moved[index]!;
    const target = moved[collision]!;
    const merged = {
      ...target,
      properties: { ...target.properties, ...source.properties },
      ...(source.easing ? { easing: source.easing } : {}),
    };
    return sorted(
      moved
        .filter((_, frameIndex) => frameIndex !== index)
        .map((frame, frameIndex) =>
          frameIndex === (collision > index ? collision - 1 : collision) ? merged : frame
        )
    );
  }
  return sorted(moved);
}

export function removeKeyframeProperties(
  frames: KeyframeNode[],
  offset: number,
  properties: string[],
  tolerance = 1e-6
): KeyframeNode[] {
  return snapshot(frames).flatMap((frame) => {
    if (Math.abs(frame.offset - offset) > tolerance) {
      return [frame];
    }
    const remaining = { ...frame.properties };
    for (const property of properties) delete remaining[property];
    return Object.keys(remaining).length ? [{ ...frame, properties: remaining }] : [];
  });
}

export function removeKeyframe(
  frames: KeyframeNode[],
  offset: number,
  tolerance = 1e-6
): KeyframeNode[] {
  return snapshot(frames).filter((frame) => Math.abs(frame.offset - offset) > tolerance);
}
