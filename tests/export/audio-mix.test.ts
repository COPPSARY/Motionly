import { describe, expect, it } from 'vitest';
// @ts-expect-error - the export server is plain JS shipped with the CLI.
import { audioMixFilter, normalizeAudioClips } from '../../bin/ffmpeg-export.js';

const clip = (overrides: Record<string, number> = {}) => ({
  start: 0,
  duration: 4,
  trimIn: 0,
  fadeIn: 0,
  fadeOut: 0,
  volume: 1,
  speed: 1,
  ...overrides,
});

describe('export audio mixing', () => {
  it('produces no filter when the project has no sound', () => {
    expect(audioMixFilter([])).toBe('');
  });

  it('trims and delays a clip onto its timeline position', () => {
    const filter = audioMixFilter([clip({ start: 2, duration: 3, trimIn: 10 })]);
    expect(filter).toContain('[1:a]atrim=start=10.000000:end=13.000000');
    expect(filter).toContain('asetpts=PTS-STARTPTS');
    expect(filter).toContain('adelay=2000:all=1');
    // A single clip must keep its authored level rather than being halved.
    expect(filter).toContain('amix=inputs=1:normalize=0[aout]');
  });

  it('places the fade out at the clip end, not the source end', () => {
    const filter = audioMixFilter([clip({ duration: 10, fadeIn: 1, fadeOut: 2 })]);
    expect(filter).toContain('afade=t=in:st=0:d=1.000000');
    expect(filter).toContain('afade=t=out:st=8.000000:d=2.000000');
  });

  it('consumes more source when a clip is sped up', () => {
    const filter = audioMixFilter([clip({ duration: 4, speed: 2 })]);
    expect(filter).toContain('atrim=start=0.000000:end=8.000000');
    expect(filter).toContain('atempo=2.000000');
  });

  it('chains atempo past the range a single filter accepts', () => {
    expect(audioMixFilter([clip({ speed: 4 })])).toContain('atempo=2.000000,atempo=2.000000');
    expect(audioMixFilter([clip({ speed: 0.25 })])).toContain('atempo=0.500000,atempo=0.500000');
    // Exactly 1x needs no retiming at all.
    expect(audioMixFilter([clip()])).not.toContain('atempo');
  });

  it('sums every clip so sound effects layer over music', () => {
    const filter = audioMixFilter([clip(), clip({ start: 1 }), clip({ start: 2 })]);
    expect(filter).toContain('[a0][a1][a2]amix=inputs=3:normalize=0[aout]');
  });

  it('still accepts the pre-multitrack single-audio job shape', () => {
    const clips = normalizeAudioClips({ hasAudio: true, audioStart: 1.5 }, 10);
    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({ start: 1.5, duration: 8.5, volume: 1, speed: 1 });
    expect(normalizeAudioClips({}, 10)).toEqual([]);
  });

  it('never lets a clip boost above source level, matching the preview', () => {
    expect(normalizeAudioClips({ audioClips: [{ volume: 8 }] }, 10)[0].volume).toBe(1);
  });

  it('rejects a clip list large enough to exhaust ffmpeg inputs', () => {
    const audioClips = Array.from({ length: 65 }, () => ({}));
    expect(() => normalizeAudioClips({ audioClips }, 10)).toThrow(/Too many audio clips/);
  });
});
