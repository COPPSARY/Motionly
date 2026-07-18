import { describe, expect, it } from 'vitest';
import {
  extractAudioPeaks,
  MAX_WAVEFORM_BUCKETS,
  waveformBucketCount,
  waveformPath,
} from '../../src/ui/audio-waveform';

describe('audio waveform', () => {
  it('extracts normalized peaks across audio channels', async () => {
    const peaks = await extractAudioPeaks(
      [new Float32Array([-0.25, 0.5, -1, 0.75]), new Float32Array([-0.5, 0.25, -0.75, 1])],
      2
    );

    expect(peaks).toEqual([
      { min: -0.5, max: 0.5 },
      { min: -1, max: 1 },
    ]);
  });

  it('handles silence, cancellation, and bounded long files', async () => {
    expect(await extractAudioPeaks([new Float32Array(8)], 4)).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 0 },
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ]);
    expect(await extractAudioPeaks([new Float32Array([1])], 1, () => true)).toEqual([]);
    expect(waveformBucketCount(0)).toBe(64);
    expect(waveformBucketCount(10_000)).toBe(MAX_WAVEFORM_BUCKETS);
  });

  it('creates one scalable filled SVG path', () => {
    const path = waveformPath([
      { min: -1, max: 1 },
      { min: -0.5, max: 0.5 },
    ]);

    expect(path).toMatch(/^M/);
    expect(path).toContain('L');
    expect(path).toMatch(/Z$/);
  });
});
