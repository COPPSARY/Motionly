/**
 * Animation preset library
 * Provides reusable animation presets for text, objects, cameras, and effects
 */

import { parsePresetCall } from './preset-parser';
import { countDecimalPlaces, resolveCountSeparator } from './count-up';
import type { Scene, Element, Animation, PropertyMap, ElementProperties } from '../types/scene';

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
  'rotateReveal',
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
        sourceElements.push(generated.element);
        generatedAnimations.push(generated.animation);
        continue;
      }

      const generated = expandTextPreset(element, textPreset as string);
      sourceElements.push(hideElement(element));
      generatedElements.push(...generated.elements);
      generatedAnimations.push(...generated.animations);
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
      const preset = parsePresetCall(animation).name;
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
      generatedAnimations.push(...objectPresetAnimations(element));
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
): { element: Element; animation: Animation } {
  const { options } = parsePresetCall(value);
  const props = element.properties as unknown as Record<string, unknown>;
  const from = finiteNumber(options['from'], 0);
  const to = finiteNumber(options['to'], finiteNumber(props['value'], 0));
  const direction = String(options['direction'] ?? 'up').toLowerCase();
  const start = direction === 'down' ? to : from;
  const end = direction === 'down' ? from : to;

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
    animation: {
      target: element.id,
      from: { value: start },
      to: { value: end },
      keyframes: [],
      delay: finiteNumber(options['delay'], 0),
      duration: Math.max(0.001, finiteNumber(options['duration'], 2)),
      easing: String(options['ease'] ?? options['easing'] ?? 'power3.out'),
    },
  };
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
  const duration = (options['duration'] as number) ?? (name === 'float' ? 4 : 1.2);
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
    return [
      basicAnimation(
        target,
        delay,
        duration,
        (options['ease'] as string) ?? 'soft-spring',
        {
          opacity: 0,
          scale: (options['from'] as number) ?? 0.82,
          y: (options['yFrom'] as number) ?? (props['y'] as number) + 34,
          rotation: (options['rotationFrom'] as number) ?? -1.5,
        },
        {
          opacity: 1,
          scale: (options['to'] as number) ?? (props['scale'] as number),
          y: (options['yTo'] as number) ?? (props['y'] as number),
          rotation: props['rotation'] as number,
        }
      ),
    ];
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
    return [
      basicAnimation(
        target,
        delay,
        duration,
        easing,
        {
          opacity: 0,
          scale: 0.94,
          rotation: (props['rotation'] as number) - 4,
        },
        {
          opacity: 1,
          scale: props['scale'] as number,
          rotation: props['rotation'] as number,
        }
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
