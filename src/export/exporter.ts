/**
 * Video and GIF exporter
 * Handles export to various formats (WebM, MP4, GIF)
 */

import { evaluateScene } from '../animation/evaluator';
import { GifEncoder } from './gif-encoder';
import { CanvasRenderer } from '../render/canvas-renderer';
import type { LoadedAsset } from '../assets/asset-loader';
import type { Scene, Animation, Element, Keyframe } from '../types/scene';
import type { ExportFormat, ExportSupport } from '../types/export';

const MIME_TYPES: Record<string, string[]> = {
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  mp4: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'],
  gif: [],
};

/**
 * Check if format can be exported
 */
export function canExport(format: ExportFormat): boolean {
  if (format === 'gif') return typeof document !== 'undefined';
  if (typeof MediaRecorder === 'undefined') return false;
  return Boolean(selectMimeType(format));
}

/**
 * Get export support for all formats
 */
export function exportSupport(): ExportSupport {
  return {
    webm: canExport('webm'),
    mp4: canExport('mp4'),
    gif: canExport('gif'),
  };
}

/**
 * Export video to specified format
 */
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

  const mimeType = selectMimeType(format);
  if (!mimeType) {
    throw new Error(`${format.toUpperCase()} export is not supported by this browser`);
  }

  const width = Math.round((height * scene.canvas.width) / scene.canvas.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new CanvasRenderer(canvas);
  const scaledScene = scaleScene(scene, width, height);
  const stream = canvas.captureStream(fps);
  const audio = audioUrl ? await attachAudio(stream, audioUrl) : null;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrateFor(height, fps),
  });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (event) =>
      reject((event as ErrorEvent).error ?? new Error('MP4 recording failed'));
  });

  recorder.start();
  audio?.start();
  try {
    await renderTimeline({ renderer, scene: scaledScene, assets, fps, onProgress });
    recorder.stop();
    return await finished;
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    audio?.stop();
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function attachAudio(stream: MediaStream, url: string) {
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
      start: () => source.start(),
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

/**
 * Export as animated GIF
 */
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
  const totalFrames = Math.ceil(scaledScene.canvas.duration * fps);

  for (let frame = 0; frame <= totalFrames; frame += 1) {
    const time = Math.min(scaledScene.canvas.duration, frame / fps);
    renderer.render(evaluateScene(scaledScene, time), assets);
    const ctx = (renderer as unknown as { context: CanvasRenderingContext2D }).context;
    encoder.addFrame(ctx.getImageData(0, 0, width, height));
    onProgress?.(frame / totalFrames);
    if (frame % 4 === 0) {
      await wait(0);
    }
  }

  return encoder.finish();
}

/**
 * Select supported MIME type
 */
function selectMimeType(format: ExportFormat): string | undefined {
  const types = MIME_TYPES[format];
  if (!types) return undefined;
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Render timeline frame by frame
 */
async function renderTimeline(options: {
  renderer: CanvasRenderer;
  scene: Scene;
  assets: Map<string, LoadedAsset>;
  fps: number;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  const { renderer, scene, assets, fps, onProgress } = options;
  const totalFrames = Math.ceil(scene.canvas.duration * fps);
  const frameDuration = 1000 / fps;

  for (let frame = 0; frame <= totalFrames; frame += 1) {
    const time = Math.min(scene.canvas.duration, frame / fps);
    renderer.render(evaluateScene(scene, time), assets);
    onProgress?.(frame / totalFrames);
    await wait(frameDuration);
  }
}

/**
 * Scale scene to target dimensions
 */
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

/**
 * Scale numeric properties by scale factor
 */
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

/**
 * Calculate bitrate for export
 */
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

/**
 * Wait for specified milliseconds
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
