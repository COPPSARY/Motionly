/** Typed visual asset loading for still images, animated images/SVG, Lottie, and video. */

import type { Canvg } from 'canvg';
import type { DotLottie } from '@lottiefiles/dotlottie-web';
import type { AssetType, EvaluatedScene, Scene } from '../types/scene';
import { assetFilename } from './asset-resolution';

export interface MotionlySvgData {
  width: number;
  height: number;
  animated: boolean;
  paths: Array<{
    d: string;
    fill: string;
    fillOpacity: number;
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
  motionlySource: string;
  motionlyWarning?: string;
  motionlyRealtime?: boolean;
  motionlyPlay?: Promise<void>;
  motionlySeek?: Promise<void>;
  motionlyCanvg?: Canvg;
  motionlyLottie?: DotLottie;
  motionlyRestart?: () => Promise<void>;
  motionlyResume?: () => void;
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
export type LoadedCanvasAsset = HTMLCanvasElement &
  LoadedAssetMetadata & {
    src: string;
    motionlyType: 'gif' | 'lottie' | 'svg';
    motionlyDuration: number;
  };
export type LoadedAsset = LoadedImageAsset | LoadedVideoAsset | LoadedCanvasAsset;

export function isLoadedVideo(asset: LoadedAsset | undefined): asset is LoadedVideoAsset {
  return asset?.motionlyType === 'video';
}

export function isLoadedLottie(asset: LoadedAsset | undefined): asset is LoadedCanvasAsset {
  return asset?.motionlyType === 'lottie';
}

function isLoadedCanvas(asset: LoadedAsset): asset is LoadedCanvasAsset {
  return (
    asset.motionlyType === 'gif' || asset.motionlyType === 'lottie' || asset.motionlyType === 'svg'
  );
}

export function assetWarnings(assets: Map<string, LoadedAsset>): string[] {
  return [...assets.entries()].flatMap(([name, asset]) =>
    asset.motionlyWarning ? [`${name}: ${asset.motionlyWarning}`] : []
  );
}

/** Load all imported visual assets without failing the whole project on one bad file. */
export async function loadAssets(
  scene: Scene,
  baseUrl: string = document.baseURI,
  onError?: (name: string, error: unknown) => void
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
        onError?.(asset.name, error);
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
    type === 'video'
      ? loadVideo(url)
      : type === 'lottie'
        ? loadLottie(url)
        : isGif(url)
          ? loadGif(url)
          : loadImage(url, type === 'svg'),
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
  image.motionlySource = url;
  image.decoding = 'async';
  image.src = url;
  const decoded = image.decode();
  const svgSource = isSvg
    ? fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Asset request failed (${response.status})`);
        return response.text();
      })
    : null;
  if (svgSource) {
    const source = await svgSource;
    const svg = parseSvg(source);
    if (svg.animated) return loadAnimatedSvg(url, source, svg);
    image.motionlySvg = svg;
  }
  await decoded;
  return image;
}

async function loadAnimatedSvg(
  url: string,
  source: string,
  svg: MotionlySvgData
): Promise<LoadedCanvasAsset> {
  const canvas = document.createElement('canvas') as LoadedCanvasAsset;
  const scale = Math.min(1, 2048 / Math.max(1, svg.width, svg.height));
  canvas.width = Math.max(1, Math.round(svg.width * scale));
  canvas.height = Math.max(1, Math.round(svg.height * scale));
  canvas.src = url;
  canvas.motionlySource = url;
  canvas.motionlyType = 'svg';
  canvas.motionlyDuration = 0;
  canvas.motionlySvg = svg;
  canvas.motionlyWarning = /@keyframes\b|animation(?:-name)?\s*:/i.test(source)
    ? 'Animated SVG uses real-time Canvas playback. SMIL animation is rendered where supported, but CSS keyframes are not fully supported by the Canvas SVG runtime and may differ.'
    : 'Animated SVG uses real-time Canvas playback. Its internal SMIL timeline cannot be frame-seeked, so exact scrubbing and export use wall-clock playback.';

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create animated SVG render context');
  const { Canvg: SvgPlayer } = await import('canvg');
  const options = {
    enableRedraw: true,
    ignoreDimensions: true,
    ignoreMouse: true,
    scaleWidth: canvas.width,
    scaleHeight: canvas.height,
  };
  const createPlayer = () => SvgPlayer.fromString(context, source);

  const firstFrame = createPlayer();
  canvas.motionlyCanvg = firstFrame;
  await firstFrame.render(options);
  canvas.motionlyRestart = async () => {
    canvas.motionlyCanvg?.stop();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const player = createPlayer();
    canvas.motionlyCanvg = player;
    player.start(options);
  };
  canvas.motionlyResume = () => canvas.motionlyCanvg?.start(options);
  return canvas;
}

async function loadVideo(url: string): Promise<LoadedVideoAsset> {
  const video = document.createElement('video') as LoadedVideoAsset;
  video.motionlyType = 'video';
  video.motionlySource = url;
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

async function loadLottie(url: string): Promise<LoadedCanvasAsset> {
  const canvas = document.createElement('canvas') as LoadedCanvasAsset;
  canvas.width = 512;
  canvas.height = 512;
  canvas.src = url;
  canvas.motionlySource = url;
  canvas.motionlyType = 'lottie';
  canvas.motionlyDuration = 0;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lottie request failed (${response.status})`);
  const { DotLottie: DotLottiePlayer } = await import('@lottiefiles/dotlottie-web');
  const player = new DotLottiePlayer({
    canvas,
    data: await response.arrayBuffer(),
    autoplay: false,
    loop: true,
    useFrameInterpolation: true,
    renderConfig: { autoResize: false, devicePixelRatio: 1, freezeOnOffscreen: false },
  });
  canvas.motionlyLottie = player;
  try {
    await new Promise<void>((resolve, reject) => {
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = (event: { error: Error }) => {
        cleanup();
        reject(event.error);
      };
      const cleanup = () => {
        player.removeEventListener('load', loaded);
        player.removeEventListener('loadError', failed);
      };
      player.addEventListener('load', loaded);
      player.addEventListener('loadError', failed);
      if (player.isLoaded) loaded();
    });
  } catch (error) {
    player.destroy();
    throw error;
  }
  const size = player.animationSize();
  const scale = Math.min(1, 2048 / Math.max(1, size.width, size.height));
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  canvas.motionlyDuration = Math.max(0, player.duration);
  player.resize();
  player.setFrame(0);
  return canvas;
}

async function loadGif(url: string): Promise<LoadedAsset> {
  const image = await loadImage(url, false);
  image.motionlyRealtime = true;
  return image;
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

const activeAssetsByMap = new WeakMap<Map<string, LoadedAsset>, Set<LoadedAsset>>();
const pausedRealtimeAssets = new WeakSet<LoadedAsset>();

export function videoSourceTime(sourceTime: number, duration: number, trimOut = 0): number {
  const maximum = Math.max(0, duration - Math.max(0, trimOut) - 0.001);
  return Math.max(0, Math.min(maximum, Number.isFinite(sourceTime) ? sourceTime : 0));
}

/**
 * Synchronize native video decoders to evaluated clip source times.
 * Exact mode awaits seek completion for scrubbing and export; playback mode lets
 * muted videos run natively and only corrects meaningful drift.
 */
export async function synchronizeAnimatedAssets(
  frame: EvaluatedScene,
  assets: Map<string, LoadedAsset>,
  options: VideoSyncOptions
): Promise<void> {
  const active = new Map<string, Record<string, unknown>>();
  for (const element of frame.elements) {
    if (!element.assetName) continue;
    const asset = assets.get(element.assetName);
    if (!asset || !isAnimated(asset)) continue;
    active.set(element.assetName, element.render as unknown as Record<string, unknown>);
  }

  const operations: Promise<void>[] = [];
  const previousActive = activeAssetsByMap.get(assets) ?? new Set<LoadedAsset>();
  const nextActive = new Set<LoadedAsset>();
  for (const [name, render] of active) {
    const asset = assets.get(name);
    if (!asset || !isAnimated(asset)) continue;
    nextActive.add(asset);
    const sourceTime = Number(render['mediaTime'] ?? 0);
    const trimOut = Math.max(0, Number(render['mediaTrimOut'] ?? 0));
    if (isLoadedVideo(asset)) {
      const desired = videoSourceTime(sourceTime, asset.motionlyDuration, trimOut);
      const newlyActive = !previousActive.has(asset);
      const tolerance = options.exact || newlyActive ? 1 / 1000 : 0.35;
      if (Math.abs(asset.currentTime - desired) > tolerance) {
        const seek = seekVideoWithoutOverlap(asset, desired, options.exact === true);
        operations.push(
          options.playing ? seek.then(() => (asset.paused ? playVideo(asset) : undefined)) : seek
        );
      } else if (options.playing && asset.paused) {
        operations.push(playVideo(asset));
      }
      if (!options.playing) asset.pause();
    } else if (isLoadedCanvas(asset) && asset.motionlyLottie) {
      seekLottie(asset, sourceTime);
    } else if (isRealtimeOnly(asset)) {
      if (!options.playing) {
        if (asset.motionlyCanvg) asset.motionlyCanvg.stop();
        else if (!previousActive.has(asset)) operations.push(restartRealtimeAsset(asset));
        pausedRealtimeAssets.delete(asset);
        nextActive.delete(asset);
      } else if (options.playing && !previousActive.has(asset)) {
        if (pausedRealtimeAssets.has(asset) && asset.motionlyResume) {
          pausedRealtimeAssets.delete(asset);
          asset.motionlyResume();
        } else {
          operations.push(restartRealtimeAsset(asset));
        }
      } else if (!asset.motionlyCanvg && !previousActive.has(asset)) {
        operations.push(restartRealtimeAsset(asset));
      }
    }
  }
  for (const asset of previousActive) {
    if (nextActive.has(asset)) continue;
    if (isLoadedVideo(asset)) asset.pause();
    if (asset.motionlyCanvg) {
      asset.motionlyCanvg.stop();
      pausedRealtimeAssets.delete(asset);
    }
  }
  activeAssetsByMap.set(assets, nextActive);
  await Promise.all(operations);
}

export function pauseAnimatedAssets(assets: Map<string, LoadedAsset>): void {
  for (const asset of assets.values()) {
    if (isLoadedVideo(asset)) asset.pause();
    if (asset.motionlyCanvg) {
      asset.motionlyCanvg.stop();
      pausedRealtimeAssets.add(asset);
    }
    asset.motionlyLottie?.pause();
  }
  activeAssetsByMap.delete(assets);
}

export function disposeAssets(assets: Map<string, LoadedAsset>): void {
  pauseAnimatedAssets(assets);
  for (const asset of assets.values()) {
    asset.motionlyCanvg?.stop();
    pausedRealtimeAssets.delete(asset);
    asset.motionlyLottie?.destroy();
  }
}

/** Backward-compatible names for callers outside this package. */
export const synchronizeVideoAssets = synchronizeAnimatedAssets;
export const pauseVideoAssets = pauseAnimatedAssets;

export async function resetRealtimeAssets(assets: Map<string, LoadedAsset>): Promise<void> {
  activeAssetsByMap.delete(assets);
  for (const asset of assets.values()) pausedRealtimeAssets.delete(asset);
  await Promise.all(
    [...assets.values()].filter(isRealtimeOnly).map((asset) => restartRealtimeAsset(asset))
  );
}

export function hasRealtimeOnlyAssets(assets: Map<string, LoadedAsset>): boolean {
  return [...assets.values()].some(isRealtimeOnly);
}

function isAnimated(asset: LoadedAsset): boolean {
  return (
    isLoadedVideo(asset) ||
    asset.motionlyType === 'gif' ||
    asset.motionlyType === 'lottie' ||
    isRealtimeOnly(asset)
  );
}

function isRealtimeOnly(asset: LoadedAsset): boolean {
  return Boolean(asset.motionlyRestart || asset.motionlyRealtime);
}

function seekLottie(asset: LoadedCanvasAsset, time: number): void {
  const player = asset.motionlyLottie;
  if (!player || !player.totalFrames || !player.duration) return;
  const local =
    (((Number.isFinite(time) ? time : 0) % player.duration) + player.duration) % player.duration;
  player.setFrame(Math.min(player.totalFrames - 1, (local / player.duration) * player.totalFrames));
}

async function restartRealtimeAsset(asset: LoadedAsset): Promise<void> {
  pausedRealtimeAssets.delete(asset);
  if (asset.motionlyRestart) return asset.motionlyRestart();
  if (asset.motionlyType !== 'image') return;
  const source = asset.motionlySource;
  asset.src = '';
  asset.src = source;
  await asset.decode();
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
  await waitForPresentedVideoFrame(video);
}

function waitForPresentedVideoFrame(video: LoadedVideoAsset): Promise<void> {
  if (!video.requestVideoFrameCallback) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let callbackId: number | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      if (callbackId !== undefined) video.cancelVideoFrameCallback?.(callbackId);
      finish();
    }, 100);
    callbackId = video.requestVideoFrameCallback(finish);
  });
}

function parseSvg(source: string): MotionlySvgData {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  const width = viewBox?.[2] ?? Number.parseFloat(svg.getAttribute('width') ?? '1');
  const height = viewBox?.[3] ?? Number.parseFloat(svg.getAttribute('height') ?? '1');
  const paths = Array.from(svg.querySelectorAll('path[d]')).map((path, index) => {
    const computed = getComputedSvgStyle(path);
    const stroke = path.getAttribute('stroke') ?? computed['stroke'] ?? 'none';
    const fill = path.getAttribute('fill') ?? computed['fill'] ?? '#000000';
    let length = width + height;
    try {
      length = (path as SVGPathElement).getTotalLength();
    } catch {
      // Detached SVG geometry is unavailable in a few browsers; the reveal still works.
    }
    return {
      d: path.getAttribute('d') ?? '',
      fill: fill.startsWith('url(') ? (index ? '#ffffff' : '#8ab4ff') : fill,
      fillOpacity: Number.parseFloat(
        path.getAttribute('fill-opacity') ?? computed['fillOpacity'] ?? '1'
      ),
      stroke: stroke.startsWith('url(') ? (index ? '#ffffff' : '#8ab4ff') : stroke,
      strokeWidth: Number.parseFloat(
        path.getAttribute('stroke-width') ?? computed['strokeWidth'] ?? '1'
      ),
      opacity: Number.parseFloat(
        path.getAttribute('stroke-opacity') ?? computed['strokeOpacity'] ?? '1'
      ),
      lineCap: (path.getAttribute('stroke-linecap') as CanvasLineCap) || 'butt',
      lineJoin: (path.getAttribute('stroke-linejoin') as CanvasLineJoin) || 'miter',
      length: Math.max(1, length),
    };
  });
  const animated = isAnimatedSvgSource(source, svg);
  return { width, height, animated, paths };
}

export function isAnimatedSvgSource(source: string, root?: Element): boolean {
  return Boolean(
    root?.querySelector('animate, animateMotion, animateTransform, set') ||
    /<(?:animate|animateMotion|animateTransform|set)\b|@keyframes\b|animation(?:-name)?\s*:/i.test(
      source
    )
  );
}

function getComputedSvgStyle(path: Element): Record<string, string> {
  const style = Object.fromEntries(
    (path.getAttribute('style') ?? '')
      .split(';')
      .map((entry) => entry.split(':', 2).map((part) => part.trim()))
      .filter((entry): entry is [string, string] => entry.length === 2 && Boolean(entry[0]))
  );
  return {
    fill: style['fill'] ?? '',
    fillOpacity: style['fill-opacity'] ?? '',
    stroke: style['stroke'] ?? '',
    strokeOpacity: style['stroke-opacity'] ?? '',
    strokeWidth: style['stroke-width'] ?? '',
  };
}

function isGif(url: string): boolean {
  return url.startsWith('data:image/gif') || /\.gif(?:[?#]|$)/i.test(url);
}
