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
  EvaluatedElement,
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

  const parentStart = new Map<string, number>();
  const globalStart = (element: Element): number => {
    const cached = parentStart.get(element.id);
    if (cached !== undefined) return cached;
    const parent = prepared.elementsById.get(String(element.properties.parent ?? ''));
    const value = parent ? globalStart(parent) + finiteNumber(parent.properties.start, 0) : 0;
    parentStart.set(element.id, value);
    return value;
  };

  // Evaluate regular elements in parent-local time.
  const elements = prepared.regularElements
    .filter((element) => hierarchyWindowActive(element, prepared, time, globalStart))
    .map((element) => {
      const localTime = time - globalStart(element);
      let render = evaluateElement(
        element,
        prepared.animationsByTarget.get(element.id) ?? [],
        localTime
      );
      if (element.asset) {
        // Media playback starts when the element's own window opens, not at
        // the global timeline zero — a video inside `scene { start 5s }`
        // plays from its first frame, not five seconds in.
        const windowStart = finiteNumber(element.properties.start, 0);
        render = {
          ...render,
          mediaTime: Math.max(0, localTime - windowStart),
        } as ElementProperties;
      }
      render = applyFollowThrough(element, render, prepared, localTime);
      if (element.kind === 'scene') {
        render = applySceneEnvelope(element, render, time, globalStart(element));
      }
      return { ...element, render };
    });

  // Structural transitions must move the group before its transform is pushed
  // into visible descendants. Leaf transitions stay here in resolved world space.
  applySharedTransitions(scene, elements, time, 'structural');
  resolveHierarchy(elements);
  applySharedTransitions(scene, elements, time, 'leaf');

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
          time - globalStart(sourceElement)
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

  // Clips are synthesized after regular elements, so resolve their authored
  // scene/group parent now instead of leaving media detached from transitions.
  resolveHierarchy(elements);
  resolveSemanticRelationships(elements);
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
  for (const animations of animationsByTarget.values()) {
    animations.sort((left, right) => left.delay - right.delay);
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

function hierarchyWindowActive(
  element: Element,
  prepared: PreparedScene,
  time: number,
  parentStart: (element: Element) => number
): boolean {
  let cursor: Element | undefined = element;
  while (cursor) {
    const hasStart = Number.isFinite(Number(cursor.properties.start));
    const duration = Number(cursor.properties.duration);
    const hasDuration = Number.isFinite(duration);
    if (hasStart || hasDuration) {
      const start = parentStart(cursor) + finiteNumber(cursor.properties.start, 0);
      if (time < start) return false;
      if (hasDuration && time >= start + Math.max(0, duration)) return false;
    }
    cursor = prepared.elementsById.get(String(cursor.properties.parent ?? ''));
  }
  return true;
}

function resolveHierarchy(elements: EvaluatedElement[]): void {
  const evaluated = new Map(elements.map((element) => [element.id, element]));
  const resolving = new Set<string>();
  const resolve = (element: EvaluatedElement): EvaluatedElement => {
    const current = evaluated.get(element.id)!;
    if ((current.render as unknown as Record<string, unknown>)['worldResolved']) return current;
    if (resolving.has(element.id)) return current;
    resolving.add(element.id);
    const parent = evaluated.get(String(current.render.parent ?? ''));
    let render = { ...(current.render as unknown as Record<string, unknown>) };
    if (parent) {
      const resolvedParent = resolve(parent);
      const parentRender = resolvedParent.render as unknown as Record<string, unknown>;
      const parentScale = finiteNumber(parentRender['scale'], 1);
      const parentRotation = finiteNumber(parentRender['rotation'], 0);
      const radians = (parentRotation * Math.PI) / 180;
      let localX = finiteNumber(render['x'], 0);
      let localY = finiteNumber(render['y'], 0);
      let localScale = 1;
      let rotation = parentRotation + finiteNumber(render['rotation'], 0);
      if (
        current.kind === 'overlay' &&
        (resolvedParent.kind === 'image' || resolvedParent.kind === 'asset')
      ) {
        render['imageOverlayX'] = localX;
        render['imageOverlayY'] = localY;
        render['imageOverlayScale'] = finiteNumber(render['scale'], 1);
        render['imageOverlayRotation'] = finiteNumber(render['rotation'], 0);
      }

      if (resolvedParent.kind === 'scene') {
        const depth = clamp(finiteNumber(render['depth'], 1), 0, 1);
        const zoom = 1 + (finiteNumber(parentRender['cameraZoom'], 1) - 1) * depth;
        localX = (localX - finiteNumber(parentRender['cameraX'], 0) * depth) * zoom;
        localY = (localY - finiteNumber(parentRender['cameraY'], 0) * depth) * zoom;
        localScale = zoom;
        rotation += finiteNumber(parentRender['cameraRotation'], 0) * depth;
      }
      const scaledX = localX * parentScale;
      const scaledY = localY * parentScale;
      render['x'] =
        finiteNumber(parentRender['x'], 0) +
        scaledX * Math.cos(radians) -
        scaledY * Math.sin(radians);
      render['y'] =
        finiteNumber(parentRender['y'], 0) +
        scaledX * Math.sin(radians) +
        scaledY * Math.cos(radians);
      render['scale'] = finiteNumber(render['scale'], 1) * parentScale * localScale;
      render['rotation'] = rotation;
      render['opacity'] =
        finiteNumber(render['opacity'], 1) * finiteNumber(parentRender['opacity'], 1);
      render['blur'] = finiteNumber(render['blur'], 0) + finiteNumber(parentRender['blur'], 0);
      render['center'] = true;
      if (!render['mask'] && parentRender['mask']) {
        render['mask'] = parentRender['mask'];
        render['maskInvert'] = parentRender['maskInvert'];
        render['maskVisible'] = parentRender['maskVisible'];
      }

      if (parentRender['clip'] && parentRender['width'] && parentRender['height']) {
        render['clipX'] = finiteNumber(parentRender['x'], 0);
        render['clipY'] = finiteNumber(parentRender['y'], 0);
        render['clipWidth'] = Math.abs(finiteNumber(parentRender['width'], 0) * parentScale);
        render['clipHeight'] = Math.abs(finiteNumber(parentRender['height'], 0) * parentScale);
        render['clipRotation'] = parentRotation;
      } else {
        for (const key of ['clipX', 'clipY', 'clipWidth', 'clipHeight', 'clipRotation']) {
          if (parentRender[key] !== undefined) render[key] = parentRender[key];
        }
      }
    }
    render['worldResolved'] = true;
    const resolved = { ...current, render: render as unknown as ElementProperties };
    evaluated.set(element.id, resolved);
    resolving.delete(element.id);
    return resolved;
  };
  for (let index = 0; index < elements.length; index += 1)
    elements[index] = resolve(elements[index]!);
}

function applySharedTransitions(
  scene: Scene,
  elements: EvaluatedElement[],
  time: number,
  phase: 'structural' | 'leaf'
): void {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const transition of scene.transitions) {
    const start = transition.at - transition.duration / 2;
    if (time < start || time > start + transition.duration) continue;
    const source = byId.get(transition.from);
    const target = byId.get(transition.to);
    if (!source || !target) continue;
    const structural =
      source.kind === 'group' ||
      source.kind === 'scene' ||
      target.kind === 'group' ||
      target.kind === 'scene';
    if ((phase === 'structural') !== structural) continue;
    const progress = ease(clamp((time - start) / transition.duration), transition.easing);
    const from = source.render as unknown as Record<string, unknown>;
    const to = target.render as unknown as Record<string, unknown>;
    const matchingImage =
      source.kind === 'image' &&
      target.kind === 'image' &&
      String(from['source'] ?? '') === String(to['source'] ?? '');
    const next = { ...from };
    for (const key of [
      'x',
      'y',
      'width',
      'height',
      'scale',
      'rotation',
      'opacity',
      'radius',
      'fill',
      'stroke',
    ]) {
      if (from[key] !== undefined && to[key] !== undefined) {
        next[key] = interpolateValue(
          from[key] as string | number,
          to[key] as string | number,
          progress
        );
      }
    }
    if (structural) {
      const fromWidth = finiteNumber(from['width'], 0);
      const toWidth = finiteNumber(to['width'], 0);
      if (fromWidth > 0 && toWidth > 0) {
        const fromScale = finiteNumber(from['scale'], 1);
        const fittedScale = (toWidth * finiteNumber(to['scale'], 1)) / fromWidth;
        next['scale'] = fromScale + (fittedScale - fromScale) * progress;
      }
      const handoff = clamp((progress - 0.62) / 0.38);
      next['opacity'] = finiteNumber(from['opacity'], 1) * (1 - handoff);
      source.render = next as unknown as ElementProperties;
      target.render = {
        ...target.render,
        opacity: finiteNumber(to['opacity'], 1) * handoff,
      } as ElementProperties;
      continue;
    }
    if (source.kind === 'path' && target.kind === 'path') {
      const morphed = interpolateCompatiblePath(
        String(from['path'] ?? ''),
        String(to['path'] ?? ''),
        progress
      );
      if (morphed) next['path'] = morphed;
      else next['opacity'] = finiteNumber(next['opacity'], 1) * (1 - progress);
    }
    if (source.kind === 'image' && target.kind === 'image' && !matchingImage) {
      next['opacity'] = finiteNumber(next['opacity'], 1) * (1 - progress);
    }
    source.render = next as unknown as ElementProperties;
    // The destination fades in under the morphing source instead of being
    // pinned invisible: at the window's end it is already at full strength,
    // so the hand-off never pops.
    target.render = {
      ...target.render,
      opacity:
        finiteNumber(to['opacity'], 1) *
        (matchingImage ? clamp((progress - 0.75) / 0.25) : progress),
    } as ElementProperties;
  }
}

function interpolateCompatiblePath(from: string, to: string, progress: number): string | null {
  const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
  const fromNumbers = from.match(numberPattern)?.map(Number) ?? [];
  const toNumbers = to.match(numberPattern)?.map(Number) ?? [];
  const fromShape = from.replace(numberPattern, '#');
  const toShape = to.replace(numberPattern, '#');
  if (fromShape !== toShape || fromNumbers.length !== toNumbers.length) return null;
  let index = 0;
  return from.replace(numberPattern, () => {
    const value = fromNumbers[index]! + (toNumbers[index]! - fromNumbers[index]!) * progress;
    index += 1;
    return String(Number(value.toFixed(3)));
  });
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

/** Keep semantic connectors and data particles attached to evaluated component transforms. */
function resolveSemanticRelationships(elements: EvaluatedElement[]): void {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (!element) continue;
    const render = element.render as unknown as Record<string, unknown>;
    const fromId = String(render['relationshipFrom'] ?? '');
    const toId = String(render['relationshipTo'] ?? '');
    if (!fromId || !toId) continue;

    const source = byId.get(fromId);
    const target = byId.get(toId);
    if (!source || !target) {
      // An endpoint outside its timing window is not on screen — the
      // connector and its particles must disappear with it.
      const hidden = {
        ...element,
        render: { ...render, opacity: 0 } as unknown as ElementProperties,
      };
      elements[index] = hidden;
      byId.set(element.id, hidden);
      continue;
    }
    const sourceRender = source.render as unknown as Record<string, unknown>;
    const targetRender = target.render as unknown as Record<string, unknown>;
    const sourcePoint = {
      x: finiteNumber(sourceRender['x'], 0),
      y: finiteNumber(sourceRender['y'], 0),
      radius:
        finiteNumber(render['relationshipSourceRadius'], 0) *
        Math.abs(finiteNumber(sourceRender['scale'], 1)),
    };
    const targetPoint = {
      x: finiteNumber(targetRender['x'], 0),
      y: finiteNumber(targetRender['y'], 0),
      radius:
        finiteNumber(render['relationshipTargetRadius'], 0) *
        Math.abs(finiteNumber(targetRender['scale'], 1)),
    };
    const endpoints = relationshipEndpoints(sourcePoint, targetPoint);
    const next = { ...render };
    const endpointOpacity = Math.min(
      endpointVisibility(sourceRender),
      endpointVisibility(targetRender)
    );
    next['opacity'] = finiteNumber(render['opacity'], 1) * endpointOpacity;
    if (typeof render['relationshipProgress'] === 'number') {
      const progress = clamp(finiteNumber(render['relationshipProgress'], 0));
      next['x'] = endpoints.start.x + (endpoints.end.x - endpoints.start.x) * progress;
      next['y'] = endpoints.start.y + (endpoints.end.y - endpoints.start.y) * progress;
    } else {
      next['x'] = endpoints.start.x;
      next['y'] = endpoints.start.y;
      next['x2'] = endpoints.end.x - endpoints.start.x;
      next['y2'] = endpoints.end.y - endpoints.start.y;
    }
    const resolved = { ...element, render: next as unknown as ElementProperties };
    elements[index] = resolved;
    byId.set(element.id, resolved);
  }
}

/**
 * How visible an endpoint actually is on screen: presets like maskReveal and
 * drawSVG hide elements behind revealProgress/pathProgress at full opacity,
 * so connectors must honor those reveals too, not just opacity.
 */
function endpointVisibility(render: Record<string, unknown>): number {
  let visibility = clamp(finiteNumber(render['opacity'], 1));
  if (typeof render['revealProgress'] === 'number') {
    visibility *= clamp(render['revealProgress']);
  }
  if (typeof render['pathProgress'] === 'number') {
    visibility *= clamp(render['pathProgress']);
  }
  return visibility;
}

function relationshipEndpoints(
  source: { x: number; y: number; radius: number },
  target: { x: number; y: number; radius: number }
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: source.x + ux * source.radius, y: source.y + uy * source.radius },
    end: { x: target.x - ux * target.radius, y: target.y - uy * target.radius },
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Fade a scene's opacity over its optional `enter`/`exit` windows so every
 * descendant (which multiplies its parent's opacity during hierarchy
 * resolution) enters and leaves cleanly instead of popping at the scene
 * boundary. Scenes without these properties are untouched.
 */
function applySceneEnvelope(
  element: Element,
  render: ElementProperties,
  time: number,
  parentStart: number
): ElementProperties {
  const raw = render as unknown as Record<string, unknown>;
  const hasTransitionIn = String(raw['transitionIn'] ?? '').startsWith('scene');
  const hasTransitionOut = String(raw['transitionOut'] ?? '').startsWith('scene');
  const enter = hasTransitionIn ? 0 : Math.max(0, finiteNumber(raw['enter'], 0));
  const exit = hasTransitionOut ? 0 : Math.max(0, finiteNumber(raw['exit'], 0));
  if (enter <= 0 && exit <= 0) return render;

  const start = parentStart + finiteNumber(element.properties.start, 0);
  const duration = Number(element.properties.duration);
  let envelope = 1;
  if (enter > 0) {
    envelope *= ease(clamp((time - start) / enter), 'power2.out');
  }
  if (exit > 0 && Number.isFinite(duration)) {
    envelope *= 1 - ease(clamp((time - (start + duration - exit)) / exit), 'power2.in');
  }
  if (envelope >= 1) return render;
  return { ...render, opacity: finiteNumber(raw['opacity'], 1) * envelope } as ElementProperties;
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

  const entrance = entranceState(animations);
  if (entrance && time < entrance.delay) {
    state = { ...state, ...entrance.state };
  }

  return state as unknown as ElementProperties;
}

const entranceStates = new WeakMap<Animation[], { delay: number; state: PropertyMap } | null>();

function animationStartValues(animation: Animation): PropertyMap {
  return animation.keyframes.length > 0
    ? (animation.keyframes[0]?.properties ?? {})
    : animation.from;
}

function declaresHiddenStart(animation: Animation): boolean {
  const start = animationStartValues(animation);
  const end =
    animation.keyframes.length > 0 ? (animation.keyframes.at(-1)?.properties ?? {}) : animation.to;
  const startOpacity = Number(start['opacity']);
  return (
    start['opacity'] !== undefined && startOpacity < 1 && Number(end['opacity'] ?? 1) > startOpacity
  );
}

/**
 * Resolve the pre-entrance state for a target: the start values of its
 * earliest animation that begins at less-than-full opacity, applied whenever
 * the timeline sits before that start. A delayed entrance must keep its
 * element hidden instead of showing the final authored state — even when
 * idle loops on the same target start earlier. Targets with no such
 * entrance (move-only or exit animations) keep the original
 * hold-at-authored-state behavior so existing projects are unaffected.
 */
function entranceState(animations: Animation[]): { delay: number; state: PropertyMap } | null {
  const cached = entranceStates.get(animations);
  if (cached !== undefined) return cached;

  let delay = Infinity;
  for (const animation of animations) {
    if (animation.repeat !== undefined) continue;
    if (animation.delay < delay && declaresHiddenStart(animation)) {
      delay = animation.delay;
    }
  }

  let entrance: { delay: number; state: PropertyMap } | null = null;
  if (delay > 0 && Number.isFinite(delay)) {
    const state: PropertyMap = {};
    for (const animation of animations) {
      if (animation.repeat !== undefined) continue;
      if (animation.delay !== delay) continue;
      const start = animationStartValues(animation);
      if (declaresHiddenStart(animation)) Object.assign(state, start);
    }
    entrance = { delay, state };
  }

  entranceStates.set(animations, entrance);
  return entrance;
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
