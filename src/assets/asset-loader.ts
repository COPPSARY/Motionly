/**
 * Typed visual asset loading for images, SVGs, and browser-decodable video.
 */

import type { AssetType, EvaluatedScene, Scene } from '../types/scene';
import { assetFilename } from './asset-resolution';

export interface MotionlySvgData {
  width: number;
  height: number;
  paths: Array<{
    d: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    lineCap: CanvasLineCap;
    lineJoin: CanvasLineJoin;
    length: number;
  }>;
}

interface LoadedAssetMetadata {
  motionlySvg?: MotionlySvgData;
  motionlyDuration?: number;
  motionlySize?: number;
  motionlyPlay?: Promise<void>;
  motionlySeek?: Promise<void>;
}

export type LoadedImageAsset = HTMLImageElement &
  LoadedAssetMetadata & {
    motionlyType: 'image';
  };
export type LoadedVideoAsset = HTMLVideoElement &
  LoadedAssetMetadata & {
    motionlyType: 'video';
    motionlyDuration: number;
  };
export type LoadedAsset = LoadedImageAsset | LoadedVideoAsset;

export function isLoadedVideo(asset: LoadedAsset | undefined): asset is LoadedVideoAsset {
  return asset?.motionlyType === 'video';
}

/** Load all imported visual assets without failing the whole project on one bad file. */
export async function loadAssets(
  scene: Scene,
  baseUrl: string = document.baseURI
): Promise<Map<string, LoadedAsset>> {
  const uploadedByFilename = new Map<string, string>();
  for (const asset of scene.imports) {
    const filename = assetFilename(asset.path);
    if (asset.path.startsWith('data:') && filename) uploadedByFilename.set(filename, asset.path);
  }
  const entries = await Promise.all(
    scene.imports.map(async (asset): Promise<[string, LoadedAsset] | null> => {
      try {
        const path = uploadedByFilename.get(assetFilename(asset.path)) ?? asset.path;
        return [asset.name, await loadAsset(path, baseUrl, asset.type)];
      } catch (error) {
        console.warn(`Could not load asset ${asset.path}:`, error);
        return null;
      }
    })
  );
  return new Map(entries.filter((entry): entry is [string, LoadedAsset] => entry !== null));
}

/** Load one image/SVG or video using the browser's native decoder. */
export async function loadAsset(
  path: string,
  baseUrl: string,
  type: AssetType
): Promise<LoadedAsset> {
  const url = new URL(
    path.startsWith('/') ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path,
    baseUrl
  ).href;
  const [asset, size] = await Promise.all([
    type === 'video' ? loadVideo(url) : loadImage(url, type === 'svg'),
    loadAssetSize(url),
  ]);
  if (size) asset.motionlySize = size;
  return asset;
}

async function loadAssetSize(url: string): Promise<number | undefined> {
  if (!/^https?:/i.test(url)) return undefined;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const size = Number(response.headers.get('content-length'));
    return response.ok && Number.isFinite(size) && size > 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

async function loadImage(url: string, isSvg: boolean): Promise<LoadedAsset> {
  const image = new Image() as LoadedImageAsset;
  image.motionlyType = 'image';
  image.decoding = 'async';
  image.src = url;
  const svgSource = isSvg
    ? fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Asset request failed (${response.status})`);
        return response.text();
      })
    : null;
  await Promise.all([image.decode(), svgSource]);
  if (svgSource) image.motionlySvg = parseSvg(await svgSource);
  return image;
}

async function loadVideo(url: string): Promise<LoadedVideoAsset> {
  const video = document.createElement('video') as LoadedVideoAsset;
  video.motionlyType = 'video';
  video.preload = 'auto';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.src = url;
  video.load();
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) await mediaEvent(video, 'loadedmetadata');
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await mediaEvent(video, 'loadeddata');
  video.width = Math.max(1, video.videoWidth);
  video.height = Math.max(1, video.videoHeight);
  video.motionlyDuration = Number.isFinite(video.duration) ? video.duration : 0;
  return video;
}

function mediaEvent(
  video: HTMLVideoElement,
  event: 'loadedmetadata' | 'loadeddata' | 'seeked'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(event, complete);
      video.removeEventListener('error', fail);
    };
    const complete = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(video.error ?? new Error(`Video failed during ${event}`));
    };
    video.addEventListener(event, complete, { once: true });
    video.addEventListener('error', fail, { once: true });
  });
}

export interface VideoSyncOptions {
  playing: boolean;
  exact?: boolean;
}

const activeVideosByAssetMap = new WeakMap<Map<string, LoadedAsset>, Set<LoadedVideoAsset>>();

export function videoSourceTime(sourceTime: number, duration: number, trimOut = 0): number {
  const maximum = Math.max(0, duration - Math.max(0, trimOut) - 0.001);
  return Math.max(0, Math.min(maximum, Number.isFinite(sourceTime) ? sourceTime : 0));
}

/**
 * Synchronize native video decoders to evaluated clip source times.
 * Exact mode awaits seek completion for scrubbing and export; playback mode lets
 * muted videos run natively and only corrects meaningful drift.
 */
export async function synchronizeVideoAssets(
  frame: EvaluatedScene,
  assets: Map<string, LoadedAsset>,
  options: VideoSyncOptions
): Promise<void> {
  const active = new Map<string, Record<string, unknown>>();
  for (const element of frame.elements) {
    if (!element.assetName) continue;
    const asset = assets.get(element.assetName);
    if (!isLoadedVideo(asset)) continue;
    active.set(element.assetName, element.render as unknown as Record<string, unknown>);
  }

  const operations: Promise<void>[] = [];
  const previousActive = activeVideosByAssetMap.get(assets) ?? new Set<LoadedVideoAsset>();
  const nextActive = new Set<LoadedVideoAsset>();
  for (const [name, render] of active) {
    const asset = assets.get(name);
    if (!isLoadedVideo(asset)) continue;
    nextActive.add(asset);
    const sourceTime = Number(render['mediaTime'] ?? 0);
    const trimOut = Math.max(0, Number(render['mediaTrimOut'] ?? 0));
    const desired = videoSourceTime(sourceTime, asset.motionlyDuration, trimOut);
    const tolerance = options.exact ? 1 / 1000 : 0.15;
    if (Math.abs(asset.currentTime - desired) > tolerance) {
      operations.push(seekVideoWithoutOverlap(asset, desired, options.exact === true));
    }
    if (options.playing && asset.paused) {
      operations.push(playVideo(asset));
    } else if (!options.playing) {
      asset.pause();
    }
  }
  for (const asset of previousActive) {
    if (!nextActive.has(asset)) asset.pause();
  }
  activeVideosByAssetMap.set(assets, nextActive);
  await Promise.all(operations);
}

export function pauseVideoAssets(assets: Map<string, LoadedAsset>): void {
  for (const asset of assets.values()) if (isLoadedVideo(asset)) asset.pause();
  activeVideosByAssetMap.delete(assets);
}

function playVideo(video: LoadedVideoAsset): Promise<void> {
  if (video.motionlyPlay) return video.motionlyPlay;
  const operation = video.play().catch(() => undefined);
  video.motionlyPlay = operation;
  return operation.finally(() => {
    if (video.motionlyPlay === operation) video.motionlyPlay = undefined;
  });
}

function seekVideoWithoutOverlap(
  video: LoadedVideoAsset,
  time: number,
  exact: boolean
): Promise<void> {
  if (video.motionlySeek && !exact) return video.motionlySeek;
  const previous = video.motionlySeek?.catch(() => undefined) ?? Promise.resolve();
  const operation = previous.then(() => seekVideo(video, time));
  video.motionlySeek = operation;
  return operation.finally(() => {
    if (video.motionlySeek === operation) video.motionlySeek = undefined;
  });
}

async function seekVideo(video: LoadedVideoAsset, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) <= 1 / 1000) return;
  const done = mediaEvent(video, 'seeked');
  video.currentTime = time;
  await done;
}

function parseSvg(source: string): MotionlySvgData {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  const width = viewBox?.[2] ?? Number.parseFloat(svg.getAttribute('width') ?? '1');
  const height = viewBox?.[3] ?? Number.parseFloat(svg.getAttribute('height') ?? '1');
  const paths = Array.from(svg.querySelectorAll('path[d]')).flatMap((path, index) => {
    const stroke = path.getAttribute('stroke');
    if (!stroke || stroke === 'none') return [];
    let length = width + height;
    try {
      length = (path as SVGPathElement).getTotalLength();
    } catch {
      // Detached SVG geometry is unavailable in a few browsers; the reveal still works.
    }
    return [
      {
        d: path.getAttribute('d')!,
        stroke: stroke.startsWith('url(') ? (index ? '#ffffff' : '#8ab4ff') : stroke,
        strokeWidth: Number.parseFloat(path.getAttribute('stroke-width') ?? '1'),
        opacity: Number.parseFloat(path.getAttribute('stroke-opacity') ?? '1'),
        lineCap: (path.getAttribute('stroke-linecap') as CanvasLineCap) || 'butt',
        lineJoin: (path.getAttribute('stroke-linejoin') as CanvasLineJoin) || 'miter',
        length: Math.max(1, length),
      },
    ];
  });
  return { width, height, paths };
}
