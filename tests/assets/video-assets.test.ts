import { describe, expect, it, vi } from 'vitest';
import {
  gifFrameAtTime,
  isAnimatedSvgSource,
  loadAsset,
  pauseAnimatedAssets,
  synchronizeVideoAssets,
  videoSourceTime,
  type LoadedAsset,
} from '../../src/assets/asset-loader';
import { Mp4FrameSource, type DemuxedMp4Video } from '../../src/assets/mp4-video';
import { assetType, hasIntrinsicDuration } from '../../src/scene/scene-graph';
import type { EvaluatedScene } from '../../src/types/scene';

describe('animated assets', () => {
  it('finishes an audio waveform before exposing the asset for its first render', async () => {
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const readyState = vi
      .spyOn(HTMLMediaElement.prototype, 'readyState', 'get')
      .mockReturnValue(HTMLMediaElement.HAVE_METADATA);
    const duration = vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(1);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'HEAD'
          ? new Response(null, { headers: { 'content-length': '4' } })
          : new Response(new Uint8Array([0, 1, 2, 3]))
      )
    );

    let finishDecode: (() => void) | undefined;
    vi.stubGlobal(
      'AudioContext',
      class {
        decodeAudioData(): Promise<{
          duration: number;
          numberOfChannels: number;
          getChannelData: () => Float32Array;
        }> {
          return new Promise((resolve) => {
            finishDecode = () =>
              resolve({
                duration: 1,
                numberOfChannels: 1,
                getChannelData: () => Float32Array.from([0, 0.5, -1, 0.25]),
              });
          });
        }

        close(): Promise<void> {
          return Promise.resolve();
        }
      }
    );

    try {
      let settled = false;
      const loading = loadAsset('./tone.wav', 'http://localhost/', 'audio').then((asset) => {
        settled = true;
        return asset;
      });
      await vi.waitFor(() => expect(finishDecode).toBeTypeOf('function'));
      expect(settled).toBe(false);
      finishDecode?.();

      const asset = await loading;
      expect(asset.motionlyType).toBe('audio');
      if (asset.motionlyType !== 'audio') throw new Error('Expected audio asset');
      expect(asset.motionlyPeaks).toHaveLength(4);
    } finally {
      load.mockRestore();
      readyState.mockRestore();
      duration.mockRestore();
      vi.unstubAllGlobals();
    }
  });

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
    expect(assetType('/media/score.mp3')).toBe('audio');
    expect(assetType('/media/voice.WAV?v=2')).toBe('audio');
    expect(assetType('data:audio/mpeg;base64,AAAA')).toBe('audio');
    expect(
      assetType('data:application/octet-stream;base64,AAAA#motionly-filename=score.flac')
    ).toBe('audio');
  });

  it('separates sources that carry their own length from static artwork', () => {
    expect(hasIntrinsicDuration('/media/intro.mp4')).toBe(true);
    expect(hasIntrinsicDuration('/media/loader.lottie')).toBe(true);
    // GIFs share the `image` asset type but still play a timeline of their own.
    expect(hasIntrinsicDuration('/media/loop.GIF?version=2')).toBe(true);
    expect(hasIntrinsicDuration('data:image/gif;base64,AAAA')).toBe(true);
    expect(
      hasIntrinsicDuration('data:application/octet-stream;base64,AAAA#motionly-filename=loop.gif')
    ).toBe(true);
    expect(hasIntrinsicDuration('/media/score.mp3')).toBe(true);
    expect(hasIntrinsicDuration('/media/photo.png')).toBe(false);
    expect(hasIntrinsicDuration('/media/logo.svg')).toBe(false);
  });

  it('maps timeline time to variable-duration GIF frames', () => {
    const frames = [{ endTime: 0.1 }, { endTime: 0.35 }, { endTime: 0.5 }];
    expect(gifFrameAtTime(frames, 0)).toBe(0);
    expect(gifFrameAtTime(frames, 0.2)).toBe(1);
    expect(gifFrameAtTime(frames, 0.49)).toBe(2);
    expect(gifFrameAtTime(frames, 0.6)).toBe(0);
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
      requestVideoFrameCallback: vi.fn(() => 1),
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

  it('streams MP4 decoding without midstream flush and closes safely twice', async () => {
    let needsKeyFrame = true;
    let flushes = 0;
    vi.stubGlobal(
      'EncodedVideoChunk',
      class {
        constructor(init: EncodedVideoChunkInit) {
          Object.assign(this, init);
        }
      }
    );
    vi.stubGlobal(
      'VideoDecoder',
      class {
        state: CodecState = 'configured';
        decodeQueueSize = 0;
        static isConfigSupported(config: VideoDecoderConfig) {
          return Promise.resolve({ supported: true, config });
        }

        constructor(private init: VideoDecoderInit) {}
        configure() {
          needsKeyFrame = true;
        }
        decode(chunk: EncodedVideoChunk) {
          if (needsKeyFrame && chunk.type !== 'key') {
            throw new DOMException(
              'A key frame is required after configure() or flush()',
              'DataError'
            );
          }
          needsKeyFrame = false;
          this.decodeQueueSize += 1;
          queueMicrotask(() => {
            this.init.output({ timestamp: chunk.timestamp, close() {} } as VideoFrame);
            this.decodeQueueSize -= 1;
          });
        }
        flush() {
          flushes += 1;
          needsKeyFrame = true;
          return Promise.resolve();
        }
        reset() {
          needsKeyFrame = true;
        }
        close() {
          if (this.state === 'closed') throw new DOMException('Codec already closed');
          this.state = 'closed';
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage() {},
    } as unknown as CanvasRenderingContext2D);

    const samples = [
      { cts: 0, is_sync: true },
      { cts: 10, is_sync: false },
      { cts: 20, is_sync: false },
      { cts: 30, is_sync: false },
      { cts: 100, is_sync: true },
    ].map((sample) => ({
      ...sample,
      timescale: 100,
      duration: 10,
      data: new Uint8Array([sample.cts]),
    })) as DemuxedMp4Video['samples'];
    const source = await Mp4FrameSource.create({
      codec: 'avc1.64001f',
      width: 16,
      height: 9,
      duration: 1,
      samples,
    });

    try {
      await source.renderAt(0);
      await expect(source.renderAt(0.25)).resolves.toBeUndefined();
      expect(flushes).toBe(0);
      source.close();
      expect(() => source.close()).not.toThrow();
    } finally {
      source.close();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
