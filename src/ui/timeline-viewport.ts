export const MIN_TIMELINE_ZOOM = 0.25;
export const MAX_TIMELINE_ZOOM = 8;
export const BASE_PIXELS_PER_SECOND = 100;

export function clampTimelineZoom(zoom: number): number {
  const finite = Number.isFinite(zoom) ? zoom : 1;
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, finite));
}

export function timelinePixelsPerSecond(zoom: number): number {
  return BASE_PIXELS_PER_SECOND * clampTimelineZoom(zoom);
}

export function quantizeTimelineTime(time: number, duration: number, fps: number): number {
  const safeDuration = Math.max(0, duration);
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 60;
  const clamped = Math.max(0, Math.min(safeDuration, time));
  return Math.min(safeDuration, Math.round(clamped * safeFps) / safeFps);
}

export function playbackTimeFromClock(
  startTime: number,
  startedAtMs: number,
  nowMs: number,
  duration: number
): number {
  const elapsed = Math.max(0, nowMs - startedAtMs) / 1000;
  return Math.min(Math.max(0, duration), Math.max(0, startTime) + elapsed);
}

export function timelineContentWidth(
  duration: number,
  zoom: number,
  viewportWidth: number
): number {
  return Math.max(
    Math.max(1, viewportWidth),
    Math.max(0, duration) * timelinePixelsPerSecond(zoom)
  );
}

export function timelineTimeAtX(contentX: number, duration: number, contentWidth: number): number {
  if (contentWidth <= 0) return 0;
  return Math.min(Math.max(0, duration), Math.max(0, (contentX / contentWidth) * duration));
}

export function timelineXAtTime(time: number, duration: number, contentWidth: number): number {
  if (duration <= 0) return 0;
  return (Math.min(duration, Math.max(0, time)) / duration) * contentWidth;
}

/** Preserve the time below an anchor point while changing timeline zoom. */
export function anchoredTimelineScroll(
  oldScrollLeft: number,
  anchorViewportX: number,
  oldContentWidth: number,
  newContentWidth: number,
  viewportWidth: number
): number {
  const anchorContentX = oldScrollLeft + Math.max(0, anchorViewportX);
  const ratio = oldContentWidth > 0 ? anchorContentX / oldContentWidth : 0;
  const requested = ratio * newContentWidth - anchorViewportX;
  return Math.min(Math.max(0, newContentWidth - viewportWidth), Math.max(0, requested));
}
