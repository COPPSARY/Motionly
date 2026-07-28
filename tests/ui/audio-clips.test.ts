import { describe, expect, it } from 'vitest';
import {
  audioCuesAt,
  clipGainAt,
  clipSourceTimeAt,
  decibelsToGain,
  gainToDecibels,
  maximumFade,
  normalizeSpeed,
  retimedClipDuration,
  type AudioClipTiming,
} from '../../src/ui/audio-clips';

const clip = (overrides: Partial<AudioClipTiming> = {}): AudioClipTiming => ({
  id: 'clip_music_0',
  assetName: 'music',
  start: 2,
  duration: 4,
  trimIn: 0,
  fadeIn: 0,
  fadeOut: 0,
  speed: 1,
  volume: 1,
  mute: false,
  ...overrides,
});

describe('audio clip scheduling', () => {
  it('is silent outside its own window', () => {
    const music = clip();
    expect(clipGainAt(music, 1.9)).toBe(0);
    expect(clipGainAt(music, 2)).toBe(1);
    expect(clipGainAt(music, 5.9)).toBe(1);
    // The end is exclusive so touching clips never double up on the cut.
    expect(clipGainAt(music, 6)).toBe(0);
  });

  it('ramps through the head and tail fades', () => {
    const music = clip({ fadeIn: 1, fadeOut: 2 });
    expect(clipGainAt(music, 2)).toBe(0);
    expect(clipGainAt(music, 2.5)).toBeCloseTo(0.5);
    expect(clipGainAt(music, 3)).toBe(1);
    expect(clipGainAt(music, 5)).toBeCloseTo(0.5);
    expect(clipGainAt(music, 5.5)).toBeCloseTo(0.25);
  });

  it('scales fades by the clip volume and silences a muted clip', () => {
    expect(clipGainAt(clip({ volume: 0.5, fadeIn: 2 }), 3)).toBeCloseTo(0.25);
    expect(clipGainAt(clip({ volume: 0.5 }), 3)).toBeCloseTo(0.5);
    expect(clipGainAt(clip({ volume: 1, mute: true }), 3)).toBe(0);
  });

  it('multiplies overlapping fades instead of running past the clip', () => {
    // 3s of fade in and 3s of fade out inside a 4s clip: the middle dips
    // rather than either ramp reaching full level.
    const squeezed = clip({ fadeIn: 3, fadeOut: 3 });
    expect(clipGainAt(squeezed, 4)).toBeCloseTo((2 / 3) * (2 / 3));
    expect(clipGainAt(squeezed, 2)).toBe(0);
    expect(clipGainAt(squeezed, 5.99)).toBeCloseTo(0, 1);
  });

  it('maps project time onto the trimmed source, honoring speed', () => {
    expect(clipSourceTimeAt(clip({ trimIn: 10 }), 3)).toBe(11);
    expect(clipSourceTimeAt(clip({ trimIn: 10, speed: 2 }), 3)).toBe(12);
    expect(clipSourceTimeAt(clip(), 0)).toBe(0);
  });

  it('clamps speed to what browsers will play', () => {
    expect(normalizeSpeed(2)).toBe(2);
    expect(normalizeSpeed(0)).toBe(1);
    expect(normalizeSpeed(-3)).toBe(1);
    expect(normalizeSpeed(9000)).toBe(16);
    expect(normalizeSpeed(undefined)).toBe(1);
    expect(normalizeSpeed(Number.NaN)).toBe(1);
  });

  it('changes timeline duration while preserving the played source segment', () => {
    expect(retimedClipDuration(6, 1, 1.5)).toBe(4);
    expect(retimedClipDuration(6, 1, 0.5)).toBe(12);
    expect(retimedClipDuration(4, 2, 1)).toBe(8);
  });

  it('cues every clip so overlapping sources can play together', () => {
    const music = clip({ id: 'music', start: 0, duration: 10, fadeIn: 2 });
    const effect = clip({ id: 'sfx', assetName: 'sfx', start: 4, duration: 1, trimIn: 0.5 });
    const cues = audioCuesAt([music, effect], 4.5);

    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ id: 'music', active: true, sourceTime: 4.5, gain: 1 });
    expect(cues[1]).toMatchObject({ id: 'sfx', active: true, sourceTime: 1, gain: 1 });

    const before = audioCuesAt([music, effect], 1);
    expect(before[0]).toMatchObject({ active: true, gain: 0.5 });
    expect(before[1]).toMatchObject({ active: false, gain: 0 });
  });

  it('bounds a fade by the room the other fade leaves', () => {
    expect(maximumFade(clip({ duration: 4 }), 'fadeIn')).toBe(4);
    expect(maximumFade(clip({ duration: 4, fadeOut: 1.5 }), 'fadeIn')).toBe(2.5);
    expect(maximumFade(clip({ duration: 4, fadeOut: 9 }), 'fadeIn')).toBe(0);
  });

  it('round-trips gain through decibels', () => {
    expect(gainToDecibels(1)).toBe(0);
    expect(gainToDecibels(0.5)).toBeCloseTo(-6.02, 2);
    expect(gainToDecibels(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(decibelsToGain(0)).toBe(1);
    expect(decibelsToGain(-6.0206)).toBeCloseTo(0.5, 4);
    expect(decibelsToGain(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
