import type { Element, ElementKind } from '../types/scene';

export interface TimelineItem {
  element: Element;
  range: { start: number; end: number };
  lane: number;
}

export interface TimelineLane {
  kind: ElementKind;
  trackId: string;
  items: [TimelineItem, ...TimelineItem[]];
  start: number;
  end: number;
  laneCount: number;
}

/** Keep one stable layer per element unless the source explicitly assigns a shared track. */
export function packTimelineLanes(
  elements: Element[],
  rangeOf: (id: string) => TimelineItem['range']
): TimelineLane[] {
  const lanes: TimelineLane[] = [];
  for (const element of elements) {
    const item = { element, range: rangeOf(element.id) };
    const authoredTrack = String(
      ((item.element.properties ?? {}) as unknown as Record<string, unknown>)['track'] ?? ''
    );
    const lane = authoredTrack
      ? lanes.find((candidate) => candidate.trackId === authoredTrack)
      : undefined;
    if (lane) {
      lane.items.push({ ...item, lane: 0 });
      lane.start = Math.min(lane.start, item.range.start);
      lane.end = Math.max(lane.end, item.range.end);
      continue;
    }
    lanes.push({
      kind: item.element.kind,
      trackId: authoredTrack || `legacy-${item.element.id}`,
      items: [{ ...item, lane: 0 }],
      start: item.range.start,
      end: item.range.end,
      laneCount: 1,
    });
  }

  return lanes;
}

export interface PackedClip {
  clip: import('../types/scene').Clip;
  lane: number;
}

export interface PackedElement {
  item: TimelineItem;
  lane: number;
}

export interface PackedClipTrack {
  track: number | string;
  metadata: import('../types/scene').Track | null;
  clips: PackedClip[];
  elements: PackedElement[];
  laneCount: number;
}

/** Stack overlaps inside persistent role tracks, including declared empty tracks. */
export function packClipTrackLanes(
  clips: import('../types/scene').Clip[],
  declaredTracks: import('../types/scene').Track[] = []
): PackedClipTrack[] {
  const tracks = new Map<number | string, import('../types/scene').Clip[]>();
  for (const track of declaredTracks) tracks.set(track.id, []);
  for (const clip of clips) tracks.set(clip.track, [...(tracks.get(clip.track) ?? []), clip]);

  return Array.from(tracks, ([track, trackClips]) => {
    const laneEnds: number[] = [];
    const packed = trackClips
      .map((clip, sourceOrder) => ({ clip, sourceOrder }))
      .sort((a, b) => a.clip.start - b.clip.start || a.sourceOrder - b.sourceOrder)
      .map(({ clip }) => {
        let lane = laneEnds.findIndex((end) => end <= clip.start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = clip.start + clip.duration;
        return { clip, lane };
      });
    const metadata = declaredTracks.find((candidate) => candidate.id === String(track)) ?? null;
    return {
      track,
      metadata,
      clips: packed,
      elements: [],
      laneCount: Math.max(1, laneEnds.length),
    };
  }).sort((left, right) => {
    if (!left.metadata && !right.metadata) {
      return Number(right.track) - Number(left.track);
    }
    return trackVisualOrder(left.metadata) - trackVisualOrder(right.metadata);
  });
}

export interface CombinedTrackRows {
  clipTracks: PackedClipTrack[];
  elementLanes: TimelineLane[];
}

/** Merge authored element items into their persistent media row without dropping either item type. */
export function combinePersistentTrackRows(
  clipTracks: PackedClipTrack[],
  elementLanes: TimelineLane[]
): CombinedTrackRows {
  const persistentIds = new Set(clipTracks.map((track) => String(track.track)));
  const remainingElementLanes = elementLanes.filter((lane) => !persistentIds.has(lane.trackId));
  const combined = clipTracks.map((track) => {
    const matchingElements = elementLanes
      .filter((lane) => lane.trackId === String(track.track))
      .flatMap((lane) => lane.items);
    if (matchingElements.length === 0) return track;

    const entries = [
      ...track.clips.map(({ clip }) => ({
        type: 'clip' as const,
        id: clip.id,
        start: clip.start,
        end: clip.start + clip.duration,
      })),
      ...matchingElements.map((item) => ({
        type: 'element' as const,
        id: item.element.id,
        start: item.range.start,
        end: item.range.end,
      })),
    ].sort((left, right) => left.start - right.start || left.end - right.end);
    const laneEnds: number[] = [];
    const assignments = new Map<string, number>();
    for (const entry of entries) {
      let lane = laneEnds.findIndex((end) => end <= entry.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = entry.end;
      assignments.set(`${entry.type}:${entry.id}`, lane);
    }
    return {
      ...track,
      clips: track.clips.map(({ clip }) => ({
        clip,
        lane: assignments.get(`clip:${clip.id}`) ?? 0,
      })),
      elements: matchingElements.map((item) => ({
        item,
        lane: assignments.get(`element:${item.element.id}`) ?? 0,
      })),
      laneCount: Math.max(1, laneEnds.length),
    };
  });
  return { clipTracks: combined, elementLanes: remainingElementLanes };
}

function trackVisualOrder(track: import('../types/scene').Track | null): number {
  if (!track) return 9000;
  if (track.role === 'audio') return 1_000_000;
  return track.order;
}
