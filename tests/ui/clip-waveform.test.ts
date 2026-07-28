import { describe, expect, it } from 'vitest';
import type { LoadedAsset } from '../../src/assets/asset-loader';
import { clipWaveform } from '../../src/ui/components/motion-editor/helpers';

/** 100 peaks over a 10s file, so one peak is one tenth of a second. */
function audio(overrides: Partial<Record<string, unknown>> = {}): LoadedAsset {
  return {
    motionlyType: 'audio',
    motionlyDuration: 10,
    motionlyPeaks: Array.from({ length: 100 }, (_, index) => ({
      min: -index / 100,
      max: index / 100,
    })),
    ...overrides,
  } as unknown as LoadedAsset;
}

const clip = (overrides: Record<string, number> = {}) => ({
  trimIn: 0,
  duration: 10,
  speed: 1,
  ...overrides,
});

describe('timeline waveform', () => {
  it('draws only the trimmed portion of the source', () => {
    expect(clipWaveform(audio(), clip())?.width).toBe(100);
    expect(clipWaveform(audio(), clip({ duration: 5 }))?.width).toBe(50);
    expect(clipWaveform(audio(), clip({ trimIn: 2, duration: 3 }))?.width).toBe(30);
  });

  it('covers more source when the clip is sped up', () => {
    // 4s of timeline at 2x plays 8s of source, so the bar shows 80 peaks.
    expect(clipWaveform(audio(), clip({ duration: 4, speed: 2 }))?.width).toBe(80);
    expect(clipWaveform(audio(), clip({ duration: 4, speed: 0.5 }))?.width).toBe(20);
  });

  it('stops at the end of the source rather than overrunning the peaks', () => {
    expect(clipWaveform(audio(), clip({ duration: 30 }))?.width).toBe(100);
    expect(clipWaveform(audio(), clip({ trimIn: 9, duration: 30 }))?.width).toBe(10);
  });

  it('returns nothing until the peaks have decoded', () => {
    // This is the state a freshly dropped clip is in; the bar renders empty
    // and must redraw once decoding finishes.
    expect(clipWaveform(audio({ motionlyPeaks: undefined }), clip())).toBeNull();
    expect(clipWaveform(audio({ motionlyDuration: 0 }), clip())).toBeNull();
  });

  it('ignores assets that are not audio', () => {
    expect(clipWaveform(undefined, clip())).toBeNull();
    expect(clipWaveform({ motionlyType: 'image' } as unknown as LoadedAsset, clip())).toBeNull();
  });

  it('always produces at least one peak of path', () => {
    const waveform = clipWaveform(audio(), clip({ duration: 0 }));
    expect(waveform?.width).toBe(1);
    expect(waveform?.path).not.toBe('');
  });
});
