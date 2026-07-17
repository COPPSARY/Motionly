import { describe, expect, it } from 'vitest';
import type { Clip, Track } from '../../src/types/scene';
import {
  moveClipToTrack,
  removeClipFromTracks,
  trimClipOnTrack,
} from '../../src/ui/timeline-tracks';

const track = (id: string, role: Track['role'], content: Track['content']): Track => ({
  id,
  label: id,
  role,
  content,
  hidden: false,
  muted: false,
  order: 0,
  declared: true,
});

const clip = (id: string, start: number, duration: number, trackId = 'main'): Clip => ({
  id,
  assetName: id,
  asset: { name: id, path: `/${id}.mp4`, type: 'video' },
  track: trackId,
  start,
  duration,
  trimIn: 0,
  trimOut: 2,
  transitionInDuration: 0,
  transitionOutDuration: 0,
  sourceOrder: 0,
});

describe('uniform timeline layers', () => {
  it('moves freely across incompatible roles, preserves overlaps, and never ripples siblings', () => {
    const clips = [clip('a', 0, 3), clip('b', 3, 2), clip('c', 5, 1)];
    const textLayer = track('text', 'overlay', 'text');
    const moved = moveClipToTrack(clips, 'b', textLayer, 1, 10)!;

    expect(moved.find(({ id }) => id === 'b')).toMatchObject({ track: 'text', start: 1 });
    expect(moved.find(({ id }) => id === 'a')?.start).toBe(0);
    expect(moved.find(({ id }) => id === 'c')?.start).toBe(5);

    const fullLength = clip('full', 0, 10);
    expect(moveClipToTrack([fullLength], 'full', textLayer, 4, 10)?.[0]).toMatchObject({
      track: 'text',
      start: 4,
      duration: 10,
    });
  });

  it('deletes and trims without compacting the source layer', () => {
    const clips = [clip('a', 0, 2), clip('b', 2, 3), clip('c', 5, 1)];
    expect(removeClipFromTracks(clips, 'b').map(({ id, start }) => [id, start])).toEqual([
      ['a', 0],
      ['c', 5],
    ]);
    expect(
      trimClipOnTrack(clips, 'a', 'end', 1, 1 / 60).map(({ id, start }) => [id, start])
    ).toEqual([
      ['a', 0],
      ['b', 2],
      ['c', 5],
    ]);
  });
});
