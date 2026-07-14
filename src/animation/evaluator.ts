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
  const elements = scene.elements.map((element) => ({
    ...element,
    render: evaluateElement(element, scene.animations, time),
  }));

  return { canvas: scene.canvas, camera, elements };
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
  const local = ease((progress - left.offset) / span, easing);
  const keys = new Set([...Object.keys(left.properties), ...Object.keys(right.properties)]);

  for (const key of keys) {
    const from = left.properties[key] ?? state[key] ?? 0;
    const to = right.properties[key] ?? state[key] ?? 0;
    next[key] = interpolateValue(from, to, local);
  }

  return next;
}
