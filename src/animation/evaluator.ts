/**
 * Animation evaluator
 * Evaluates scene state at a specific time by applying animations
 */

import { ease } from '../core/easing';
import { interpolateAngle, interpolateValue } from '../core/interpolate';
import { clamp } from '../core/units';
import type {
  Scene,
  EvaluatedScene,
  Element,
  Animation,
  Keyframe,
  PropertyMap,
  ElementProperties,
  Clip,
  Track,
} from '../types/scene';

interface PreparedScene {
  animationsByTarget: Map<string, Animation[]>;
  clippedAssets: Set<string>;
  clipsById: Map<string, Clip>;
  elementsByAsset: Map<string, Element>;
  elementsById: Map<string, Element>;
  orderedClips: Clip[];
  regularElements: Element[];
  tracksById: Map<string, Track>;
}

const FOLLOW_THROUGH_KEYS = ['x', 'y', 'rotation'] as const;
const ROTATION_KEYS = new Set(['rotation', 'rotationX', 'rotationY']);

const preparedScenes = new WeakMap<Scene, PreparedScene>();
const interpolatedKeys = new WeakMap<Animation, string[]>();

/**
 * Evaluate scene at a specific time
 * Returns the scene with all animations applied
 */
export function evaluateScene(scene: Scene, time: number): EvaluatedScene {
  const prepared = prepareScene(scene);
  const camera = evaluateCamera(scene, prepared, time);

  // Evaluate regular elements
  const elements = prepared.regularElements
    .filter((element) => elementWindowActive(element, time))
    .map((element) => {
      let render = evaluateElement(
        element,
        prepared.animationsByTarget.get(element.id) ?? [],
        time
      );
      if (element.asset) {
        render = { ...render, mediaTime: Math.max(0, time) } as ElementProperties;
      }
      render = applyFollowThrough(element, render, prepared, time);
      return { ...element, render };
    });

  // Visual tracks stack bottom-to-top: higher track numbers render last.
  // Authored source order is the explicit same-track tie-breaker.
  const activeClips = prepared.orderedClips.filter((clip) => {
    const transitionTail = clip.transitionOut === 'crossfade' ? clip.transitionOutDuration : 0;
    return time >= clip.start && time < clip.start + clip.duration + transitionTail;
  });

  for (const clip of activeClips) {
    if (!clip.asset) continue;
    const sourceElement = prepared.elementsByAsset.get(clip.assetName);
    const sourceRender = sourceElement
      ? evaluateElement(
          sourceElement,
          prepared.animationsByTarget.get(sourceElement.id) ?? [],
          time
        )
      : ({
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          center: true,
          cover: false,
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
          (prepared.tracksById.get(String(clip.track))?.muted ?? false) || (clip.mute ?? false),
      } as ElementProperties,
    };

    elements.push(clipElement);
  }

  elements.sort(
    (left, right) => elementTrackRank(prepared, left) - elementTrackRank(prepared, right)
  );
  return { canvas: scene.canvas, camera, elements };
}

function prepareScene(scene: Scene): PreparedScene {
  const cached = preparedScenes.get(scene);
  if (cached) return cached;

  const animationsByTarget = new Map<string, Animation[]>();
  for (const animation of scene.animations) {
    const targetAnimations = animationsByTarget.get(animation.target);
    if (targetAnimations) targetAnimations.push(animation);
    else animationsByTarget.set(animation.target, [animation]);
  }

  const tracksById = new Map(scene.tracks.map((track) => [track.id, track]));
  const elementsByAsset = new Map<string, Element>();
  for (const element of scene.elements) {
    if (element.kind === 'asset' && element.assetName && !elementsByAsset.has(element.assetName)) {
      elementsByAsset.set(element.assetName, element);
    }
  }
  const elementsById = new Map(scene.elements.map((element) => [element.id, element]));

  const prepared: PreparedScene = {
    animationsByTarget,
    clippedAssets: new Set(scene.clips.map((clip) => clip.assetName)),
    clipsById: new Map(scene.clips.map((clip) => [clip.id, clip])),
    elementsByAsset,
    elementsById,
    orderedClips: [],
    regularElements: [],
    tracksById,
  };
  prepared.regularElements = scene.elements.filter(
    (element) =>
      (element.kind !== 'asset' ||
        !element.assetName ||
        !prepared.clippedAssets.has(element.assetName)) &&
      elementTrackVisible(prepared, element)
  );
  prepared.orderedClips = scene.clips
    .filter((clip) => {
      const track = prepared.tracksById.get(String(clip.track));
      return track?.role !== 'audio' && !track?.hidden;
    })
    .sort(
      (left, right) =>
        clipTrackRank(prepared, left.track) - clipTrackRank(prepared, right.track) ||
        left.sourceOrder - right.sourceOrder
    );
  preparedScenes.set(scene, prepared);
  return prepared;
}

function clipTrackRank(prepared: PreparedScene, trackId: number | string): number {
  const track = prepared.tracksById.get(String(trackId));
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

function elementTrackVisible(prepared: PreparedScene, element: Element): boolean {
  const trackId = (element.properties as unknown as Record<string, unknown>)['track'];
  if (trackId === undefined) return true;
  const track = prepared.tracksById.get(String(trackId));
  return track?.role !== 'audio' && !track?.hidden;
}

function elementTrackRank(
  prepared: PreparedScene,
  element: import('../types/scene').EvaluatedElement
): number {
  const clip = prepared.clipsById.get(element.id);
  if (clip) return clipTrackRank(prepared, clip.track);
  const trackId = (element.render as unknown as Record<string, unknown>)['track'];
  if (trackId !== undefined) return clipTrackRank(prepared, String(trackId));
  return 1000;
}

function trackRank(track: number | string): number {
  const rank = Number(track);
  return Number.isFinite(rank) ? rank : 0;
}

/**
 * Layer a lagged, damped copy of a parent element's motion delta onto a child's
 * render, for secondary motion / follow-through. No-op unless the child
 * declares `followThrough <parentId>`.
 */
function applyFollowThrough(
  element: Element,
  render: ElementProperties,
  prepared: PreparedScene,
  time: number
): ElementProperties {
  const props = element.properties as unknown as Record<string, unknown>;
  const parentId = props['followThrough'];
  if (!parentId) return render;

  const parent = prepared.elementsById.get(String(parentId));
  if (!parent) return render;

  const lag = Number(props['followThroughLag'] ?? 0);
  const damping = clamp(Number(props['followThroughDamping'] ?? 0.3), 0, 1);
  const restProps = parent.properties as unknown as Record<string, unknown>;
  const laggedRender = evaluateElement(
    parent,
    prepared.animationsByTarget.get(parent.id) ?? [],
    time - lag
  ) as unknown as Record<string, unknown>;

  const next = { ...render } as Record<string, unknown>;
  for (const key of FOLLOW_THROUGH_KEYS) {
    const rest = Number(restProps[key] ?? 0);
    const lagged = Number(laggedRender[key] ?? rest);
    next[key] = Number(next[key] ?? 0) + (lagged - rest) * damping;
  }

  const restScale = Number(restProps['scale'] ?? 1) || 1;
  const laggedScale = Number(laggedRender['scale'] ?? restScale) || restScale;
  next['scale'] = Number(next['scale'] ?? 1) * (1 + (laggedScale / restScale - 1) * damping);

  return next as unknown as ElementProperties;
}

/**
 * Evaluate camera state at a specific time
 */
function evaluateCamera(scene: Scene, prepared: PreparedScene, time: number): ElementProperties {
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
  return evaluateElement(
    cameraElement,
    prepared.animationsByTarget.get(cameraElement.id) ?? [],
    time
  );
}

/**
 * Evaluate element state at a specific time by applying all animations
 */
function evaluateElement(
  element: Element,
  animations: Animation[],
  time: number
): ElementProperties {
  if (animations.length === 0) return element.properties;

  let state: Record<string, unknown> = { ...element.properties } as unknown as Record<
    string,
    unknown
  >;

  for (const animation of animations) {
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

  const rawCycles = animation.duration > 0 ? localTime / animation.duration : 0;
  const rawProgress =
    animation.repeat === undefined
      ? clamp(rawCycles)
      : resolveCycleProgress(
          rawCycles,
          animation.repeat === 'infinite' ? Infinity : Math.max(Number(animation.repeat), 0),
          animation.repeatType ?? 'loop'
        );

  if (animation.keyframes.length > 0) {
    return applyKeyframes(state, animation.keyframes, rawProgress, animation.easing);
  }

  if (localTime === 0) return { ...state, ...animation.from };

  const progress = ease(rawProgress, animation.easing);
  const next: PropertyMap = { ...state };
  let keys = interpolatedKeys.get(animation);
  if (!keys) {
    keys = [...new Set([...Object.keys(animation.from), ...Object.keys(animation.to)])];
    interpolatedKeys.set(animation, keys);
  }

  const direction = (state['rotationDirection'] as 'auto' | 'cw' | 'ccw' | undefined) ?? 'auto';

  for (const key of keys) {
    const from = animation.from[key] ?? state[key] ?? 0;
    const to = animation.to[key] ?? state[key] ?? 0;
    next[key] = ROTATION_KEYS.has(key)
      ? interpolateAngle(Number(from), Number(to), progress, direction)
      : interpolateValue(from, to, progress);
  }

  return next;
}

/**
 * Remap raw elapsed cycles (localTime / duration) into a 0-1 in-cycle
 * progress value, honoring a repeat count ('infinite' or a number) and
 * repeat type ('loop' replays forward each cycle, 'yoyo' alternates).
 */
function resolveCycleProgress(
  rawCycles: number,
  maxCycles: number,
  repeatType: 'loop' | 'yoyo'
): number {
  if (maxCycles <= 0) return 0;

  const clampedCycles = Math.min(rawCycles, maxCycles);
  let cycleIndex = Math.floor(clampedCycles);
  let position = clampedCycles - cycleIndex;

  // Landing exactly on a cycle boundary at the end of playback means the
  // previous cycle just completed; hold at its end rather than the start
  // of a cycle that never plays.
  if (position === 0 && clampedCycles > 0 && clampedCycles === maxCycles) {
    cycleIndex -= 1;
    position = 1;
  }

  if (repeatType === 'yoyo' && cycleIndex % 2 === 1) {
    return 1 - position;
  }
  return position;
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

  const next: PropertyMap = { ...state };
  const keys = new Set(keyframes.flatMap((frame) => Object.keys(frame.properties)));
  const direction = (state['rotationDirection'] as 'auto' | 'cw' | 'ccw' | undefined) ?? 'auto';

  for (const key of keys) {
    const propertyFrames = keyframes.filter((frame) => key in frame.properties);
    const first = propertyFrames[0];
    const last = propertyFrames[propertyFrames.length - 1];
    if (!first || !last) continue;
    if (progress <= first.offset || first === last) {
      next[key] = first.properties[key]!;
      continue;
    }
    if (progress >= last.offset) {
      next[key] = last.properties[key]!;
      continue;
    }

    for (let index = 0; index < propertyFrames.length - 1; index += 1) {
      const left = propertyFrames[index];
      const right = propertyFrames[index + 1];
      if (!left || !right || progress < left.offset || progress > right.offset) continue;
      const span = right.offset - left.offset || 1;
      const local = ease((progress - left.offset) / span, right.easing ?? easing);
      next[key] = ROTATION_KEYS.has(key)
        ? interpolateAngle(
            Number(left.properties[key]),
            Number(right.properties[key]),
            local,
            direction
          )
        : interpolateValue(left.properties[key]!, right.properties[key]!, local);
      break;
    }
  }

  return next;
}
