import type { Clip, Scene } from '../types/scene';

/** The subset of a clip that decides what its audio should be doing. */
export type AudioClipTiming = Pick<
  Clip,
  'id' | 'assetName' | 'start' | 'duration' | 'trimIn' | 'fadeIn' | 'fadeOut' | 'speed'
> & { volume?: number; mute?: boolean };

/** What one audio source should be doing at a given project time. */
export interface AudioCue {
  id: string;
  assetName: string;
  /** True while the playhead is inside the clip window. */
  active: boolean;
  /** Offset into the source file, in source seconds. */
  sourceTime: number;
  /** Linear gain after volume, mute, and both fades. */
  gain: number;
  speed: number;
}

const MINIMUM_SPEED = 0.0625;
const MAXIMUM_SPEED = 16;

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp to the range browsers actually accept for `playbackRate`. */
export function normalizeSpeed(value: number | undefined): number {
  const speed = finite(value, 1);
  if (speed <= 0) return 1;
  return Math.min(MAXIMUM_SPEED, Math.max(MINIMUM_SPEED, speed));
}

/** Preserve the played source segment while changing its timeline length. */
export function retimedClipDuration(
  duration: number,
  previousSpeed: number | undefined,
  nextSpeed: number | undefined
): number {
  return (
    (Math.max(0, finite(duration, 0)) * normalizeSpeed(previousSpeed)) / normalizeSpeed(nextSpeed)
  );
}

export function isAudioClip(clip: Clip): boolean {
  return clip.asset?.type === 'audio';
}

export function audioClipsOf(scene: Scene | null | undefined): Clip[] {
  return (scene?.clips ?? []).filter(isAudioClip);
}

/**
 * Gain for a clip at a project time: silent outside its window, otherwise its
 * volume shaped by the head and tail fades. Overlapping fades multiply, so a
 * clip shorter than both still rises and falls smoothly instead of clicking.
 */
export function clipGainAt(clip: AudioClipTiming, time: number): number {
  const start = Math.max(0, finite(clip.start, 0));
  const duration = Math.max(0, finite(clip.duration, 0));
  const end = start + duration;
  if (!Number.isFinite(time) || time < start || time >= end) return 0;
  if (clip.mute) return 0;

  let gain = Math.max(0, finite(clip.volume, 1));
  const fadeIn = Math.max(0, finite(clip.fadeIn, 0));
  const fadeOut = Math.max(0, finite(clip.fadeOut, 0));
  if (fadeIn > 0) gain *= Math.min(1, (time - start) / fadeIn);
  if (fadeOut > 0) gain *= Math.min(1, (end - time) / fadeOut);
  return gain;
}

/** Where in the source file a clip is at a project time, in source seconds. */
export function clipSourceTimeAt(clip: AudioClipTiming, time: number): number {
  const start = Math.max(0, finite(clip.start, 0));
  const trimIn = Math.max(0, finite(clip.trimIn, 0));
  return Math.max(0, trimIn + (time - start) * normalizeSpeed(clip.speed));
}

/**
 * One cue per clip describing the state its audio element should be in. The
 * caller applies these to real elements; keeping the decision pure makes the
 * scheduling testable without the DOM.
 */
export function audioCuesAt(clips: readonly AudioClipTiming[], time: number): AudioCue[] {
  return clips.map((clip) => {
    const start = Math.max(0, finite(clip.start, 0));
    const end = start + Math.max(0, finite(clip.duration, 0));
    const active = Number.isFinite(time) && time >= start && time < end;
    return {
      id: clip.id,
      assetName: clip.assetName,
      active,
      sourceTime: clipSourceTimeAt(clip, time),
      gain: clipGainAt(clip, time),
      speed: normalizeSpeed(clip.speed),
    };
  });
}

/**
 * Largest fade that fits a clip. Both fades together may not exceed the clip,
 * so widening one squeezes the other rather than running past the end.
 */
export function maximumFade(clip: AudioClipTiming, edge: 'fadeIn' | 'fadeOut'): number {
  const duration = Math.max(0, finite(clip.duration, 0));
  const other = Math.max(0, finite(edge === 'fadeIn' ? clip.fadeOut : clip.fadeIn, 0));
  return Math.max(0, duration - Math.min(other, duration));
}

/** Convert a linear gain to decibels for display. Silence reads as -Infinity. */
export function gainToDecibels(gain: number): number {
  const value = Math.max(0, finite(gain, 1));
  return value <= 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(value);
}

export function decibelsToGain(decibels: number): number {
  if (!Number.isFinite(decibels)) return decibels < 0 ? 0 : 1;
  return 10 ** (decibels / 20);
}
