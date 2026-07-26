/**
 * Animation preset library
 * Provides reusable animation presets for text, objects, cameras, and effects
 */

import { parsePresetCall } from './preset-parser';
import { countDecimalPlaces, resolveCountSeparator } from './count-up';
import { elementSequenceOffset } from '../core/stagger';
import type {
  Scene,
  Element,
  Animation,
  Keyframe,
  PropertyMap,
  ElementProperties,
} from '../types/scene';

const TEXT_PRESETS = new Set([
  'splitReveal',
  'blurReveal',
  'fadeUp',
  'slideIn',
  'scaleText',
  'typewriter',
  'maskReveal',
  'charReveal',
  'wordReveal',
  'gradientReveal',
  'keynoteText',
  'countUp',
]);

const OBJECT_PRESETS = new Set([
  'heroLogo',
  'productPanel',
  'softReveal',
  'sceneExit',
  'springIn',
  'bounceIn',
  'float',
  'pulse',
  'drawSVG',
  'shapeWipe',
  'irisWipe',
  'maskReveal',
  'dynamicSlide',
  'scaleReveal',
  'morph',
  'spinIn',
  'rotateReveal',
  'rotateOut',
  'swing',
  'pendulum',
  'rollIn',
  'rotateScale',
  'logoSpinReveal',
  'spin',
  'kenBurns',
  'tiltReveal',
  'cardReveal',
  'buttonPop',
  'progressFill',
  'productReveal',
  'appleHero',
  'startupLaunch',
  'highlight-circle-reveal',
  'animated-arrow-point',
  'callout-text-pop',
  'spotlight-mask',
]);

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
    const textPreset =
      parsePresetCall(animationPreset).name === 'countUp'
        ? animationPreset
        : (textAnimationPreset ?? animationPreset);

    if (element.kind === 'text' && textPreset && isTextPreset(textPreset as string)) {
      if (parsePresetCall(textPreset).name === 'countUp') {
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
      const preset = parsedPreset.name;
      sourceElements.push({
        ...element,
        properties: {
          ...element.properties,
          ...(preset === 'drawSVG' ? { pathProgress: 0 } : {}),
          ...(['highlight-circle-reveal', 'animated-arrow-point'].includes(preset)
            ? { pathProgress: 0 }
            : {}),
          ...(preset === 'spotlight-mask' ? { revealProgress: 0 } : {}),
          ...(['shapeWipe', 'irisWipe', 'maskReveal'].includes(preset)
            ? { revealProgress: 0, revealStyle: preset === 'irisWipe' ? 'iris' : 'linear' }
            : {}),
          ...(['shapeWipe', 'maskReveal'].includes(preset)
            ? {
                revealDirection: String(parsePresetCall(animation).options['direction'] ?? 'right'),
              }
            : {}),
        },
      });
      const presetAnimations = objectPresetAnimations(element);
      if (presetAnimations[0]) {
        presetAnimations[0] = applyEntranceQuality(presetAnimations[0], parsedPreset.options);
      }
      const seqOffset = elementSequenceOffset(scene.sequences, props['sequence'], element.id);
      generatedAnimations.push(...offsetDelays(presetAnimations, seqOffset));
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

/**
 * Check if value is a text preset name
 */
function isTextPreset(value: string): boolean {
  return TEXT_PRESETS.has(parsePresetCall(value).name);
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
function expandTextPreset(
  element: Element,
  value: string
): { elements: Element[]; animations: Animation[] } {
  const { name, options } = parsePresetCall(value);
  const split = (options['split'] as string) ?? defaultSplitFor(name);
  const props = element.properties as unknown as Record<string, unknown>;
  const parts = splitText(String(props['value'] ?? ''), split);
  const stagger = (options['stagger'] as number) ?? (split === 'chars' ? 0.035 : 0.09);
  const delay = (options['delay'] as number) ?? 0;
  const duration = (options['duration'] as number) ?? 1.2;
  const easing = normalizeEase((options['ease'] as string) ?? 'power3.out');
  const metrics = layoutParts(parts, props, split);

  const elements: Element[] = metrics.map((part, index) => ({
    ...element,
    id: `${element.id}__${split}_${index}`,
    properties: {
      ...element.properties,
      value: part.value,
      x: (props['x'] as number) + part.x,
      textGroup: element.id,
      textGroupX: (props['x'] as number) ?? 0,
      textSplit: split,
      y: props['y'] as number,
      center: true,
      opacity: 0,
      blur: presetBlurFrom(name),
      scale: name === 'scaleText' ? 0.94 : (props['scale'] as number),
      tracking: 0,
    } as unknown as ElementProperties,
  }));

  const animations: Animation[] = elements.map((part, index) => {
    const partProps = part.properties as unknown as Record<string, unknown>;
    return {
      target: part.id,
      from: textPresetFrom(name, partProps),
      to: textPresetTo(name, partProps),
      keyframes: [],
      delay: delay + index * stagger,
      duration,
      easing,
    };
  });

  if (options['exitAt'] != null) {
    animations.push(
      ...elements.map((part, index) => {
        const partProps = part.properties as unknown as Record<string, unknown>;
        return {
          target: part.id,
          from: textPresetTo(name, partProps),
          to: {
            opacity: 0,
            y: (partProps['y'] as number) - 30,
            blur: name === 'blurReveal' ? 6 : 0,
          },
          keyframes: [],
          delay: (options['exitAt'] as number) + index * Math.min(stagger, 0.018),
          duration: (options['exitDuration'] as number) ?? 0.9,
          easing: 'ease-out',
        };
      })
    );
  }

  return { elements, animations };
}

/**
 * Generate object preset animations
 */
function objectPresetAnimations(element: Element): Animation[] {
  const target = element.id;
  const props = element.properties as unknown as Record<string, unknown>;
  const { name, options } = parsePresetCall(props['animation'] as string);
  const delay = (options['delay'] as number) ?? 0;
  const duration =
    (options['duration'] as number) ?? (name === 'float' ? 4 : name === 'buttonPop' ? 0.45 : 1.2);
  const easing = normalizeEase(
    (options['ease'] as string) ??
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
        (options['ease'] as string) ?? 'soft-spring',
        {
          opacity: 0,
          scale: (options['from'] as number) ?? 0.82,
          y: (options['yFrom'] as number) ?? y + 34,
          rotation: (options['rotationFrom'] as number) ?? rotation - 1.5,
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
        (options['ease'] as string) ?? 'ease-out',
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
          (options['ease'] as string) ?? 'spring',
          { opacity: 0, scale: (options['from'] as number) ?? scale * 0.2 },
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
          (options['ease'] as string) ?? 'spring',
          {
            opacity: 0,
            scale: scale * ((options['from'] as number) ?? 0.55),
            y: y + ((options['yFrom'] as number) ?? 6),
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
    const distance = (options['distance'] as number) ?? 180;
    const dx = direction === 'left' ? distance : direction === 'right' ? -distance : 0;
    const dy = direction === 'up' ? distance : direction === 'down' ? -distance : 0;
    const skewX = dx ? Math.sign(dx) * 4 : 0;
    const animations: Animation[] = [
      {
        target,
        from: {},
        to: {},
        keyframes: [
          {
            offset: 0,
            properties: { opacity: 0, x: x + dx, y: y + dy, scale: scale * 0.94, skewX },
          },
          {
            offset: 0.82,
            properties: {
              opacity,
              x: x - dx * 0.04,
              y: y - dy * 0.04,
              scale: scale * 1.01,
              skewX: -skewX * 0.12,
            },
          },
          { offset: 1, properties: { opacity, x, y, scale, skewX: 0 } },
        ],
        delay,
        duration,
        easing: (options['ease'] as string) ?? 'power3.out',
      },
    ];
    if (options['exitAt'] != null) {
      animations.push(
        basicAnimation(
          target,
          options['exitAt'] as number,
          (options['exitDuration'] as number) ?? 0.55,
          (options['exitEase'] as string) ?? 'power2.in',
          { opacity, x, y, scale, skewX: 0 },
          { opacity: 0, x: x - dx * 0.7, y: y - dy * 0.7, scale: scale * 0.97, skewX: -skewX * 0.5 }
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
  const duration = (options['duration'] as number) ?? 12;
  const opacity = (options['opacity'] as number) ?? (name === 'noise' ? 0.035 : 0.2);

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
      intensity: (options['intensity'] as number) ?? 1,
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
  if (name === 'wordReveal' || name === 'blurReveal') return 'words';
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
