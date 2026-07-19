/**
 * Deterministic video and GIF export.
 *
 * MP4 frames are rendered in the browser, then encoded by the local Motionly
 * server. Keeping ffmpeg on the Node side avoids a large wasm download and
 * gives us dependable H.264/AAC support, at the cost of requiring the local
 * Vite server for MP4 export rather than a static-only deployment.
 */

import { evaluateScene } from '../animation/evaluator';
import { GifEncoder } from './gif-encoder';
import { CanvasRenderer } from '../render/canvas-renderer';
import {
  hasRealtimeOnlyAssets,
  pauseAnimatedAssets,
  resetRealtimeAssets,
  synchronizeAnimatedAssets,
  type LoadedAsset,
} from '../assets/asset-loader';
import type { Scene, Animation, Element, Keyframe } from '../types/scene';
import type { EvaluatedScene } from '../types/scene';
import type { ExportFormat, ExportSupport } from '../types/export';
import { Mp4FrameSource } from '../assets/mp4-video';

const EXPORT_API = '/api/exports';
const WEBM_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** Check whether this runtime has the browser primitives needed for a format. */
export function canExport(format: ExportFormat): boolean {
  if (format === 'gif' || format === 'mp4') return typeof document !== 'undefined';
  if (typeof MediaRecorder === 'undefined') return false;
  return Boolean(selectWebmMimeType());
}

export function exportSupport(): ExportSupport {
  return {
    webm: canExport('webm'),
    mp4: canExport('mp4'),
    gif: canExport('gif'),
  };
}

export async function exportVideo(options: {
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  format: ExportFormat;
  height: number;
  fps: number;
  audioUrl?: string;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { scene, assets, format, height, fps, audioUrl, onProgress } = options;

  if (format === 'gif') {
    return exportGif({ scene, assets, height, fps, onProgress });
  }
  if (format === 'mp4') {
    return exportMp4Frames({ scene, assets, height, fps, audioUrl, onProgress });
  }

  return exportWebmRealtime({ scene, assets, height, fps, audioUrl, onProgress });
}

async function exportMp4Frames(options: {
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  height: number;
  fps: number;
  audioUrl?: string;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { scene, assets, height, fps, audioUrl, onProgress } = options;
  const width = Math.round((height * scene.canvas.width) / scene.canvas.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new CanvasRenderer(canvas);
  const scaledScene = scaleScene(scene, width, height);
  const totalFrames = frameCount(scaledScene.canvas.duration, fps);

  const job = await requestJson<{ id: string }>(EXPORT_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      width,
      height,
      fps,
      duration: scaledScene.canvas.duration,
      totalFrames,
      hasAudio: Boolean(audioUrl),
      audioStart: scaledScene.audioStart,
    }),
  });
  const decoded = await prepareDecodedVideoAssets(assets);

  try {
    const realtime = hasRealtimeOnlyAssets(decoded.assets);
    if (realtime) await resetRealtimeAssets(decoded.assets);
    const startedAt = performance.now();
    let uploads: Promise<void>[] = [];
    let uploadedFrames = 0;
    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (realtime) await waitForFrame(startedAt, frame, fps);
      const evaluated = evaluateScene(scaledScene, frame / fps);
      await renderDecodedVideos(evaluated, decoded.sources);
      await synchronizeAnimatedAssets(evaluated, decoded.assets, { playing: false, exact: true });
      renderer.render(evaluated, decoded.assets);
      const image = await canvasToJpeg(canvas);
      uploads.push(
        request(`${EXPORT_API}/${job.id}/frames/${frame}`, {
          method: 'PUT',
          headers: { 'content-type': 'image/jpeg' },
          body: image,
        }).then(() => {
          uploadedFrames += 1;
          onProgress?.((uploadedFrames / totalFrames) * 0.8);
        })
      );
      if (uploads.length === 4) {
        await Promise.all(uploads);
        uploads = [];
      }
      if (frame % 4 === 0) await wait(0);
    }
    await Promise.all(uploads);

    if (audioUrl) {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Could not load audio (${audioResponse.status})`);
      }
      await request(`${EXPORT_API}/${job.id}/audio`, {
        method: 'PUT',
        headers: {
          'content-type': audioResponse.headers.get('content-type') ?? 'application/octet-stream',
        },
        body: await audioResponse.blob(),
      });
    }

    onProgress?.(0.85);
    const response = await request(`${EXPORT_API}/${job.id}/finish`, { method: 'POST' });
    const video = await response.blob();
    onProgress?.(1);
    return video;
  } catch (error) {
    await fetch(`${EXPORT_API}/${job.id}`, { method: 'DELETE' }).catch(() => undefined);
    throw error;
  } finally {
    decoded.sources.forEach((source) => source.close());
  }
}

async function exportWebmRealtime(options: {
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  height: number;
  fps: number;
  audioUrl?: string;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { scene, assets, height, fps, audioUrl, onProgress } = options;
  const captureFps = Math.min(fps, 30);
  const mimeType = selectWebmMimeType();
  if (!mimeType) throw new Error('WEBM export is not supported by this browser');

  const width = Math.round((height * scene.canvas.width) / scene.canvas.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new CanvasRenderer(canvas);
  const scaledScene = scaleScene(scene, width, height);
  const stream = canvas.captureStream(captureFps);
  const audio = audioUrl ? await attachAudio(stream, audioUrl, scaledScene.audioStart) : null;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrateFor(height, captureFps),
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (event) =>
      reject((event as ErrorEvent).error ?? new Error('WebM recording failed'));
  });

  await resetRealtimeAssets(assets);
  const firstFrame = evaluateScene(scaledScene, 0);
  await synchronizeAnimatedAssets(firstFrame, assets, { playing: false, exact: true });
  renderer.render(firstFrame, assets);
  recorder.start();
  audio?.start();
  try {
    await renderTimelineRealtime({
      renderer,
      scene: scaledScene,
      assets,
      fps: captureFps,
      onProgress,
    });
    recorder.stop();
    return await finished;
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    audio?.stop();
    pauseAnimatedAssets(assets);
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function attachAudio(stream: MediaStream, url: string, start: number) {
  const context = new AudioContext();
  try {
    await context.resume();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load audio (${response.status})`);
    const source = context.createBufferSource();
    source.buffer = await context.decodeAudioData(await response.arrayBuffer());
    const destination = context.createMediaStreamDestination();
    source.connect(destination);
    const track = destination.stream.getAudioTracks()[0];
    if (!track) throw new Error('Could not prepare the audio track');
    stream.addTrack(track);
    return {
      start: () => source.start(context.currentTime + Math.max(0, start)),
      stop: () => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
        void context.close();
      },
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function exportGif(options: {
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  height: number;
  fps: number;
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { scene, assets, height, fps, onProgress } = options;
  const width = Math.round((height * scene.canvas.width) / scene.canvas.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new CanvasRenderer(canvas);
  const scaledScene = scaleScene(scene, width, height);
  const encoder = new GifEncoder(width, height, 1000 / fps);
  const totalFrames = frameCount(scaledScene.canvas.duration, fps);
  const decoded = await prepareDecodedVideoAssets(assets);
  try {
    const realtime = hasRealtimeOnlyAssets(decoded.assets);
    if (realtime) await resetRealtimeAssets(decoded.assets);
    const startedAt = performance.now();

    for (let frame = 0; frame < totalFrames; frame += 1) {
      if (realtime) await waitForFrame(startedAt, frame, fps);
      const time = frame / fps;
      const evaluated = evaluateScene(scaledScene, time);
      await renderDecodedVideos(evaluated, decoded.sources);
      await synchronizeAnimatedAssets(evaluated, decoded.assets, { playing: false, exact: true });
      renderer.render(evaluated, decoded.assets);
      const ctx = (renderer as unknown as { context: CanvasRenderingContext2D }).context;
      encoder.addFrame(ctx.getImageData(0, 0, width, height));
      onProgress?.((frame + 1) / totalFrames);
      if (frame % 4 === 0) await wait(0);
    }
  } finally {
    decoded.sources.forEach((source) => source.close());
  }

  return encoder.finish();
}

async function prepareDecodedVideoAssets(assets: Map<string, LoadedAsset>) {
  const prepared = new Map(assets);
  const sources = new Map<string, Mp4FrameSource>();
  if (typeof VideoDecoder === 'undefined') return { assets: prepared, sources };
  for (const [name, asset] of assets) {
    if (!asset.motionlyMp4) continue;
    const source = await Mp4FrameSource.create(asset.motionlyMp4);
    const canvas = source.canvas as unknown as LoadedAsset;
    Object.assign(canvas, { motionlyType: 'image', motionlySource: asset.motionlySource });
    prepared.set(name, canvas);
    sources.set(name, source);
  }
  return { assets: prepared, sources };
}

async function renderDecodedVideos(
  frame: EvaluatedScene,
  sources: Map<string, Mp4FrameSource>
): Promise<void> {
  const times = new Map<string, number>();
  for (const element of frame.elements) {
    if (element.assetName && sources.has(element.assetName)) {
      times.set(element.assetName, Number(element.render.mediaTime ?? 0));
    }
  }
  await Promise.all(
    [...times].flatMap(([name, time]) => {
      const source = sources.get(name);
      return source ? [source.renderAt(time)] : [];
    })
  );
}

function selectWebmMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return WEBM_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

async function renderTimelineRealtime(options: {
  renderer: CanvasRenderer;
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  fps: number;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  const { renderer, scene, assets, fps, onProgress } = options;
  const startedAt = performance.now();
  let previousFrame = -1;

  while (true) {
    await nextAnimationFrame();
    const elapsed = Math.min(scene.canvas.duration, (performance.now() - startedAt) / 1000);
    const frame = Math.min(frameCount(scene.canvas.duration, fps) - 1, Math.floor(elapsed * fps));
    if (frame === previousFrame && elapsed < scene.canvas.duration) continue;
    previousFrame = frame;
    const time = Math.min(scene.canvas.duration, elapsed);
    const evaluated = evaluateScene(scene, time);
    await synchronizeAnimatedAssets(evaluated, assets, { playing: true });
    renderer.render(evaluated, assets);
    onProgress?.(elapsed / scene.canvas.duration);
    if (elapsed >= scene.canvas.duration) break;
  }
  await nextAnimationFrame();
}

function frameCount(duration: number, fps: number): number {
  return Math.max(1, Math.ceil(duration * fps));
}

async function waitForFrame(startedAt: number, frame: number, fps: number): Promise<void> {
  const delay = startedAt + (frame * 1000) / fps - performance.now();
  if (delay > 0) await wait(delay);
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not capture an export frame'));
      },
      'image/jpeg',
      0.95
    );
  });
}

async function request(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('MP4 export requires the local Motionly server with ffmpeg installed');
  }
  if (!response.ok) {
    const message = (await response.text()).trim();
    throw new Error(message || `MP4 export failed (${response.status})`);
  }
  return response;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await request(url, init);
  return (await response.json()) as T;
}

function scaleScene(scene: Scene, width: number, height: number): Scene {
  const scale = width / scene.canvas.width;

  return {
    ...scene,
    canvas: { ...scene.canvas, width, height },
    camera: scaleProperties(
      scene.camera as unknown as Record<string, unknown>,
      scale
    ) as unknown as typeof scene.camera,
    elements: scene.elements.map((element): Element => ({
      ...element,
      properties: scaleProperties(
        element.properties as unknown as Record<string, unknown>,
        scale
      ) as unknown as typeof element.properties,
    })),
    animations: scene.animations.map((animation): Animation => ({
      ...animation,
      from: scaleProperties(animation.from, scale),
      to: scaleProperties(animation.to, scale),
      keyframes: animation.keyframes.map((frame): Keyframe => ({
        ...frame,
        properties: scaleProperties(frame.properties, scale),
      })),
    })),
  };
}

function scaleProperties<T extends Record<string, unknown>>(properties: T, scale: number): T {
  const scaled = { ...properties };

  for (const key of ['x', 'y', 'width', 'height', 'blur', 'shadow', 'size', 'tracking']) {
    const value = scaled[key];
    if (typeof value === 'number') {
      (scaled as Record<string, unknown>)[key] = value * scale;
    }
  }

  return scaled;
}

function bitrateFor(height: number, fps: number): number {
  const base =
    height >= 2160
      ? 28_000_000
      : height >= 1440
        ? 18_000_000
        : height >= 1080
          ? 10_000_000
          : 5_000_000;
  return Math.round(base * (fps / 60));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
