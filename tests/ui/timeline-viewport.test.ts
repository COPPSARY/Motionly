import { describe, expect, it } from 'vitest';
import {
  anchoredTimelineScroll,
  clampTimelineZoom,
  timelineContentWidth,
  timelineTimeAtX,
  timelineXAtTime,
  quantizeTimelineTime,
  playbackTimeFromClock,
} from '../../src/ui/timeline-viewport';

describe('timeline viewport math', () => {
  it('clamps zoom and expands beyond the viewport', () => {
    expect(clampTimelineZoom(0)).toBe(0.25);
    expect(clampTimelineZoom(99)).toBe(8);
    expect(timelineContentWidth(10, 2, 500)).toBe(2000);
    expect(timelineContentWidth(2, 1, 500)).toBe(500);
  });

  it('round-trips timeline coordinates', () => {
    expect(timelineXAtTime(2.5, 10, 1000)).toBe(250);
    expect(timelineTimeAtX(250, 10, 1000)).toBe(2.5);
  });

  it('preserves the anchored timeline point while zooming', () => {
    expect(anchoredTimelineScroll(200, 100, 1000, 2000, 500)).toBe(500);
  });

  it('quantizes playhead time to exact frames', () => {
    expect(quantizeTimelineTime(1.234, 5, 30)).toBe(37 / 30);
    expect(quantizeTimelineTime(9, 5, 60)).toBe(5);
  });

  it('keeps playback on the absolute clock when frames are delayed', () => {
    expect(playbackTimeFromClock(2, 1_000, 2_750, 10)).toBe(3.75);
    expect(playbackTimeFromClock(9, 1_000, 5_000, 10)).toBe(10);
  });
});
