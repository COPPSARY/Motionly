/**
 * Animation preset library
 * Provides reusable animation presets for text, objects, cameras, and effects
 */

import { parsePresetCall } from './preset-parser';
import { ARRIVAL } from '../motion-system/layout';
import { TRANSITION_TOKENS } from '../motion-system/budget';
import { countDecimalPlaces, resolveCountSeparator } from './count-up';
import { elementSequenceOffset } from '../core/stagger';
import {
  canonicalMoveName,
  effectRegistry,
  moveRegistry,
  validateCatalogProperties,
} from '../semantic/catalog';
import type {
  Scene,
  Element,
  Animation,
  Keyframe,
  PropertyMap,
  ElementProperties,
} from '../types/scene';

const TEXT_PRESETS = new Set(
  moveRegistry()
    .filter((entry) => entry.category.includes('text'))
    .map((entry) => entry.name)
);

const OBJECT_PRESETS = new Set(
  moveRegistry()
    .filter(
      (entry) => /object|transition/.test(entry.category) && !entry.category.includes('scene')
    )
    .map((entry) => entry.name)
);

const SCENE_TRANSITION_PRESETS = new Set(
  moveRegistry()
    .filter((entry) => entry.category.includes('scene'))
    .map((entry) => entry.name)
);

/**
 * Apply animation presets to scene, generating elements and animations
 */
export function applyAnimationPresets(scene: Scene): Scene {
  const generatedElements: Element[] = [];
  const generatedAnimations: Animation[] = [];
  const sourceElements: Element[] = [];

  for (const element of scene.elements) {
    const props = element.properties as unknown as Record<string, unknown>;
    const animationPreset = props['animation'];
    const textAnimationPreset = props['textAnimation'];
    if (animationPreset) validateMoveCall(animationPreset);
    if (textAnimationPreset) validateMoveCall(textAnimationPreset);
    if (element.kind === 'scene') {
      for (const phase of ['in', 'out'] as const) {
        const value = props[phase === 'in' ? 'transitionIn' : 'transitionOut'];
        if (!value || !SCENE_TRANSITION_PRESETS.has(parsePresetCall(value).name)) continue;
        validateMoveCall(value);
        generatedAnimations.push(...sceneTransitionAnimations(element, String(value), phase));
      }
    }
    const textPreset =
      canonicalMoveName(parsePresetCall(animationPreset).name) === 'countUp'
        ? animationPreset
        : (textAnimationPreset ?? animationPreset);

    if (element.kind === 'text' && textPreset && isTextPreset(textPreset as string)) {
      if (canonicalMoveName(parsePresetCall(textPreset).name) === 'countUp') {
        const generated = expandCountUpPreset(element, textPreset as string);
        const seqOffset = elementSequenceOffset(scene.sequences, props['sequence'], element.id);
        sourceElements.push(generated.element);
        generatedAnimations.push(...offsetDelays(generated.animations, seqOffset, 1));
        continue;
      }

      const generated = expandTextPreset(element, textPreset as string);
      const seqOffset = elementSequenceOffset(scene.sequences, props['sequence'], element.id);
      sourceElements.push(hideElement(element));
      generatedElements.push(...generated.elements);
      generatedAnimations.push(
        ...offsetDelays(generated.animations, seqOffset, generated.elements.length)
      );
      generatedAnimations.push(
        ...scene.animations
          .filter((animation) => animation.target === element.id)
          .flatMap((animation) =>
            generated.elements.map((part) => ({ ...animation, target: part.id }))
          )
      );
      continue;
    }

    const bgEffect = props['backgroundEffect'];
    if (bgEffect) {
      const generated = backgroundEffect(element);
      generatedElements.push(...generated.elements);
      generatedAnimations.push(...generated.animations);
    }

    const animation = props['animation'];
    if (animation && isObjectPreset(animation as string)) {
      const parsedPreset = parsePresetCall(animation);
      const preset = canonicalMoveName(parsedPreset.name);
      const presetAnimations = objectPresetAnimations(element);
      if (presetAnimations[0]) {
        presetAnimations[0] = applyEntranceQuality(presetAnimations[0], parsedPreset.options);
      }

      // Delayed entrance presets must render in their entrance state before the
      // animation starts. Otherwise the authored/rest properties make future
      // scene layers visible until their delay is reached. Exit-only and idle
      // presets are intentionally excluded by requiring a hidden/progress-zero
      // first state.
      const firstAnimation = presetAnimations[0];
      const rawEntranceState = firstAnimation
        ? (firstAnimation.keyframes[0]?.properties ?? firstAnimation.from)
        : {};
      const entranceState = Object.fromEntries(
        Object.entries(rawEntranceState).filter(([, value]) => value !== undefined)
      ) as PropertyMap;
      const seedsEntranceState =
        Number(entranceState['opacity']) === 0 ||
        ['revealProgress', 'pathProgress', 'morphProgress'].some(
          (key) => key in entranceState && Number(entranceState[key]) === 0
        );

      sourceElements.push({
        ...element,
        properties: {
          ...element.properties,
          ...(preset === 'drawSVG' ? { pathProgress: 0 } : {}),
          ...(preset === 'morph' ? { morphProgress: 0 } : {}),
          ...(['highlight-circle-reveal', 'animated-arrow-point'].includes(preset)
            ? { pathProgress: 0 }
            : {}),
          ...(preset === 'spotlight-mask' ? { revealProgress: 0 } : {}),
          ...(['shapeWipe', 'irisWipe', 'maskReveal'].includes(preset)
            ? { revealProgress: 0, revealStyle: preset === 'irisWipe' ? 'iris' : 'linear' }
            : {}),
          ...(['shapeWipe', 'maskReveal'].includes(preset)
            ? {
                revealDirection: String(parsedPreset.options['direction'] ?? 'right'),
              }
            : {}),
          ...(seedsEntranceState ? entranceState : {}),
        },
      });
      const seqOffset = elementSequenceOffset(scene.sequences, props['sequence'], element.id);
      generatedAnimations.push(
        ...snapPresetArrivalOpacity(offsetDelays(presetAnimations, seqOffset))
      );
    } else {
      sourceElements.push(element);
    }
  }

  return {
    ...scene,
    elements: [...sourceElements, ...generatedElements],
    animations: [...generatedAnimations, ...scene.animations],
  };
}

function expandCountUpPreset(
  element: Element,
  value: string
): { element: Element; animations: Animation[] } {
  const { options } = parsePresetCall(value);
  const props = element.properties as unknown as Record<string, unknown>;
  const from = finiteNumber(options['from'], 0);
  const to = finiteNumber(options['to'], finiteNumber(props['value'], 0));
  const direction = String(options['direction'] ?? 'up').toLowerCase();
  const start = direction === 'down' ? to : from;
  const end = direction === 'down' ? from : to;
  const delay = finiteNumber(options['delay'], 0);
  const duration = Math.max(0.001, finiteNumber(options['duration'], 2));
  const easing = String(options['ease'] ?? options['easing'] ?? 'power3.out');
  const opacity = (props['opacity'] as number) || 1;

  // countUp only animates `value`; fold opacity in too so the element follows
  // the same "hidden until shown" contract every other preset relies on.
  const animations: Animation[] = [
    {
      target: element.id,
      from: { value: start, opacity: 0 },
      to: { value: end, opacity },
      keyframes: [],
      delay,
      duration,
      easing,
    },
  ];

  if (options['exitAt'] != null) {
    animations.push(
      basicAnimation(
        element.id,
        options['exitAt'] as number,
        (options['exitDuration'] as number) ?? 0.5,
        (options['exitEase'] as string) ?? 'power2.in',
        { value: end, opacity },
        { value: end, opacity: 0 }
      )
    );
  }

  return {
    element: {
      ...element,
      properties: {
        ...element.properties,
        value: start,
        countSeparator: resolveCountSeparator(options['separator']),
        countDecimals: Math.max(countDecimalPlaces(from), countDecimalPlaces(to)),
        countTo: to,
      } as unknown as ElementProperties,
    },
    animations,
  };
}

/** Shift every animation's delay by a sequence's computed stagger offset. */
/**
 * Shift a sequence's stagger offset onto the leading `entranceCount` entrance
 * animations only. Any trailing exit animations already carry an absolute
 * `exitAt` project time (object presets: 1 entrance then 1 exit; text presets:
 * one entrance per split part, then one exit per part) and must not be
 * shifted again.
 */
function offsetDelays(animations: Animation[], offset: number, entranceCount = 1): Animation[] {
  if (!offset || animations.length === 0) return animations;
  return animations.map((animation, index) =>
    index < entranceCount ? { ...animation, delay: animation.delay + offset } : animation
  );
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Generate camera animations from preset
 */
export function cameraPresetAnimations(value: string): Animation[] {
  const { name, options } = parsePresetCall(value);
  validateMoveCall(value);
  const delay = (options['delay'] as number) ?? 0;
  const duration = (options['duration'] as number) ?? 5;
  const easing = (options['ease'] as string) ?? 'smooth';

  if (name === 'slowPush' || name === 'push' || name === 'productReveal' || name === 'appleHero') {
    return [
      {
        target: 'camera',
        from: {
          zoom: (options['from'] as number) ?? 1,
          x: (options['xFrom'] as number) ?? 0,
          y: (options['yFrom'] as number) ?? 0,
          rotation: 0,
        },
        to: {
          zoom: (options['to'] as number) ?? 1.05,
          x: (options['xTo'] as number) ?? 0,
          y: (options['yTo'] as number) ?? -10,
          rotation: 0,
        },
        keyframes: [],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'pan') {
    return [
      {
        target: 'camera',
        from: { x: (options['from'] as number) ?? -80, y: 0 },
        to: { x: (options['to'] as number) ?? 80, y: 0 },
        keyframes: [],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'pull') {
    return [
      {
        target: 'camera',
        from: { zoom: (options['from'] as number) ?? 1.06 },
        to: { zoom: (options['to'] as number) ?? 1 },
        keyframes: [],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'speedZoom') {
    return [
      {
        target: 'camera',
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              zoom: (options['from'] as number) ?? 1,
              x: (options['xFrom'] as number) ?? 0,
              y: (options['yFrom'] as number) ?? 0,
            },
          },
          {
            offset: 0.55,
            properties: {
              zoom: (options['peak'] as number) ?? 1.12,
              x: (options['xPeak'] as number) ?? 0,
              y: (options['yPeak'] as number) ?? 0,
            },
          },
          {
            offset: 1,
            properties: {
              zoom: (options['to'] as number) ?? 1.02,
              x: (options['xTo'] as number) ?? 0,
              y: (options['yTo'] as number) ?? 0,
            },
          },
        ],
        delay,
        duration,
        easing: (options['ease'] as string) ?? 'power3.out',
      },
    ];
  }

  return [];
}

function sceneTransitionAnimations(
  element: Element,
  value: string,
  phase: 'in' | 'out'
): Animation[] {
  const { name, options } = parsePresetCall(value);
  const defaults = moveRegistry().find((entry) => entry.name === name)?.defaults ?? {};
  const props = element.properties as unknown as Record<string, unknown>;
  const transitionDuration = (options['duration'] as number) ?? Number(defaults['duration'] ?? 0.5);
  const start = (props['start'] as number) ?? 0;
  const sceneDuration = (props['duration'] as number) ?? transitionDuration;
  const localDelay =
    (options['delay'] as number | undefined) ??
    (phase === 'out' ? Math.max(0, sceneDuration - transitionDuration) : 0);
  const delay = start + localDelay;
  const x = (props['x'] as number) ?? 0;
  const y = (props['y'] as number) ?? 0;
  const scale = (props['scale'] as number) ?? 1;
  const opacity = (props['opacity'] as number) || 1;

  if (name === 'sceneSlide') {
    const direction = String(options['direction'] ?? defaults['direction'] ?? 'right');
    const [dx, dy] = directionVector(direction);
    const distance = (options['distance'] as number) ?? (dx === 0 ? 1200 : 2100);
    return [
      basicAnimation(
        element.id,
        delay,
        transitionDuration,
        String(options['ease'] ?? defaults['ease'] ?? 'power3.inOut'),
        phase === 'in'
          ? { x: x + dx * distance, y: y + dy * distance, scale, opacity }
          : { x, y, scale, opacity },
        phase === 'in'
          ? { x, y, scale, opacity }
          : { x: x - dx * distance, y: y - dy * distance, scale, opacity }
      ),
    ];
  }

  if (name === 'sceneZoom') {
    const incoming = phase === 'in';
    const fromScale =
      (options['from'] as number) ?? Number(defaults['from'] ?? TRANSITION_TOKENS.scale.modal);
    const toScale = (options['to'] as number) ?? Number(defaults['to'] ?? 1.06);
    const blur =
      (options['blur'] as number) ?? Number(defaults['blur'] ?? TRANSITION_TOKENS.blur.medium);
    return [
      basicAnimation(
        element.id,
        delay,
        transitionDuration,
        String(options['ease'] ?? defaults['ease'] ?? TRANSITION_TOKENS.easing.smoothOut),
        incoming
          ? {
              x: (options['xFrom'] as number) ?? x,
              y: (options['yFrom'] as number) ?? y,
              scale: scale * fromScale,
              opacity,
              blur,
            }
          : { x, y, scale, opacity, blur: 0 },
        incoming
          ? { x, y, scale, opacity, blur: 0 }
          : {
              x: (options['xTo'] as number) ?? x,
              y: (options['yTo'] as number) ?? y,
              scale: scale * toScale,
              opacity,
              blur,
            }
      ),
    ];
  }

  if (name === 'sceneWhip') {
    const direction = String(options['direction'] ?? defaults['direction'] ?? 'right');
    const [dx, dy] = directionVector(direction);
    const distance = (options['distance'] as number) ?? Number(defaults['distance'] ?? 480);
    const blur =
      (options['blur'] as number) ?? Number(defaults['blur'] ?? TRANSITION_TOKENS.blur.medium);
    return [
      basicAnimation(
        element.id,
        delay,
        transitionDuration,
        String(options['ease'] ?? defaults['ease'] ?? 'power3.inOut'),
        phase === 'in'
          ? { x: x + dx * distance, y: y + dy * distance, scale: scale * 1.02, blur }
          : { x, y, scale, blur: 0 },
        phase === 'in'
          ? { x, y, scale, blur: 0 }
          : { x: x - dx * distance, y: y - dy * distance, scale: scale * 1.02, blur }
      ),
    ];
  }

  if (name === 'sceneFocus') {
    const blur =
      (options['blur'] as number) ?? Number(defaults['blur'] ?? TRANSITION_TOKENS.blur.medium);
    const depthScale =
      (options[phase === 'in' ? 'from' : 'to'] as number) ??
      Number(defaults[phase === 'in' ? 'from' : 'to'] ?? 1.02);
    return [
      basicAnimation(
        element.id,
        delay,
        transitionDuration,
        String(options['ease'] ?? defaults['ease'] ?? 'power3.inOut'),
        phase === 'in' ? { x, y, scale: scale * depthScale, blur } : { x, y, scale, blur: 0 },
        phase === 'in' ? { x, y, scale, blur: 0 } : { x, y, scale: scale * depthScale, blur }
      ),
    ];
  }

  if (name === 'scenePivot') {
    const direction = String(options['direction'] ?? defaults['direction'] ?? 'right');
    const [dx] = directionVector(direction);
    const side = dx || 1;
    const distance = (options['distance'] as number) ?? Number(defaults['distance'] ?? 96);
    const blur =
      (options['blur'] as number) ?? Number(defaults['blur'] ?? TRANSITION_TOKENS.blur.small);
    const depth = {
      x: x + side * distance,
      y,
      scale: scale * 1.02,
      rotationY: -side * 3,
      blur,
    };
    return [
      basicAnimation(
        element.id,
        delay,
        transitionDuration,
        String(options['ease'] ?? defaults['ease'] ?? 'power3.inOut'),
        phase === 'in' ? depth : { x, y, scale, rotationY: 0, blur: 0 },
        phase === 'in' ? { x, y, scale, rotationY: 0, blur: 0 } : depth
      ),
    ];
  }

  return [];
}

function directionVector(direction: string): [number, number] {
  if (direction === 'left') return [-1, 0];
  if (direction === 'up') return [0, -1];
  if (direction === 'down') return [0, 1];
  return [1, 0];
}

/**
 * Check if value is a text preset name
 */
function isTextPreset(value: string): boolean {
  return TEXT_PRESETS.has(parsePresetCall(value).name);
}

function validateMoveCall(value: unknown): void {
  const call = parsePresetCall(value);
  const definition = moveRegistry().find((entry) => entry.name === call.name);
  if (!definition) throw new Error(`Unknown move "${call.name}".`);
  validateCatalogProperties(definition, call.options);
}

/**
 * Check if value is an object preset name
 */
function isObjectPreset(value: string): boolean {
  return OBJECT_PRESETS.has(parsePresetCall(value).name);
}

/**
 * Hide element by setting opacity to 0
 */
function hideElement(element: Element): Element {
  return {
    ...element,
    properties: { ...element.properties, opacity: 0 },
  };
}

/**
 * Expand text preset into character/word elements with animations
 */
/**
 * Offsets for one cascade: gaps shrink by `ARRIVAL.gapDecay` per step and the
 * whole window is capped at `ARRIVAL.maxStaggerWindow`, so the group accelerates
 * and still lands inside a single beat.
 */
function cascadeOffsets(count: number, stagger: number): number[] {
  if (count <= 1) return [0];
  const gaps = Array.from({ length: count - 1 }, (_, step) => stagger * ARRIVAL.gapDecay ** step);
  const window = gaps.reduce((total, gap) => total + gap, 0);
  const scale = window > ARRIVAL.maxStaggerWindow ? ARRIVAL.maxStaggerWindow / window : 1;
  const offsets = [0];
  for (const gap of gaps)
    offsets.push(Number((offsets[offsets.length - 1]! + gap * scale).toFixed(4)));
  return offsets;
}

function expandTextPreset(
  element: Element,
  value: string
): { elements: Element[]; animations: Animation[] } {
  const parsed = parsePresetCall(value);
  const requestedName = parsed.name;
  const name = canonicalMoveName(parsed.name);
  const { options } = parsed;
  const split = (options['split'] as string) ?? defaultSplitFor(name);
  const props = element.properties as unknown as Record<string, unknown>;
  const parts = splitText(String(props['value'] ?? ''), split);
  const stagger = (options['stagger'] as number) ?? (split === 'chars' ? 0.035 : 0.09);
  const delay = (options['delay'] as number) ?? 0;
  const defaults = moveRegistry().find((entry) => entry.name === requestedName)?.defaults ?? {};
  const duration = (options['duration'] as number) ?? Number(defaults['duration'] ?? 1.2);
  const easing = normalizeEase(
    (options['ease'] as string) ?? (defaults['ease'] as string) ?? 'power3.out'
  );
  const metrics = layoutParts(parts, props, split);
  const rangeStart = Math.max(0, Math.floor(Number(options['rangeStart'] ?? 0)));
  const rangeEnd = Math.min(parts.length, Math.ceil(Number(options['rangeEnd'] ?? parts.length)));
  const selected = metrics
    .map((_, index) => index)
    .filter((index) => index >= rangeStart && index < rangeEnd);
  const order = String(options['order'] ?? 'forward');
  const ordered =
    order === 'reverse'
      ? [...selected].reverse()
      : order === 'center'
        ? [...selected].sort(
            (a, b) =>
              Math.abs(a - (rangeStart + rangeEnd - 1) / 2) -
              Math.abs(b - (rangeStart + rangeEnd - 1) / 2)
          )
        : selected;
  const staggerRank = new Map(ordered.map((index, rank) => [index, rank]));

  const elements: Element[] = metrics.map((part, index) => ({
    ...element,
    id: `${element.id}__${split}_${index}`,
    properties: {
      ...element.properties,
      value: part.value,
      x: (props['x'] as number) + part.x,
      textGroup: element.id,
      textGroupX: (props['x'] as number) ?? 0,
      textGroupAlign: String(props['textAlign'] ?? 'center'),
      textGroupWidth: props['width'],
      textSplit: split,
      y: props['y'] as number,
      center: true,
      opacity: staggerRank.has(index)
        ? textPresetStartsVisible(requestedName)
          ? (props['opacity'] as number) || 1
          : 0
        : (props['opacity'] as number),
      blur: presetBlurFrom(name),
      scale: name === 'scaleText' ? 0.94 : (props['scale'] as number),
      tracking: split === 'none' ? ((props['tracking'] as number) ?? 0) : 0,
      // The fragment group owns positioning; the source element's layout box
      // must not shift each fragment again inside drawText.
      width: undefined,
      height: undefined,
      textAlign: 'center',
      wrap: 'none',
    } as unknown as ElementProperties,
  }));

  // Doctrine: a split reveal is a wave, not a queue. Gaps shrink across the
  // cascade and the whole group lands inside one beat, however many fragments
  // it holds — otherwise a long headline turns into a slow roll call.
  const cascade = cascadeOffsets(ordered.length, stagger);

  const animations: Animation[] = elements.flatMap((part, index) => {
    const rank = staggerRank.get(index);
    if (rank === undefined) return [];
    const partProps = part.properties as unknown as Record<string, unknown>;
    const effectFrames = textEffectKeyframes(
      requestedName,
      partProps,
      index,
      elements.length,
      options
    );
    return [
      {
        target: part.id,
        from: effectFrames ? {} : textPresetFrom(name, partProps),
        to: effectFrames ? {} : textPresetTo(name, partProps),
        keyframes: effectFrames ?? [],
        delay: delay + (cascade[rank] ?? 0),
        duration,
        easing,
      },
    ];
  });

  if (options['exitAt'] != null && !TEXT_EXIT_PRESETS.has(requestedName)) {
    animations.push(
      ...elements.map((part, index) => {
        const partProps = part.properties as unknown as Record<string, unknown>;
        return {
          target: part.id,
          from: textPresetTo(name, partProps),
          to: textPresetExitTo(requestedName, partProps, options),
          keyframes: [],
          delay: (options['exitAt'] as number) + index * Math.min(stagger, 0.018),
          duration: (options['exitDuration'] as number) ?? 0.9,
          easing: normalizeEase(String(options['exitEase'] ?? 'power3.inOut')),
        };
      })
    );
  }

  return { elements, animations };
}

const TEXT_EXIT_PRESETS = new Set([
  'fadeOut',
  'bounceOut',
  'zoomOut',
  'spinOut',
  'blackSmoke',
  'pullOut',
]);

const TEXT_LOOP_PRESETS = new Set([
  'flicker',
  'wave',
  'jitter',
  'pulse',
  'jigglyWobble',
  'rainbow',
  'fontShift',
  'pendulum',
  'pendulumSwing',
  'swing',
]);

function textPresetStartsVisible(name: string): boolean {
  return TEXT_EXIT_PRESETS.has(name) || TEXT_LOOP_PRESETS.has(name);
}

function textEffectKeyframes(
  name: string,
  props: Record<string, unknown>,
  index: number,
  count: number,
  options: Record<string, unknown>
): Keyframe[] | null {
  const x = Number(props['x'] ?? 0);
  const y = Number(props['y'] ?? 0);
  const scale = Number(props['scale'] ?? 1);
  const rotation = Number(props['rotation'] ?? 0);
  const opacity = Number(props['opacity'] || 1);
  const tracking = Number(props['tracking'] ?? 0);
  const color = String(props['color'] ?? '#ffffff');
  const font = String(props['font'] ?? 'Inter, sans-serif');
  const side = index % 2 === 0 ? -1 : 1;
  const amplitude = Number(options['amplitude'] ?? 24);
  const distance = Number(options['distance'] ?? 72);
  const rest = {
    opacity,
    x,
    y,
    scale,
    rotation,
    rotationX: 0,
    rotationY: 0,
    skewX: 0,
    skewY: 0,
    blur: 0,
    tracking,
    color,
    font,
  };

  if (name === 'fadeIn')
    return [
      { offset: 0, properties: { ...rest, opacity: 0 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'fadeOut')
    return [
      { offset: 0, properties: rest },
      { offset: 1, properties: { ...rest, opacity: 0 } },
    ];
  if (name === 'bounceIn')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, y: y - distance, scale: scale * 0.78 },
      },
      { offset: 0.72, properties: { ...rest, y: y + 6, scale: scale * 1.025 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'bounceOut')
    return [
      { offset: 0, properties: rest },
      { offset: 0.26, properties: { ...rest, y: y - 8, scale: scale * 1.02 } },
      {
        offset: 1,
        properties: { ...rest, opacity: 0, y: y + distance, scale: scale * 0.82 },
      },
    ];
  if (['slideLeft', 'slideRight', 'slideUp', 'slideDown'].includes(name)) {
    const dx = name === 'slideLeft' ? distance : name === 'slideRight' ? -distance : 0;
    const dy = name === 'slideUp' ? distance : name === 'slideDown' ? -distance : 0;
    return [
      { offset: 0, properties: { ...rest, opacity: 1, x: x + dx, y: y + dy } },
      { offset: 1, properties: rest },
    ];
  }
  if (name === 'zoomIn' || name === 'smoothScale')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, scale: scale * 0.72, blur: name === 'zoomIn' ? 7 : 0 },
      },
      { offset: 0.82, properties: { ...rest, scale: scale * 1.015 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'zoomOut')
    return [
      { offset: 0, properties: rest },
      {
        offset: 1,
        properties: { ...rest, opacity: 0, scale: scale * 0.62, blur: 8 },
      },
    ];
  if (name === 'spinIn')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, rotation: rotation - 150, scale: scale * 0.7 },
      },
      { offset: 0.78, properties: { ...rest, rotation: rotation + 4, scale: scale * 1.03 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'spinOut')
    return [
      { offset: 0, properties: rest },
      {
        offset: 1,
        properties: { ...rest, opacity: 0, rotation: rotation + 145, scale: scale * 0.68 },
      },
    ];
  if (name === 'flicker')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        { offset: 0.18, properties: { ...rest, opacity: 0.18 } },
        { offset: 0.3, properties: rest },
        { offset: 0.56, properties: { ...rest, opacity: 0.42 } },
        { offset: 0.68, properties: rest },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'wave')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        { offset: 0.25, properties: { ...rest, y: y - amplitude } },
        { offset: 0.5, properties: rest },
        { offset: 0.75, properties: { ...rest, y: y + amplitude } },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'jitter')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        { offset: 0.2, properties: { ...rest, x: x + side * amplitude * 0.35, y: y - 3 } },
        { offset: 0.4, properties: { ...rest, x: x - side * amplitude * 0.28, y: y + 4 } },
        { offset: 0.62, properties: { ...rest, x: x + side * 3, y: y - 2 } },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 3)
    );
  if (name === 'fallDown' || name === 'falling-text')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, y: y - distance * 1.25, rotation: side * 8 },
      },
      { offset: 0.78, properties: { ...rest, y: y + 5, rotation: -side } },
      { offset: 1, properties: rest },
    ];
  if (name === 'riseUp' || name === 'driftUp')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          y: y + (name === 'driftUp' ? distance * 0.55 : distance),
          blur: name === 'driftUp' ? 3 : 0,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'expand')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, tracking: tracking - 18, scale: 0.94 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'concentrate')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, tracking: tracking + 34, blur: 3 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'pulse')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        { offset: 0.5, properties: { ...rest, scale: scale * 1.045 } },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'jigglyWobble')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        {
          offset: 0.25,
          properties: { ...rest, rotation: rotation + side * 4, y: y - amplitude * 0.3 },
        },
        {
          offset: 0.5,
          properties: { ...rest, rotation: rotation - side * 3, y: y + amplitude * 0.2 },
        },
        { offset: 0.75, properties: { ...rest, rotation: rotation + side * 1.5 } },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'rainbow')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: { ...rest, color: index % 2 ? '#6ee7ff' : '#ff5c8a' } },
        { offset: 0.33, properties: { ...rest, color: '#ffd166' } },
        { offset: 0.66, properties: { ...rest, color: '#72f1b8' } },
        { offset: 1, properties: { ...rest, color: index % 2 ? '#6ee7ff' : '#ff5c8a' } },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'fontShift')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: rest },
        { offset: 0.33, properties: { ...rest, font: 'Georgia, serif' } },
        { offset: 0.66, properties: { ...rest, font: 'ui-monospace, monospace' } },
        { offset: 1, properties: rest },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'roll' || name === 'rollIn')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, y: y + distance, rotation: rotation - 88 },
      },
      { offset: 0.8, properties: { ...rest, y: y - 3, rotation: rotation + 2 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'pendulum' || name === 'pendulumSwing' || name === 'swing')
    return repeatTextKeyframes(
      [
        { offset: 0, properties: { ...rest, rotation: rotation - amplitude * 0.35 } },
        { offset: 0.5, properties: { ...rest, rotation: rotation + amplitude * 0.35 } },
        { offset: 1, properties: { ...rest, rotation: rotation - amplitude * 0.35 } },
      ],
      Number(options['repeat'] ?? 2)
    );
  if (name === 'glitchTransition')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          x: x + side * distance * 0.5,
          y: y - side * 8,
          skewX: side * 18,
          blur: 7,
        },
      },
      {
        offset: 0.34,
        properties: { ...rest, x: x - side * 18, y: y + side * 5, skewX: -side * 8 },
      },
      { offset: 0.72, properties: { ...rest, x: x + side * 5, skewX: side * 2 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'blurPass')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          x: x - distance * 0.2,
          blur: TRANSITION_TOKENS.blur.medium,
        },
      },
      { offset: 0.68, properties: { ...rest, x: x + 2, blur: 0 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'whiteFlash')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          color: '#ffffff',
          blur: TRANSITION_TOKENS.blur.large,
          scale: 1.02,
        },
      },
      {
        offset: 0.35,
        properties: { ...rest, color: '#ffffff', blur: TRANSITION_TOKENS.blur.small, scale: 1.005 },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'blackSmoke')
    return [
      { offset: 0, properties: rest },
      {
        offset: 1,
        properties: {
          ...rest,
          opacity: 0,
          color: '#050505',
          y: y - distance * 0.55,
          x: x + side * distance * 0.25,
          blur: TRANSITION_TOKENS.blur.medium,
          scale: 1.02,
        },
      },
    ];
  if (name === 'pullIn')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, scale: 1.04, blur: TRANSITION_TOKENS.blur.medium },
      },
      { offset: 0.84, properties: { ...rest, scale: 0.995, blur: 0 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'pullOut')
    return [
      { offset: 0, properties: rest },
      {
        offset: 1,
        properties: { ...rest, opacity: 0, scale: 1.04, blur: TRANSITION_TOKENS.blur.medium },
      },
    ];
  if (name === 'slideTransition') {
    const direction = String(options['direction'] ?? 'left');
    const [dx, dy] = directionVector(direction);
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, x: x - dx * distance, y: y - dy * distance },
      },
      { offset: 1, properties: rest },
    ];
  }
  if (name === 'splitMaskWipe') {
    const center = (count - 1) / 2;
    const outward = index < center ? -1 : 1;
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          x: x - outward * distance * 0.65,
          scale: TRANSITION_TOKENS.scale.modal,
          blur: TRANSITION_TOKENS.blur.medium,
        },
      },
      { offset: 1, properties: rest },
    ];
  }
  if (name === 'revolvingChecker')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          rotationY: side * 72,
          scale: TRANSITION_TOKENS.scale.modal,
          blur: TRANSITION_TOKENS.blur.small,
        },
      },
      { offset: 0.82, properties: { ...rest, rotationY: -side * 3, scale: 1.02 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'fanOut')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          x: x * 0.2,
          y: y + Math.abs(index - (count - 1) / 2) * 12,
          rotation: side * 7,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'clockWipe')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          rotation: rotation - 95 + (index / Math.max(1, count - 1)) * 70,
          scale: 0.72,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'zoomLens')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, scale: 1.04, blur: TRANSITION_TOKENS.blur.medium },
      },
      { offset: 0.76, properties: { ...rest, scale: 0.995, blur: 0 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'pageCurl')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          rotationY: side * 45,
          skewY: side * 6,
          x: x + side * distance * 0.35,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'mosaicPixelate')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          scale: TRANSITION_TOKENS.scale.modal,
          blur: TRANSITION_TOKENS.blur.medium,
          x: x + side * TRANSITION_TOKENS.distance.medium,
          y: y + ((index % 3) - 1) * TRANSITION_TOKENS.distance.medium,
        },
      },
      { offset: 0.75, properties: { ...rest, scale: 1.005, blur: 0 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'neonGlowWipe')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, x: x - distance * 0.35, glow: 28, color: '#7cf7ff' },
      },
      { offset: 0.7, properties: { ...rest, x: x + 4, glow: 10, color: '#ffffff' } },
      { offset: 1, properties: { ...rest, glow: Number(props['glow'] ?? 0) } },
    ];
  if (name === 'verticalBlinds')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          rotationY: side * 90,
          scale: TRANSITION_TOKENS.scale.tooltip,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'horizontalBlinds')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          rotationX: side * 86,
          scale: TRANSITION_TOKENS.scale.tooltip,
        },
      },
      { offset: 1, properties: rest },
    ];
  if (name === 'doubleCrossShift')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          x: x + side * distance,
          y: y - side * distance * 0.5,
          skewX: side * 6,
        },
      },
      { offset: 0.72, properties: { ...rest, x: x - side * 5, y: y + side * 3 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'waveWarp')
    return [
      {
        offset: 0,
        properties: {
          ...rest,
          opacity: 1,
          y: y + Math.sin(index * 1.4) * distance * 0.6,
          skewX: Math.cos(index * 1.2) * 6,
          rotation: Math.sin(index) * 5,
        },
      },
      { offset: 0.72, properties: { ...rest, y: y - Math.sin(index) * 4, skewX: 1 } },
      { offset: 1, properties: rest },
    ];

  if (name === 'split-text')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, y: y + side * 42, rotation: side * 4 } },
      { offset: 0.78, properties: { ...rest, y: y - side * 3, rotation: -side * 0.6 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'decrypted-text')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, blur: 14, scale: scale * 1.16 } },
      { offset: 0.72, properties: { ...rest, blur: 1, scale: scale * 0.99 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'scrambled-text' || name === 'glitch-text')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, x: x + side * 18, y: y - side * 5, blur: 5 },
      },
      {
        offset: 0.38,
        properties: { ...rest, x: x - side * 11, y: y + side * 3, rotation: side * 3 },
      },
      { offset: 0.72, properties: { ...rest, x: x + side * 4, rotation: -side } },
      { offset: 1, properties: rest },
    ];
  if (name === 'rotating-text')
    return [
      {
        offset: 0,
        properties: { ...rest, opacity: 1, y: y + 36, scale: scale * 0.82, rotation: side * 14 },
      },
      { offset: 0.82, properties: { ...rest, y: y - 3, scale: scale * 1.02, rotation: -side } },
      { offset: 1, properties: rest },
    ];
  if (name === 'falling-text')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, y: y - 86, rotation: side * 9 } },
      { offset: 0.76, properties: { ...rest, y: y + 5, rotation: -side * 1.5 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'scroll-float')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, y: y + 58, scale: scale * 0.95 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'text-trail')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, x: x - 52, blur: 10 } },
      { offset: 0.68, properties: { ...rest, x: x + 4, blur: 1 } },
      { offset: 1, properties: rest },
    ];
  if (name === 'text-pressure' || name === 'variable-proximity')
    return [
      { offset: 0, properties: { ...rest, opacity: 1, scale: scale * 0.72, y: y + 10 } },
      { offset: 0.8, properties: { ...rest, scale: scale * 1.03, y: y - 2 } },
      { offset: 1, properties: rest },
    ];
  return null;
}

function repeatTextKeyframes(frames: Keyframe[], repeat: number): Keyframe[] {
  const cycles = Math.max(1, Math.min(8, Math.round(repeat)));
  if (cycles === 1) return frames;
  const output: Keyframe[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const frame of frames) {
      const offset = (cycle + frame.offset) / cycles;
      const previous = output.at(-1);
      if (previous && Math.abs(previous.offset - offset) < 0.000001) {
        output[output.length - 1] = { ...frame, offset };
      } else {
        output.push({ ...frame, offset });
      }
    }
  }
  return output;
}

function textPresetExitTo(
  name: string,
  props: Record<string, unknown>,
  options: Record<string, unknown>
): PropertyMap {
  const x = Number(props['x'] ?? 0);
  const y = Number(props['y'] ?? 0);
  const scale = Number(props['scale'] ?? 1);
  const distance = Number(options['exitDistance'] ?? options['distance'] ?? 720);
  // Generic exits leave by transform. Explicit fadeOut, blackSmoke, and
  // pullOut remain the opt-in opacity exits.
  if (name === 'slideLeft') return { opacity: 1, x: x - distance, y, scale, blur: 0 };
  if (name === 'slideRight') return { opacity: 1, x: x + distance, y, scale, blur: 0 };
  if (name === 'slideDown') return { opacity: 1, x, y: y + distance, scale, blur: 0 };
  if (name === 'slideTransition') {
    const [dx, dy] = directionVector(
      String(options['exitDirection'] ?? options['direction'] ?? 'left')
    );
    return { opacity: 1, x: x + dx * distance, y: y + dy * distance, scale, blur: 0 };
  }
  if (name === 'zoomIn' || name === 'smoothScale')
    return { opacity: 1, x, y: y - distance, scale: scale * 1.04, blur: 2 };
  if (name === 'glitchTransition')
    return { opacity: 1, x: x + 24, y: y - distance, scale, skewX: 18, blur: 8 };
  return { opacity: 1, x, y: y - distance, scale, blur: name === 'blurReveal' ? 6 : 0 };
}

/**
 * Generate object preset animations
 */
function objectPresetAnimations(element: Element): Animation[] {
  const target = element.id;
  const props = element.properties as unknown as Record<string, unknown>;
  const parsed = parsePresetCall(props['animation'] as string);
  const name = canonicalMoveName(parsed.name);
  const { options } = parsed;
  const defaults = moveRegistry().find((entry) => entry.name === name)?.defaults ?? {};
  const delay = (options['delay'] as number) ?? 0;
  const duration = (options['duration'] as number) ?? Number(defaults['duration'] ?? 1.2);
  const easing = normalizeEase(
    (options['ease'] as string) ??
      (defaults['ease'] as string) ??
      (name === 'springIn' || name === 'bounceIn' ? 'spring' : 'ease-out')
  );

  if (name === 'highlight-circle-reveal' || name === 'animated-arrow-point') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: 1, pathProgress: 0 },
        { opacity: (props['opacity'] as number) || 1, pathProgress: 1 }
      ),
    ];
  }

  if (name === 'callout-text-pop') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: 0, x, y: y + ((options['yFrom'] as number) ?? 18), scale: scale * 0.84 },
        { opacity: (props['opacity'] as number) || 1, x, y, scale }
      ),
    ];
  }

  if (name === 'spotlight-mask') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: 1, revealProgress: 0 },
        { opacity: (props['opacity'] as number) || 1, revealProgress: 1 }
      ),
    ];
  }

  if (name === 'heroLogo') {
    const opacity = (props['opacity'] as number) || 1;
    const scale = (options['to'] as number) ?? (props['scale'] as number);
    const y = (options['yTo'] as number) ?? (props['y'] as number);
    const rotation = props['rotation'] as number;
    const animations = [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power4.out',
        {
          opacity: 0,
          scale: (options['from'] as number) ?? 0.9,
          y: (options['yFrom'] as number) ?? y + 28,
          rotation: (options['rotationFrom'] as number) ?? rotation,
        },
        { opacity, scale, y, rotation }
      ),
    ];

    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? 0.5,
          (options['exitEase'] as string) ?? 'power2.in',
          { opacity, scale, y, rotation },
          {
            opacity: 0,
            scale: (options['exitScale'] as number) ?? scale * 0.96,
            y: (options['yExit'] as number) ?? y - 24,
            rotation,
          }
        )
      );
    }

    return animations;
  }

  if (name === 'productPanel') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power4.out',
        {
          opacity: 0,
          scale: (options['from'] as number) ?? 0.965,
          x: (options['xFrom'] as number) ?? (props['x'] as number),
          y: (options['yFrom'] as number) ?? (props['y'] as number) + 34,
        },
        {
          opacity: (props['opacity'] as number) || 1,
          scale: (options['to'] as number) ?? (props['scale'] as number),
          x: props['x'] as number,
          y: props['y'] as number,
        }
      ),
    ];
  }

  if (name === 'focusZoom') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const role = String(options['role'] ?? 'focus');
    const sibling = role === 'sibling';
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? TRANSITION_TOKENS.easing.smoothOut,
        { opacity, x, y, scale },
        sibling
          ? {
              opacity: (options['siblingOpacity'] as number) ?? 0.55,
              x: x + ((options['pushX'] as number) ?? TRANSITION_TOKENS.distance.large),
              y: y + ((options['pushY'] as number) ?? 0),
              scale: scale * ((options['siblingScale'] as number) ?? TRANSITION_TOKENS.scale.modal),
            }
          : {
              opacity,
              x: (options['xTo'] as number) ?? x,
              y: (options['yTo'] as number) ?? y,
              scale:
                (options['to'] as number) ?? scale * ((options['focusScale'] as number) ?? 1.12),
            }
      ),
    ];
  }

  if (name === 'zoomThrough') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    return [
      basicAnimation(
        target,
        delay,
        duration,
        easing,
        { opacity, x, y, scale, blur: 0 },
        {
          opacity: 0,
          x: (options['xTo'] as number) ?? x,
          y: (options['yTo'] as number) ?? y,
          scale: (options['to'] as number) ?? scale * ((options['focusScale'] as number) ?? 1.25),
          blur: (options['blur'] as number) ?? TRANSITION_TOKENS.blur.medium,
        }
      ),
    ];
  }

  if (name === 'whipPan') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const distance = (options['distance'] as number) ?? 96;
    const direction = String(options['direction'] ?? 'left');
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const fromX = horizontal ? x - sign * distance : x;
    const fromY = horizontal ? y : y - sign * distance;
    const settleX = horizontal ? x + sign * distance * 0.045 : x;
    const settleY = horizontal ? y : y + sign * distance * 0.045;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              x: fromX,
              y: fromY,
              scale: scale * 0.985,
              blur: (options['blur'] as number) ?? TRANSITION_TOKENS.blur.medium,
            },
          },
          {
            offset: 0.78,
            properties: { opacity, x: settleX, y: settleY, scale, blur: 0 },
            easing: easing,
          },
          { offset: 1, properties: { opacity, x, y, scale, blur: 0 }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'rackFocus') {
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: (options['opacity'] as number) ?? 0.35,
              scale: scale * ((options['from'] as number) ?? 0.96),
              blur: (options['blur'] as number) ?? TRANSITION_TOKENS.blur.medium,
            },
          },
          {
            offset: 0.76,
            properties: { opacity, scale: scale * 1.012, blur: 0 },
            easing,
          },
          { offset: 1, properties: { opacity, scale, blur: 0 }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'depthSwap') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const background = String(options['role'] ?? 'foreground') === 'background';
    const depthScale = (options['from'] as number) ?? TRANSITION_TOKENS.scale.modal;
    const depthOpacity = (options['siblingOpacity'] as number) ?? 0.55;
    return [
      basicAnimation(
        target,
        delay,
        duration,
        easing,
        background
          ? { opacity, x, y, scale }
          : {
              opacity: depthOpacity,
              x,
              y: y + TRANSITION_TOKENS.distance.medium,
              scale: scale * depthScale,
            },
        background
          ? {
              opacity: depthOpacity,
              x,
              y: y - TRANSITION_TOKENS.distance.medium,
              scale: scale * depthScale,
            }
          : { opacity, x, y, scale }
      ),
    ];
  }

  if (name === 'cascadeIn') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const distance = (options['distance'] as number) ?? 70;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              x,
              y: y + distance,
              scale: scale * 0.9,
              rotation: rotation + ((options['rotationFrom'] as number) ?? -3),
            },
          },
          {
            offset: 0.76,
            properties: {
              opacity,
              x,
              y: y - 6,
              scale: scale * 1.012,
              rotation: rotation + 0.35,
            },
            easing,
          },
          {
            offset: 1,
            properties: { opacity, x, y, scale, rotation },
            easing: 'power2.out',
          },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'snapMove') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const distance = (options['distance'] as number) ?? TRANSITION_TOKENS.distance.large;
    const fromX = (options['xFrom'] as number) ?? x - distance;
    const fromY = (options['yFrom'] as number) ?? y;
    const toX = (options['xTo'] as number) ?? x;
    const toY = (options['yTo'] as number) ?? y;
    const dx = toX - fromX;
    const dy = toY - fromY;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { opacity, x: fromX, y: fromY } },
          {
            offset: 0.78,
            properties: { opacity, x: toX + dx * 0.06, y: toY + dy * 0.06 },
            easing,
          },
          { offset: 1, properties: { opacity, x: toX, y: toY }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'popover') {
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              y: y + ((options['yFrom'] as number) ?? TRANSITION_TOKENS.distance.medium),
              scale: scale * ((options['from'] as number) ?? TRANSITION_TOKENS.scale.modal),
            },
          },
          {
            offset: 0.72,
            properties: { opacity, y: y - 1, scale: scale * 1.005 },
            easing,
          },
          { offset: 1, properties: { opacity, y, scale }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'cursorTap') {
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const amplitude = (options['amplitude'] as number) ?? 0.2;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { y, scale } },
          {
            offset: 0.38,
            properties: { y: y + 5, scale: scale * (1 - amplitude) },
            easing: 'power2.in',
          },
          {
            offset: 0.7,
            properties: { y, scale: scale * (1 + amplitude * 0.22) },
            easing: 'power2.out',
          },
          { offset: 1, properties: { y, scale }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'shakeReject') {
    const x = (props['x'] as number) ?? 0;
    const rotation = (props['rotation'] as number) ?? 0;
    const amplitude = (options['amplitude'] as number) ?? 12;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { x, rotation } },
          { offset: 0.18, properties: { x: x - amplitude, rotation: rotation - 1.2 } },
          { offset: 0.4, properties: { x: x + amplitude * 0.72, rotation: rotation + 0.8 } },
          { offset: 0.62, properties: { x: x - amplitude * 0.42, rotation: rotation - 0.45 } },
          { offset: 0.82, properties: { x: x + amplitude * 0.16, rotation: rotation + 0.18 } },
          { offset: 1, properties: { x, rotation }, easing: 'power2.out' },
        ],
        delay,
        duration,
        easing,
      },
    ];
  }

  if (name === 'orbitDrift') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const amplitude = (options['amplitude'] as number) ?? 70;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { x: x - amplitude, y } },
          { offset: 0.25, properties: { x, y: y - amplitude * 0.45 } },
          { offset: 0.5, properties: { x: x + amplitude, y } },
          { offset: 0.75, properties: { x, y: y + amplitude * 0.45 } },
          { offset: 1, properties: { x: x - amplitude, y } },
        ],
        delay,
        duration,
        easing: 'sine.inOut',
        repeat:
          (options['repeat'] as number | undefined) ??
          (String(options['loop'] ?? 'true') === 'false' ? undefined : 'infinite'),
        repeatType: 'loop',
      },
    ];
  }

  if (name === 'softReveal') {
    const opacity = (options['opacity'] as number) ?? ((props['opacity'] as number) || 1);
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const animations = [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        {
          opacity: 0,
          x: x + ((options['xFrom'] as number) ?? 0),
          y: y + ((options['yFrom'] as number) ?? 24),
          scale: (options['from'] as number) ?? scale * 0.98,
          blur: (options['blur'] as number) ?? 0,
        },
        { opacity, x, y, scale, blur: 0 }
      ),
    ];

    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? 0.55,
          (options['exitEase'] as string) ?? 'power2.in',
          { opacity, x, y, scale, blur: 0 },
          {
            opacity: 0,
            x: x + ((options['xExit'] as number) ?? 0),
            y: y + ((options['yExit'] as number) ?? 0),
            scale: (options['exitScale'] as number) ?? scale,
            blur: (options['exitBlur'] as number) ?? 0,
          }
        )
      );
    }

    return animations;
  }

  if (name === 'sceneExit') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'ease-out',
        {
          opacity: (props['opacity'] as number) || 1,
          scale: props['scale'] as number,
          x: props['x'] as number,
          y: props['y'] as number,
        },
        {
          opacity: 0,
          scale: (options['to'] as number) ?? 0.98,
          x: (options['xTo'] as number) ?? (props['x'] as number),
          y: (options['yTo'] as number) ?? (props['y'] as number) - 28,
        }
      ),
    ];
  }

  if (name === 'float') {
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { y: (options['y'] as number) ?? 0 } },
          { offset: 0.5, properties: { y: (options['yTo'] as number) ?? -14 } },
          { offset: 1, properties: { y: (options['y'] as number) ?? 0 } },
        ],
        delay,
        duration,
        easing: 'smooth',
      },
    ];
  }

  if (name === 'pulse') {
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { scale: 1 } },
          { offset: 0.5, properties: { scale: (options['to'] as number) ?? 1.035 } },
          { offset: 1, properties: { scale: 1 } },
        ],
        delay,
        duration,
        easing: 'smooth',
      },
    ];
  }

  if (name === 'rotateReveal') {
    const rotationXTarget = (props['rotationX'] as number) || 0;
    const rotationYTarget = (props['rotationY'] as number) || 0;
    return [
      basicAnimation(
        target,
        delay,
        duration,
        easing,
        {
          opacity: 0,
          scale: 0.94,
          rotation: (props['rotation'] as number) - ((options['rotationFrom'] as number) ?? 4),
          rotationX: (options['rotationXFrom'] as number) ?? rotationXTarget,
          rotationY: (options['rotationYFrom'] as number) ?? rotationYTarget,
        },
        {
          opacity: 1,
          scale: props['scale'] as number,
          rotation: props['rotation'] as number,
          rotationX: rotationXTarget,
          rotationY: rotationYTarget,
        }
      ),
    ];
  }

  if (name === 'springIn') {
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const rise = (options['distance'] as number) ?? 60;
    return withExit(
      [
        {
          target,
          from: {},
          to: {},
          keyframes: [
            { offset: 0, properties: { opacity: 0, y: y + rise, scale: scale * 0.7 } },
            {
              offset: 0.62,
              properties: { opacity, y: y - rise * 0.08, scale: scale * 1.06 },
              easing: 'power2.out',
            },
            { offset: 1, properties: { opacity, y, scale }, easing: 'elastic.out(1,0.55)' },
          ],
          delay,
          duration,
          easing: 'power2.out',
        },
      ],
      target,
      { opacity, y, scale },
      options
    );
  }

  if (name === 'bounceIn') {
    const y = (props['y'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const drop = (options['distance'] as number) ?? 140;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'bounceOut',
          { opacity: 0, y: y - drop },
          { opacity, y }
        ),
      ],
      target,
      { opacity, y },
      options
    );
  }

  if (name === 'scaleReveal') {
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'power4.out',
          { opacity: 0, scale: (options['from'] as number) ?? scale * 0.9 },
          { opacity, scale }
        ),
      ],
      target,
      { opacity, scale },
      options
    );
  }

  if (name === 'spinIn') {
    const scale = (props['scale'] as number) ?? 1;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const rotationFrom = (options['rotationFrom'] as number) ?? rotation - 260;
    const rotationXTarget = (props['rotationX'] as number) || 0;
    const rotationYTarget = (props['rotationY'] as number) || 0;
    const rotationXFrom = (options['rotationXFrom'] as number) ?? rotationXTarget;
    const rotationYFrom = (options['rotationYFrom'] as number) ?? rotationYTarget;
    return withExit(
      [
        {
          target,
          from: {},
          to: {},
          keyframes: [
            {
              offset: 0,
              properties: {
                opacity: 0,
                scale: scale * 0.3,
                rotation: rotationFrom,
                rotationX: rotationXFrom,
                rotationY: rotationYFrom,
              },
            },
            {
              offset: 0.55,
              properties: { opacity, scale: scale * 1.06, rotation: rotation + 8 },
            },
            {
              offset: 1,
              properties: {
                opacity,
                scale,
                rotation,
                rotationX: rotationXTarget,
                rotationY: rotationYTarget,
              },
            },
          ],
          delay,
          duration,
          easing: (options['ease'] as string) ?? 'power3.out',
        },
      ],
      target,
      { opacity, scale, rotation },
      options
    );
  }

  if (name === 'rotateOut') {
    const scale = (props['scale'] as number) ?? 1;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const rotationTo =
      (options['rotationTo'] as number) ?? rotation + ((options['turns'] as number) ?? 0.5) * 360;
    return [
      basicAnimation(
        target,
        (options['exitAt'] as number) ?? delay,
        (options['exitDuration'] as number) ?? duration,
        (options['ease'] as string) ?? 'power2.in',
        { opacity, scale, rotation },
        { opacity: 0, scale: scale * ((options['to'] as number) ?? 0.7), rotation: rotationTo }
      ),
    ];
  }

  if (name === 'swing') {
    const rotation = (props['rotation'] as number) ?? 0;
    const amplitude = (options['amplitude'] as number) ?? 14;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          { offset: 0, properties: { rotation } },
          { offset: 0.25, properties: { rotation: rotation + amplitude }, easing: 'power2.out' },
          {
            offset: 0.6,
            properties: { rotation: rotation - amplitude * 0.6 },
            easing: 'power2.out',
          },
          {
            offset: 0.85,
            properties: { rotation: rotation + amplitude * 0.25 },
            easing: 'power2.out',
          },
          { offset: 1, properties: { rotation }, easing: 'power2.out' },
        ],
        delay,
        duration: (options['duration'] as number) ?? 1.4,
        easing: 'power2.out',
        repeat:
          (options['repeat'] as number | undefined) ?? (options['loop'] ? 'infinite' : undefined),
        repeatType: 'loop',
      },
    ];
  }

  if (name === 'pendulum') {
    const rotation = (props['rotation'] as number) ?? 0;
    const amplitude = (options['amplitude'] as number) ?? 22;
    return [
      basicAnimation(
        target,
        delay,
        (options['duration'] as number) ?? 1.2,
        'sine.inOut',
        { rotation: rotation - amplitude },
        { rotation: rotation + amplitude }
      ),
    ].map((animation) => ({
      ...animation,
      repeat: (options['repeat'] as number | undefined) ?? 'infinite',
      repeatType: 'yoyo',
    }));
  }

  if (name === 'rollIn') {
    const x = (props['x'] as number) ?? 0;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const distance = (options['distance'] as number) ?? 120;
    const fromLeft = options['from'] !== 'right';
    const turns = (options['turns'] as number) ?? 1;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          easing,
          {
            opacity: 0,
            x: fromLeft ? x - distance : x + distance,
            rotation: fromLeft ? rotation - turns * 360 : rotation + turns * 360,
          },
          { opacity, x, rotation }
        ),
      ],
      target,
      { opacity, x, rotation },
      options
    );
  }

  if (name === 'rotateScale') {
    const scale = (props['scale'] as number) ?? 1;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const rotationFrom = (options['rotationFrom'] as number) ?? rotation - 45;
    const scaleFrom = (options['from'] as number) ?? scale * 0.6;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'spring',
          { opacity: 0, scale: scaleFrom, rotation: rotationFrom },
          { opacity, scale, rotation }
        ),
      ],
      target,
      { opacity, scale, rotation },
      options
    );
  }

  if (name === 'logoSpinReveal') {
    const scale = (props['scale'] as number) ?? 1;
    const rotation = (props['rotation'] as number) ?? 0;
    const opacity = (props['opacity'] as number) || 1;
    const rotationFrom = (options['rotationFrom'] as number) ?? rotation - 180;
    return [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              scale: scale * 0.4,
              rotation: rotationFrom,
              pathProgress: 0,
            },
          },
          {
            offset: 0.7,
            properties: { opacity, scale: scale * 1.04, pathProgress: 1 },
            easing: 'power3.out',
          },
          { offset: 1, properties: { opacity, scale, rotation }, easing: 'power3.out' },
        ],
        delay,
        duration: (options['duration'] as number) ?? 1.6,
        easing: (options['ease'] as string) ?? 'power3.out',
      },
    ];
  }

  if (name === 'spin') {
    const rotation = (props['rotation'] as number) ?? 0;
    const direction = options['direction'] === 'ccw' ? -1 : 1;
    return [
      {
        target,
        from: { rotation },
        to: { rotation: rotation + direction * 360 },
        keyframes: [],
        delay,
        duration: (options['duration'] as number) ?? 1.2,
        easing: 'linear',
        repeat: 'infinite',
        repeatType: 'loop',
      },
    ];
  }

  if (name === 'kenBurns') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'linear',
        { x, y, scale },
        {
          x: (options['xTo'] as number) ?? x + ((options['panX'] as number) ?? 40),
          y: (options['yTo'] as number) ?? y + ((options['panY'] as number) ?? -24),
          scale: (options['to'] as number) ?? scale * 1.08,
        }
      ),
    ];
  }

  if (name === 'tiltReveal') {
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const rotation = (props['rotation'] as number) ?? 0;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'power3.out',
          {
            opacity: 0,
            y: y + ((options['yFrom'] as number) ?? 26),
            scale: scale * 0.92,
            rotation: rotation - ((options['rotationFrom'] as number) ?? 6),
            skewX: (options['skewXFrom'] as number) ?? -8,
            skewY: (options['skewYFrom'] as number) ?? 2,
          },
          { opacity, y, scale, rotation, skewX: 0, skewY: 0 }
        ),
      ],
      target,
      { opacity, y, scale, rotation, skewX: 0, skewY: 0 },
      options
    );
  }

  if (name === 'mediaTour') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const width = Math.max(1, Number(props['width'] ?? 1200));
    const aspect = Number(options['aspect'] ?? 16 / 9);
    const height = Math.max(1, Number(props['height'] ?? width / aspect));
    const focus = (xPoint: number, yPoint: number, focusScale: number): PropertyMap => {
      const resolvedScale = Math.max(1, Math.min(1.65, focusScale));
      const xTravel = (Math.max(0, Math.min(1, xPoint)) - 0.5) * width * resolvedScale;
      const yTravel = (Math.max(0, Math.min(1, yPoint)) - 0.5) * height * resolvedScale;
      return {
        x: x - Math.max(-width * 0.36, Math.min(width * 0.36, xTravel)),
        y: y - Math.max(-height * 0.32, Math.min(height * 0.32, yTravel)),
        scale: resolvedScale * scale,
        rotationX: 0,
        rotationY: 0,
        blur: 0,
        opacity: (props['opacity'] as number) || 1,
      };
    };
    const first = focus(
      Number(options['focusX'] ?? 0.5),
      Number(options['focusY'] ?? 0.5),
      Number(options['focusScale'] ?? 1.24)
    );
    const animations: Animation[] = [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              x: x + width * 0.055,
              y: y + 54,
              scale: scale * 0.93,
              rotationX: 4,
              rotationY: -6,
              blur: 5,
            },
          },
          { offset: 0.02, properties: { opacity: 1 } },
          {
            offset: 1,
            properties: { ...{ x, y, scale, rotationX: 0, rotationY: 0, blur: 0 }, opacity: 1 },
          },
        ],
        delay,
        duration,
        easing: (options['ease'] as string) ?? 'power4.out',
      },
      basicAnimation(
        target,
        delay + duration + 0.48,
        1.05,
        'power3.inOut',
        { x, y, scale, rotationX: 0, rotationY: 0, opacity: 1 },
        first
      ),
    ];
    if (options['focus2X'] !== undefined && options['focus2Y'] !== undefined) {
      const second = focus(
        Number(options['focus2X']),
        Number(options['focus2Y']),
        Number(options['focus2Scale'] ?? options['focusScale'] ?? 1.28)
      );
      animations.push(
        basicAnimation(target, delay + duration + 1.88, 1.15, 'power3.inOut', first, second)
      );
      if (options['focus3X'] !== undefined && options['focus3Y'] !== undefined) {
        animations.push(
          basicAnimation(
            target,
            delay + duration + 3.28,
            1.05,
            'power3.inOut',
            second,
            focus(
              Number(options['focus3X']),
              Number(options['focus3Y']),
              Number(options['focus3Scale'] ?? options['focus2Scale'] ?? 1.3)
            )
          )
        );
      }
    }
    return animations;
  }

  if (name === 'cardReveal') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const shadow = (props['shadow'] as number) ?? 24;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'power3.out',
          {
            opacity: 0,
            x,
            y: y + ((options['yFrom'] as number) ?? 28),
            scale: scale * ((options['from'] as number) ?? 0.96),
            shadow: 0,
          },
          { opacity, x, y, scale, shadow }
        ),
      ],
      target,
      { opacity, x, y, scale, shadow },
      options
    );
  }

  if (name === 'buttonPop') {
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const y = (props['y'] as number) ?? 0;
    return withExit(
      [
        basicAnimation(
          target,
          delay,
          duration,
          (options['ease'] as string) ?? 'power4.out',
          {
            opacity: 0,
            scale: scale * ((options['from'] as number) ?? 0.88),
            y: y + ((options['yFrom'] as number) ?? 10),
          },
          { opacity, scale, y }
        ),
      ],
      target,
      { opacity, scale, y },
      options
    );
  }

  if (name === 'progressFill') {
    const width = (props['width'] as number) ?? 200;
    const opacity = (props['opacity'] as number) || 1;
    const animations = [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { width: (options['from'] as number) ?? 0, opacity: 0 },
        { width, opacity }
      ),
    ];

    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? 0.5,
          (options['exitEase'] as string) ?? 'power2.in',
          { width, opacity },
          { width, opacity: 0 }
        )
      );
    }

    return animations;
  }

  if (name === 'morph') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: (props['opacity'] as number) || 1, morphProgress: 0 },
        { opacity: (props['opacity'] as number) || 1, morphProgress: 1 }
      ),
    ];
  }

  if (name === 'drawSVG') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        easing,
        { opacity: 1, pathProgress: 0, scale: (props['scale'] as number) * 0.98 },
        {
          opacity: (props['opacity'] as number) || 1,
          pathProgress: 1,
          scale: props['scale'] as number,
        }
      ),
    ];
  }

  if (name === 'shapeWipe' || name === 'irisWipe') {
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: 1, revealProgress: 0 },
        { opacity: 1, revealProgress: 1 }
      ),
    ];
  }

  if (name === 'maskReveal') {
    const opacity = (props['opacity'] as number) || 1;
    const animations = [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'power3.out',
        { opacity: 1, revealProgress: 0 },
        { opacity, revealProgress: 1 }
      ),
    ];
    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? 0.6,
          (options['exitEase'] as string) ?? 'power2.in',
          { opacity, revealProgress: 1 },
          { opacity: 0, revealProgress: 0 }
        )
      );
    }
    return animations;
  }

  if (name === 'dynamicSlide') {
    const x = (props['x'] as number) ?? 0;
    const y = (props['y'] as number) ?? 0;
    const scale = (props['scale'] as number) ?? 1;
    const opacity = (props['opacity'] as number) || 1;
    const direction = String(options['direction'] ?? 'left');
    const distance = (options['distance'] as number) ?? TRANSITION_TOKENS.distance.large;
    const dx = direction === 'left' ? distance : direction === 'right' ? -distance : 0;
    const dy = direction === 'up' ? distance : direction === 'down' ? -distance : 0;
    const skewX = dx ? Math.sign(dx) * 2 : 0;
    const animations: Animation[] = [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: {
              opacity: 0,
              x: x + dx,
              y: y + dy,
              scale: scale * TRANSITION_TOKENS.scale.modal,
              skewX,
            },
          },
          {
            offset: 0.82,
            properties: {
              opacity,
              x: x - dx * 0.04,
              y: y - dy * 0.04,
              scale: scale * 1.005,
              skewX: -skewX * 0.12,
            },
          },
          { offset: 1, properties: { opacity, x, y, scale, skewX: 0 } },
        ],
        delay,
        duration,
        easing: (options['ease'] as string) ?? TRANSITION_TOKENS.easing.smoothOut,
      },
    ];
    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? TRANSITION_TOKENS.duration.medium,
          (options['exitEase'] as string) ?? 'power2.in',
          { opacity, x, y, scale, skewX: 0 },
          {
            opacity: 0,
            x: x - dx * 0.4,
            y: y - dy * 0.4,
            scale: scale * TRANSITION_TOKENS.scale.close,
            skewX: -skewX * 0.5,
          }
        )
      );
    }
    return animations;
  }

  return [
    basicAnimation(
      target,
      delay,
      duration,
      easing,
      {
        opacity: 0,
        scale: (options['from'] as number) ?? 0.8,
        y: (options['yFrom'] as number) ?? (props['y'] as number) + 36,
      },
      {
        opacity: 1,
        scale: (options['to'] as number) ?? (props['scale'] as number),
        y: (options['yTo'] as number) ?? (props['y'] as number),
      }
    ),
  ];
}

/**
 * Generate background effect element and animation
 */
function backgroundEffect(element: Element): { elements: Element[]; animations: Animation[] } {
  const props = element.properties as unknown as Record<string, unknown>;
  const { name, options } = parsePresetCall(props['backgroundEffect'] as string);
  const definition = effectRegistry().find((entry) => entry.name === name);
  if (!definition) throw new Error(`Unknown background effect "${name}".`);
  validateCatalogProperties(definition, options);
  const duration = Math.max(
    0.001,
    (options['duration'] as number) ?? Number(definition.defaults['duration'])
  );
  const opacity = (options['opacity'] as number) ?? Number(definition.defaults['opacity']);

  const effect: Element = {
    ...element,
    id: `${element.id}__${name}`,
    kind: 'effect',
    assetName: null,
    asset: null,
    properties: {
      ...element.properties,
      ...options,
      layer: 'background',
      effect: name,
      opacity,
      offset: 0,
      intensity: (options['intensity'] as number) ?? Number(definition.defaults['intensity']),
    } as unknown as ElementProperties,
  };

  return {
    elements: [effect],
    animations: [
      {
        target: effect.id,
        from: { offset: 0 },
        to: { offset: 1 },
        keyframes: [],
        delay: (options['delay'] as number) ?? 0,
        duration,
        easing: 'linear',
      },
    ],
  };
}

/**
 * Append a fade-out animation (rest state -> opacity 0) when `exitAt` is set,
 * so entrance presets that don't hand-author their own exit still respect it.
 */
function withExit(
  animations: Animation[],
  target: string,
  restState: PropertyMap,
  options: Record<string, unknown>
): Animation[] {
  if (options['exitAt'] == null) return animations;
  animations.push(
    basicAnimation(
      target,
      options['exitAt'] as number,
      (options['exitDuration'] as number) ?? 0.5,
      (options['exitEase'] as string) ?? 'power2.in',
      restState,
      { ...restState, opacity: 0 }
    )
  );
  return animations;
}

/**
 * Create basic animation
 */
function basicAnimation(
  target: string,
  delay: number,
  duration: number,
  easing: string,
  from: PropertyMap,
  to: PropertyMap
): Animation {
  return { target, from, to, keyframes: [], delay, duration, easing };
}

/** Keep object arrivals hidden until their cue; transform carries the entrance. */
function snapPresetArrivalOpacity(animations: Animation[]): Animation[] {
  const output: Animation[] = [];
  for (const animation of animations) {
    const frames = animation.keyframes ?? [];
    const first = frames[0]?.properties ?? animation.from;
    const last = frames.at(-1)?.properties ?? animation.to;
    const fromOpacity = Number(first['opacity']);
    const toOpacity = Number(last['opacity']);
    if (
      animation.repeat === undefined &&
      Number.isFinite(fromOpacity) &&
      fromOpacity < 1 &&
      Number.isFinite(toOpacity) &&
      toOpacity >= 1
    ) {
      const movement = {
        ...animation,
        from: { ...animation.from },
        to: { ...animation.to },
        keyframes: frames.map((keyframe) => ({
          ...keyframe,
          properties: { ...keyframe.properties },
        })),
      };
      delete movement.from['opacity'];
      delete movement.to['opacity'];
      for (const keyframe of movement.keyframes) delete keyframe.properties['opacity'];
      output.push(movement, {
        target: animation.target,
        from: { opacity: fromOpacity },
        to: { opacity: toOpacity },
        keyframes: [],
        delay: animation.delay,
        duration: 0.001,
        easing: 'linear',
      });
      continue;
    }
    output.push(animation);
  }
  return output;
}

/**
 * Keys that get a directional nudge/overshoot; everything else (opacity, blur,
 * revealProgress, ...) just holds its start/rest value at the extra keyframes.
 */
const MOTION_QUALITY_KEYS = new Set(['x', 'y', 'rotation', 'scale']);
const ANTICIPATION_DIP_FACTOR = 0.18;
const OVERSHOOT_KEYFRAME_OFFSET = 0.82;

/**
 * Add opt-in `anticipation` (pre-move counter-nudge) and `overshoot` (settle past
 * target) to a plain two-state entrance animation. No-op for animations that
 * already use explicit keyframes (those presets choreograph their own curve) or
 * when neither option is set.
 */
function applyEntranceQuality(animation: Animation, options: Record<string, unknown>): Animation {
  if (animation.keyframes.length > 0) return animation;

  const anticipation = Math.max(0, finiteNumber(options['anticipation'], 0));
  const overshoot = finiteNumber(options['overshoot'], 0);
  if (anticipation <= 0 && overshoot <= 1) return animation;

  const keys = [...new Set([...Object.keys(animation.from), ...Object.keys(animation.to)])];
  const startState = animation.from;
  const restState = animation.to;

  const dip: PropertyMap = {};
  const peak: PropertyMap = {};
  for (const key of keys) {
    const start = Number(startState[key] ?? restState[key] ?? 0);
    const rest = Number(restState[key] ?? start);
    if (MOTION_QUALITY_KEYS.has(key)) {
      dip[key] = start - (rest - start) * ANTICIPATION_DIP_FACTOR;
      peak[key] =
        overshoot > 1
          ? key === 'scale'
            ? rest * overshoot
            : rest + (rest - start) * (overshoot - 1)
          : rest;
    } else {
      dip[key] = start;
      peak[key] = rest;
    }
  }

  const totalDuration = animation.duration + anticipation;
  const anticipationOffset = anticipation > 0 ? anticipation / totalDuration : 0;
  const overshootOffset = anticipationOffset + (1 - anticipationOffset) * OVERSHOOT_KEYFRAME_OFFSET;

  const keyframes: Keyframe[] = [];
  if (anticipation > 0) {
    keyframes.push({ offset: 0, properties: dip });
    keyframes.push({ offset: anticipationOffset, properties: { ...startState } });
  } else {
    keyframes.push({ offset: 0, properties: { ...startState } });
  }
  if (overshoot > 1) {
    keyframes.push({ offset: overshootOffset, properties: peak });
  }
  keyframes.push({ offset: 1, properties: { ...restState } });

  return {
    ...animation,
    from: {},
    to: {},
    duration: totalDuration,
    keyframes,
  };
}

/**
 * Split text into parts (words or characters)
 */
function splitText(text: string, split: string): string[] {
  if (split === 'none') return [text];
  if (split === 'lines') return text.split('\n');
  if (split === 'words') {
    return text
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
  }
  return Array.from(text);
}

/**
 * Layout text parts with positions
 */
function layoutParts(
  parts: string[],
  props: Record<string, unknown>,
  split: string
): Array<{ value: string; x: number }> {
  if (split === 'none') return parts.map((value) => ({ value, x: 0 }));
  if (split === 'words') {
    const approx = parts.map((part) => part.length * (props['size'] as number) * 0.52);
    const space = (props['size'] as number) * 0.34;
    const total = approx.reduce((sum, width) => sum + width, 0) + space * (parts.length - 1);
    let cursor = -total / 2;

    return parts.map((value, index) => {
      const width = approx[index]!;
      const x = cursor + width / 2;
      cursor += width + space;
      return { value, x };
    });
  }

  const widths = parts.map((part) => partWidth(part, props, split));
  const total = widths.reduce((sum, width) => sum + width, 0);
  let cursor = -total / 2;

  return parts.map((value, index) => {
    const width = widths[index]!;
    const x = cursor + width / 2;
    cursor += width;
    return { value, x };
  });
}

/**
 * Calculate width of text part
 */
function partWidth(part: string, props: Record<string, unknown>, split: string): number {
  if (split === 'words') {
    return part.length * (props['size'] as number) * 0.52 + (props['size'] as number) * 0.34;
  }
  return (props['size'] as number) * 0.54 + ((props['tracking'] as number) ?? 0);
}

/**
 * Get default split mode for preset
 */
function defaultSplitFor(name: string): string {
  if (name === 'keynoteText') return 'words';
  if (
    [
      'wordReveal',
      'blurReveal',
      'blurPass',
      'fanOut',
      'horizontalBlinds',
      'pageCurl',
      'neonGlowWipe',
      'slideTransition',
    ].includes(name)
  )
    return 'words';
  if (
    [
      'fadeIn',
      'fadeOut',
      'bounceIn',
      'bounceOut',
      'slideLeft',
      'slideRight',
      'slideUp',
      'slideDown',
      'zoomIn',
      'zoomOut',
      'spinIn',
      'spinOut',
      'driftUp',
      'expand',
      'concentrate',
      'pulse',
      'fontShift',
      'roll',
      'rollIn',
      'pendulum',
      'pendulumSwing',
      'swing',
      'whiteFlash',
      'blackSmoke',
      'pullIn',
      'pullOut',
      'zoomLens',
      'smoothScale',
    ].includes(name)
  )
    return 'none';
  return 'chars';
}

/**
 * Get default blur value for preset
 */
function presetBlurFrom(name: string): number {
  if (name === 'keynoteText') return 0;
  return name === 'blurReveal' || name === 'gradientReveal' ? 10 : 0;
}

/**
 * Get from properties for text preset
 */
function textPresetFrom(name: string, props: Record<string, unknown>): PropertyMap {
  if (name === 'keynoteText') {
    return {
      opacity: 0,
      y: (props['y'] as number) + 26,
      scale: 0.99,
    };
  }
  if (name === 'scaleText') {
    return {
      opacity: 0,
      scale: 0.92,
      y: (props['y'] as number) + 8,
    };
  }
  if (name === 'slideIn') {
    return {
      opacity: 1,
      x: (props['x'] as number) - 36,
    };
  }
  if (name === 'maskReveal') {
    return {
      opacity: 0,
      y: (props['y'] as number) + 24,
    };
  }
  return {
    opacity: 0,
    y: (props['y'] as number) + 38,
    blur: presetBlurFrom(name),
  };
}

/**
 * Get to properties for text preset
 */
function textPresetTo(name: string, props: Record<string, unknown>): PropertyMap {
  if (name === 'slideIn') {
    return {
      opacity: (props['opacity'] as number) || 1,
      x: props['x'] as number,
    };
  }
  return {
    opacity: (props['opacity'] as number) || 1,
    y: props['y'] as number,
    blur: 0,
    scale: (props['scale'] as number) || 1,
  };
}

/**
 * Normalize easing name
 */
function normalizeEase(value: string): string {
  if (value === 'power3.out') return 'ease-out';
  if (value === 'power2.out') return 'ease-out';
  return value;
}
