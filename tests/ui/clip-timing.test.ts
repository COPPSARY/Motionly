import { describe, expect, it } from 'vitest';
import {
  moveClip,
  placeMediaClip,
  splitClip,
  trimClipEnd,
  trimClipStart,
  type ClipTiming,
} from '../../src/ui/clip-timing';

const clip: ClipTiming = { start: 2, duration: 4, trimIn: 1, trimOut: 2 };
const sourceSpan = (value: ClipTiming) => value.trimIn + value.duration + value.trimOut;

describe('clip timing edits', () => {
  it('places full-length media and extends the timeline instead of trimming it', () => {
    expect(placeMediaClip(4, 8, 5)).toEqual({
      start: 4,
      duration: 8,
      timelineDuration: 12,
    });
    expect(placeMediaClip(2, 0.6, 10)).toEqual({
      start: 2,
      duration: 0.6,
      timelineDuration: 10,
    });
  });

  it('uses the fallback duration only for media without an intrinsic duration', () => {
    expect(placeMediaClip(5, 0, 5, 5)).toEqual({
      start: 5,
      duration: 5,
      timelineDuration: 10,
    });
  });

  it('moves only the project range and allows the source to extend past the timeline', () => {
    expect(moveClip(clip, 8, 10)).toEqual({ ...clip, start: 8 });
    expect(moveClip(clip, -2, 10)).toEqual({ ...clip, start: 0 });
  });

  it('trims and restores the left edge without changing the source span', () => {
    const trimmed = trimClipStart(clip, 3, 0.25);
    expect(trimmed).toEqual({ start: 3, duration: 3, trimIn: 2, trimOut: 2 });
    expect(sourceSpan(trimmed)).toBe(sourceSpan(clip));

    const restored = trimClipStart(clip, 0, 0.25);
    expect(restored).toEqual({ start: 1, duration: 5, trimIn: 0, trimOut: 2 });
    expect(sourceSpan(restored)).toBe(sourceSpan(clip));
  });

  it('trims and restores the right edge without changing the source span', () => {
    const trimmed = trimClipEnd(clip, 5, 0.25);
    expect(trimmed).toEqual({ start: 2, duration: 3, trimIn: 1, trimOut: 3 });
    expect(sourceSpan(trimmed)).toBe(sourceSpan(clip));

    const restored = trimClipEnd(clip, 8, 0.25);
    expect(restored).toEqual({ start: 2, duration: 6, trimIn: 1, trimOut: 0 });
    expect(sourceSpan(restored)).toBe(sourceSpan(clip));
  });

  it('enforces a minimum duration at either edge', () => {
    expect(trimClipStart(clip, 99, 0.5).duration).toBe(0.5);
    expect(trimClipEnd(clip, -99, 0.5).duration).toBe(0.5);
  });

  it('splits into adjacent clips that partition the same source interval', () => {
    const result = splitClip(clip, 3.5, 0.25);
    expect(result).toEqual([
      { start: 2, duration: 1.5, trimIn: 1, trimOut: 4.5 },
      { start: 3.5, duration: 2.5, trimIn: 2.5, trimOut: 2 },
    ]);
    const [left, right] = result!;
    expect(left.start + left.duration).toBe(right.start);
    expect(sourceSpan(left)).toBe(sourceSpan(clip));
    expect(sourceSpan(right)).toBe(sourceSpan(clip));
  });

  it('rejects splits at or too near a clip boundary', () => {
    expect(splitClip(clip, 2, 0.25)).toBeNull();
    expect(splitClip(clip, 5.9, 0.25)).toBeNull();
  });

  it('normalizes non-finite and negative input safely', () => {
    expect(moveClip({ start: Number.NaN, duration: -2, trimIn: -1, trimOut: -1 }, 1, 5)).toEqual({
      start: 1,
      duration: 0,
      trimIn: 0,
      trimOut: 0,
    });
  });
});
