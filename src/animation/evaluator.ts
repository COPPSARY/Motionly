/**
 * Animation evaluator
 * Evaluates scene state at a specific time by applying animations
 */

import { ease } from '../core/easing';
import { interpolateValue } from '../core/interpolate';
import { clamp } from '../core/units';
import type {
  Scene,
  EvaluatedScene,
  Element,
  Animation,
  Keyframe,
  PropertyMap,
  ElementProperties,
} from '../types/scene';

/**
 * Evaluate scene at a specific time
 * Returns the scene with all animations applied
 */
export function evaluateScene(scene: Scene, time: number): EvaluatedScene {
  const camera = evaluateCamera(scene, time);
  const clippedAssets = new Set(scene.clips.map((clip) => clip.assetName));

  // Evaluate regular elements
  const elements = scene.elements
    .filter(
      (element) =>
        (element.kind !== 'asset' || !element.assetName || !clippedAssets.has(element.assetName)) &&
        elementTrackVisible(scene, element) &&
        elementWindowActive(element, time)
    )
    .map((element) => {
      const render = evaluateElement(element, scene.animations, time);
      if (element.asset?.type === 'video') render.mediaTime = Math.max(0, time);
      return { ...element, render };
    });

  // Visual tracks stack bottom-to-top: higher track numbers render last.
  // Authored source order is the explicit same-track tie-breaker.
  const activeClips = scene.clips
    .filter((clip) => {
      const track = scene.tracks.find((candidate) => candidate.id === String(clip.track));
      if (track?.role === 'audio' || track?.hidden) return false;
      const transitionTail = clip.transitionOut === 'crossfade' ? clip.transitionOutDuration : 0;
      return time >= clip.start && time < clip.start + clip.duration + transitionTail;
    })
    .sort(
      (a, b) =>
        clipTrackRank(scene, a.track) - clipTrackRank(scene, b.track) ||
        a.sourceOrder - b.sourceOrder
    );

  for (const clip of activeClips) {
    if (!clip.asset) continue;
    const sourceElement = scene.elements.find(
      (element) => element.kind === 'asset' && element.assetName === clip.assetName
    );
    const sourceRender = sourceElement
      ? evaluateElement(sourceElement, scene.animations, time)
      : ({
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          center: true,
          cover: true,
          layer: 'content',
        } as ElementProperties);

    const clipEnd = clip.start + clip.duration;
    let transitionOpacity = 1;
    if (clip.transitionIn === 'crossfade' && clip.transitionInDuration > 0) {
      transitionOpacity *= clamp((time - clip.start) / clip.transitionInDuration);
    }
    if (clip.transitionOut === 'crossfade' && clip.transitionOutDuration > 0 && time >= clipEnd) {
      transitionOpacity *= 1 - clamp((time - clipEnd) / clip.transitionOutDuration);
    }
    const sourceOpacity = Number(sourceRender.opacity ?? 1);

    const clipElement: import('../types/scene').EvaluatedElement = {
      id: clip.id,
      kind: 'asset',
      assetName: clip.assetName,
      asset: clip.asset,
      properties: sourceElement?.properties ?? ({} as ElementProperties),
      render: {
        ...sourceRender,
        opacity: sourceOpacity * transitionOpacity,
        mediaTime: Math.max(0, clip.trimIn + time - clip.start),
        mediaTrimOut: clip.trimOut,
        mediaVolume: clip.volume ?? 1,
        mediaMuted:
          (scene.tracks.find((track) => track.id === String(clip.track))?.muted ?? false) ||
          (clip.mute ?? false),
      } as ElementProperties,
    };

    elements.push(clipElement);
  }

  elements.sort((left, right) => elementTrackRank(scene, left) - elementTrackRank(scene, right));
  return { canvas: scene.canvas, camera, elements };
}

function clipTrackRank(scene: Scene, trackId: number | string): number {
  const track = scene.tracks.find((candidate) => candidate.id === String(trackId));
  if (track) return track.role === 'main' ? 0 : 100 + track.order;
  return trackRank(trackId);
}

function elementWindowActive(element: Element, time: number): boolean {
  const properties = element.properties as unknown as Record<string, unknown>;
  if (properties['start'] === undefined || properties['duration'] === undefined) return true;
  const start = Number(properties['start']);
  const duration = Number(properties['duration']);
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return true;
  return time >= start && time < start + Math.max(0, duration);
}

function elementTrackVisible(scene: Scene, element: Element): boolean {
  const trackId = (element.properties as unknown as Record<string, unknown>)['track'];
  if (trackId === undefined) return true;
  const track = scene.tracks.find((candidate) => candidate.id === String(trackId));
  return track?.role !== 'audio' && !track?.hidden;
}

function elementTrackRank(
  scene: Scene,
  element: import('../types/scene').EvaluatedElement
): number {
  const clip = scene.clips.find((candidate) => candidate.id === element.id);
  if (clip) return clipTrackRank(scene, clip.track);
  const trackId = (element.render as unknown as Record<string, unknown>)['track'];
  if (trackId !== undefined) return clipTrackRank(scene, String(trackId));
  return 1000;
}

function trackRank(track: number | string): number {
  const rank = Number(track);
  return Number.isFinite(rank) ? rank : 0;
}

/**
 * Evaluate camera state at a specific time
 */
function evaluateCamera(scene: Scene, time: number): ElementProperties {
  const cameraElement: Element = {
    id: 'camera',
    kind: 'asset',
    assetName: null,
    asset: null,
    properties: (scene.camera ?? {
      x: 0,
      y: 0,
      zoom: 1,
      rotation: 0,
    }) as unknown as ElementProperties,
  };
  return evaluateElement(cameraElement, scene.animations, time);
}

/**
 * Evaluate element state at a specific time by applying all animations
 */
function evaluateElement(
  element: Element,
  animations: Animation[],
  time: number
): ElementProperties {
  let state: Record<string, unknown> = { ...element.properties } as unknown as Record<
    string,
    unknown
  >;

  for (const animation of animations.filter((item) => item.target === element.id)) {
    state = applyAnimation(state as PropertyMap, animation, time) as unknown as Record<
      string,
      unknown
    >;
  }

  return state as unknown as ElementProperties;
}

/**
 * Apply a single animation to element state
 */
function applyAnimation(state: PropertyMap, animation: Animation, time: number): PropertyMap {
  const localTime = time - animation.delay;

  if (localTime < 0) return state;

  const rawProgress = clamp(localTime / animation.duration);

  if (animation.keyframes.length > 0) {
    return applyKeyframes(state, animation.keyframes, rawProgress, animation.easing);
  }

  if (localTime === 0) return { ...state, ...animation.from };

  const progress = ease(rawProgress, animation.easing);
  const next: PropertyMap = { ...state };
  const keys = new Set([...Object.keys(animation.from), ...Object.keys(animation.to)]);

  for (const key of keys) {
    const from = animation.from[key] ?? state[key] ?? 0;
    const to = animation.to[key] ?? state[key] ?? 0;
    next[key] = interpolateValue(from, to, progress);
  }

  return next;
}

/**
 * Apply keyframe-based animation
 */
function applyKeyframes(
  state: PropertyMap,
  keyframes: Keyframe[],
  progress: number,
  easing: string
): PropertyMap {
  if (keyframes.length === 0) return state;

  const firstFrame = keyframes[0];
  const lastFrame = keyframes[keyframes.length - 1];

  if (!firstFrame || !lastFrame) return state;

  if (progress <= firstFrame.offset) {
    return { ...state, ...firstFrame.properties };
  }

  if (progress >= lastFrame.offset) {
    return { ...state, ...lastFrame.properties };
  }

  const next: PropertyMap = { ...state };
  let left = firstFrame;
  let right = lastFrame;

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const nextFrame = keyframes[index + 1];

    if (!current || !nextFrame) continue;

    if (progress >= current.offset && progress <= nextFrame.offset) {
      left = current;
      right = nextFrame;
      break;
    }
  }

  const span = right.offset - left.offset || 1;
  const segmentEasing = right.easing ?? easing;
  const local = ease((progress - left.offset) / span, segmentEasing);
  const keys = new Set([...Object.keys(left.properties), ...Object.keys(right.properties)]);

  for (const key of keys) {
    const from = left.properties[key] ?? state[key] ?? 0;
    const to = right.properties[key] ?? state[key] ?? 0;
    next[key] = interpolateValue(from, to, local);
  }

  return next;
}
