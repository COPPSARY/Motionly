import { describe, expect, it } from 'vitest';
import {
  packClipTrackLanes,
  packTimelineLanes,
  combinePersistentTrackRows,
} from '../../src/ui/timeline-lanes';
import type { Element } from '../../src/types/scene';

const element = (id: string, kind: Element['kind']): Element => ({ id, kind }) as Element;

describe('timeline lane packing', () => {
  it('keeps source-stable element layers regardless of timing', () => {
    const ranges = new Map([
      ['textOne', { start: 0, end: 2 }],
      ['textTwo', { start: 2, end: 4 }],
      ['textOverlap', { start: 1, end: 3 }],
      ['imageOne', { start: 0, end: 2 }],
      ['imageTwo', { start: 2, end: 4 }],
    ]);
    const lanes = packTimelineLanes(
      [
        element('textOne', 'text'),
        element('textTwo', 'text'),
        element('textOverlap', 'text'),
        element('imageOne', 'asset'),
        element('imageTwo', 'asset'),
      ],
      (id) => ranges.get(id)!
    );

    expect(lanes.map((lane) => [lane.kind, lane.trackId])).toEqual([
      ['text', 'legacy-textOne'],
      ['text', 'legacy-textTwo'],
      ['text', 'legacy-textOverlap'],
      ['asset', 'legacy-imageOne'],
      ['asset', 'legacy-imageTwo'],
    ]);
    expect(lanes.map((lane) => lane.items.map((item) => item.element.id))).toEqual([
      ['textOne'],
      ['textTwo'],
      ['textOverlap'],
      ['imageOne'],
      ['imageTwo'],
    ]);
    expect(lanes.every((lane) => lane.laneCount === 1)).toBe(true);
  });
});

describe('clip track lane packing', () => {
  it('stacks same-track overlaps and reuses a lane for adjacent clips', () => {
    const clip = (id: string, track: number, start: number, duration: number) =>
      ({ id, track, start, duration }) as import('../../src/types/scene').Clip;
    const tracks = packClipTrackLanes([
      clip('one', 1, 0, 2),
      clip('overlap', 1, 1, 2),
      clip('adjacent', 1, 2, 1),
      clip('upper', 2, 0, 1),
    ]);

    expect(tracks.map((track) => track.track)).toEqual([2, 1]);
    expect(tracks[1]?.laneCount).toBe(2);
    expect(tracks[1]?.clips.map(({ clip: item, lane }) => [item.id, lane])).toEqual([
      ['one', 0],
      ['overlap', 1],
      ['adjacent', 0],
    ]);
  });
});

describe('persistent clip track rows', () => {
  it('includes empty persistent tracks in authored order', () => {
    const persistent = [
      {
        id: 'main',
        label: 'Main',
        role: 'main',
        content: 'primary',
        hidden: false,
        muted: false,
        order: 0,
        declared: true,
      },
      {
        id: 'text',
        label: 'Text',
        role: 'overlay',
        content: 'text',
        hidden: false,
        muted: false,
        order: 1,
        declared: true,
      },
      {
        id: 'top',
        label: 'Top',
        role: 'overlay',
        content: 'image',
        hidden: false,
        muted: false,
        order: 2,
        declared: true,
      },
      {
        id: 'audio',
        label: 'Audio',
        role: 'audio',
        content: 'audio',
        hidden: false,
        muted: false,
        order: 3,
        declared: true,
      },
    ] as import('../../src/types/scene').Track[];
    const tracks = packClipTrackLanes([], persistent);
    expect(tracks.map((track) => track.track)).toEqual(['main', 'text', 'top', 'audio']);
    expect(tracks.every((track) => track.clips.length === 0)).toBe(true);
  });
});

describe('combined timeline row reconciliation', () => {
  it('preserves non-overlapping regular elements and media clips in one declared mixed row', () => {
    const persistent = [
      {
        id: 'main',
        label: 'Main',
        role: 'main',
        content: 'primary',
        hidden: false,
        muted: false,
        order: 0,
        declared: true,
      },
      {
        id: 'titles',
        label: 'Titles',
        role: 'overlay',
        content: 'mixed',
        hidden: false,
        muted: false,
        order: 1,
        declared: true,
      },
    ] as import('../../src/types/scene').Track[];
    const title = {
      ...element('title', 'text'),
      properties: { track: 'titles' },
    } as Element;
    const elementRows = packTimelineLanes([title], () => ({ start: 0, end: 2 }));
    const media = {
      id: 'clip_image_0',
      assetName: 'image',
      track: 'titles',
      start: 2,
      duration: 2,
    } as import('../../src/types/scene').Clip;
    const combined = combinePersistentTrackRows(
      packClipTrackLanes([media], persistent),
      elementRows
    );
    expect(combined.elementLanes).toEqual([]);
    const titles = combined.clipTracks.find((row) => row.track === 'titles');
    expect(titles?.elements.map(({ item }) => item.element.id)).toEqual(['title']);
    expect(titles?.clips.map(({ clip }) => clip.id)).toEqual(['clip_image_0']);
    expect(titles?.laneCount).toBe(1);
  });
});
