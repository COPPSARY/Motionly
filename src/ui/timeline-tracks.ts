import type { Clip, Track } from '../types/scene';
import { moveClip, trimClipEnd, trimClipStart, type ClipTiming } from './clip-timing';

/** Move a clip freely. Track metadata never changes editing behavior. */
export function moveClipToTrack(
  clips: Clip[],
  clipId: string,
  targetTrack: Track,
  requestedStart: number,
  timelineDuration: number
): Clip[] | null {
  const moving = clips.find((clip) => clip.id === clipId);
  if (!moving) return null;
  const moved = { ...moving, track: targetTrack.id };
  const timing = moveClip(moved, requestedStart, timelineDuration);
  return clips.map((clip) => (clip.id === clipId ? { ...moved, ...timing } : clip));
}

export function removeClipFromTracks(clips: Clip[], clipId: string): Clip[] {
  return clips.filter((clip) => clip.id !== clipId);
}

export function trimClipOnTrack(
  clips: Clip[],
  clipId: string,
  edge: 'start' | 'end',
  requestedTime: number,
  minimum: number
): Clip[] {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    const timing =
      edge === 'start'
        ? trimClipStart(clip as ClipTiming, requestedTime, minimum)
        : trimClipEnd(clip as ClipTiming, requestedTime, minimum);
    return { ...clip, ...timing };
  });
}
