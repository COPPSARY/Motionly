import { describe, expect, it, vi } from 'vitest';
import {
  synchronizeVideoAssets,
  videoSourceTime,
  type LoadedAsset,
} from '../../src/assets/asset-loader';
import { assetType } from '../../src/scene/scene-graph';
import type { EvaluatedScene } from '../../src/types/scene';

describe('video assets', () => {
  it('classifies MP4/WebM paths, query URLs, and data URLs', () => {
    expect(assetType('/media/intro.mp4')).toBe('video');
    expect(assetType('/media/intro.WEBM?version=2')).toBe('video');
    expect(assetType('data:video/mp4;base64,AAAA')).toBe('video');
    expect(assetType('/media/logo.svg')).toBe('svg');
    expect(assetType('/media/photo.png')).toBe('image');
  });

  it('clamps source time against media duration and trimOut', () => {
    expect(videoSourceTime(2.5, 10, 1)).toBe(2.5);
    expect(videoSourceTime(12, 10, 1)).toBeCloseTo(8.999);
    expect(videoSourceTime(-2, 10, 0)).toBe(0);
    expect(videoSourceTime(Number.NaN, 10, 0)).toBe(0);
  });

  it('does not scan and pause videos that were never active', async () => {
    const pause = vi.fn();
    const video = {
      motionlyType: 'video',
      motionlyDuration: 10,
      pause,
    } as unknown as LoadedAsset;
    const assets = new Map([['unused', video]]);
    const frame = { elements: [] } as unknown as EvaluatedScene;

    await synchronizeVideoAssets(frame, assets, { playing: true });

    expect(pause).not.toHaveBeenCalled();
  });
});
