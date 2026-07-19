import { describe, expect, it, vi } from 'vitest';
import {
  assetWarnings,
  isAnimatedSvgSource,
  pauseAnimatedAssets,
  synchronizeVideoAssets,
  videoSourceTime,
  type LoadedAsset,
} from '../../src/assets/asset-loader';
import { assetType } from '../../src/scene/scene-graph';
import type { EvaluatedScene } from '../../src/types/scene';

describe('animated assets', () => {
  it('classifies browser video, animated image/SVG, and Lottie paths', () => {
    expect(assetType('/media/intro.mp4')).toBe('video');
    expect(assetType('/media/intro.WEBM?version=2')).toBe('video');
    expect(assetType('/media/intro.mov')).toBe('video');
    expect(assetType('data:video/mp4;base64,AAAA')).toBe('video');
    expect(assetType('data:application/octet-stream;base64,AAAA#motionly-filename=intro.mp4')).toBe(
      'video'
    );
    expect(assetType('/media/loader.lottie')).toBe('lottie');
    expect(assetType('data:application/zip+dotlottie;base64,AAAA')).toBe('lottie');
    expect(
      assetType('data:application/octet-stream;base64,AAAA#motionly-filename=loader.lottie')
    ).toBe('lottie');
    expect(assetType('/media/logo.svg')).toBe('svg');
    expect(assetType('data:application/octet-stream;base64,AAAA#motionly-filename=logo.svg')).toBe(
      'svg'
    );
    expect(assetType('/media/loop.gif')).toBe('image');
    expect(assetType('/media/photo.png')).toBe('image');
  });

  it('detects SMIL and CSS-animated SVG without flagging static artwork', () => {
    expect(isAnimatedSvgSource('<svg><animate attributeName="opacity" /></svg>')).toBe(true);
    expect(isAnimatedSvgSource('<svg><style>@keyframes pulse {}</style></svg>')).toBe(true);
    expect(isAnimatedSvgSource('<svg><path d="M0 0L1 1" /></svg>')).toBe(false);
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

  it('finishes the activation seek before starting video playback', async () => {
    const order: string[] = [];
    const listeners = new Map<string, () => void>();
    let currentTime = 0;
    const video = {
      motionlyType: 'video',
      motionlyDuration: 10,
      paused: true,
      get currentTime() {
        return currentTime;
      },
      set currentTime(value: number) {
        currentTime = value;
        order.push('seek');
        queueMicrotask(() => listeners.get('seeked')?.());
      },
      addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
      removeEventListener: (event: string) => listeners.delete(event),
      pause: vi.fn(),
      play: vi.fn(function (this: { paused: boolean }) {
        this.paused = false;
        order.push('play');
        return Promise.resolve();
      }),
    } as unknown as LoadedAsset;
    const assets = new Map([['demo', video]]);
    const frame = {
      elements: [{ assetName: 'demo', render: { mediaTime: 2, mediaTrimOut: 0 } }],
    } as unknown as EvaluatedScene;

    await synchronizeVideoAssets(frame, assets, { playing: true });

    expect(order).toEqual(['seek', 'play']);
  });

  it('starts, pauses, resumes, and invalidates animated SVG playback cleanly', async () => {
    const restart = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn();
    const stop = vi.fn();
    const svg = {
      motionlyType: 'svg',
      motionlyRestart: restart,
      motionlyResume: resume,
      motionlyCanvg: { stop },
    } as unknown as LoadedAsset;
    const assets = new Map([['mark', svg]]);
    const frame = {
      elements: [{ assetName: 'mark', render: { mediaTime: 0 } }],
    } as unknown as EvaluatedScene;

    await synchronizeVideoAssets(frame, assets, { playing: true });
    await synchronizeVideoAssets(frame, assets, { playing: true });
    expect(restart).toHaveBeenCalledTimes(1);

    pauseAnimatedAssets(assets);
    await synchronizeVideoAssets(frame, assets, { playing: true });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);

    pauseAnimatedAssets(assets);
    await synchronizeVideoAssets(frame, assets, { playing: false, exact: true });
    await synchronizeVideoAssets(frame, assets, { playing: true });
    expect(restart).toHaveBeenCalledTimes(2);
  });

  it('restarts a native GIF when timeline playback begins', async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    const gif = {
      motionlyType: 'image',
      motionlyRealtime: true,
      motionlySource: 'animation.gif',
      src: 'animation.gif',
      decode,
    } as unknown as LoadedAsset;
    const assets = new Map([['animation', gif]]);
    const frame = {
      elements: [{ assetName: 'animation', render: { mediaTime: 0 } }],
    } as unknown as EvaluatedScene;

    await synchronizeVideoAssets(frame, assets, { playing: false, exact: true });
    await synchronizeVideoAssets(frame, assets, { playing: true });

    expect(decode).toHaveBeenCalledTimes(2);
    expect(assetWarnings(assets)).toEqual([]);
  });
});
