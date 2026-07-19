/**
 * Property normalization utilities for scene elements
 */

import { parseColor } from '../core/color';
import { parseScalar, parseSize, parseTime } from '../core/units';
import type {
  Canvas,
  Camera,
  ElementProperties,
  PropertyMap,
  ElementKind,
  BaseElementProperties,
  TextProperties,
  ImageProperties,
  OverlayProperties,
  EffectProperties,
} from '../types/scene';

const TIME_PROPERTIES = new Set([
  'duration',
  'delay',
  'start',
  'trimIn',
  'trimOut',
  'transitionInDuration',
  'transitionOutDuration',
]);
const NUMBER_PROPERTIES = new Set([
  'x',
  'y',
  'width',
  'height',
  'scale',
  'originX',
  'originY',
  'skewX',
  'skewY',
  'rotation',
  'opacity',
  'pathProgress',
  'revealProgress',
  'blur',
  'brightness',
  'contrast',
  'saturation',
  'hue',
  'grayscale',
  'sepia',
  'invert',
  'shadow',
  'size',
  'intensity',
  'offset',
  'overscan',
  'radius',
  'radiusX',
  'radiusY',
  'weight',
  'tracking',
  'strokeWidth',
  'x2',
  'y2',
  'zoom',
]);
const COLOR_PROPERTIES = new Set(['background', 'color', 'fill', 'stroke']);

/**
 * Normalize canvas configuration from AST properties
 */
export function normalizeCanvas(properties: Record<string, unknown>): Canvas {
  const size = properties['size']
    ? parseSize(String(properties['size']))
    : { width: 1920, height: 1080 };
  return {
    width: size.width,
    height: size.height,
    fps: Number(properties['fps'] ?? 60),
    duration: properties['duration'] ? parseTime(properties['duration'] as string | number) : 5,
    background: properties['background']
      ? parseColor(properties['background'] as string | number)
      : '#000',
  };
}

/**
 * Normalize camera properties from AST
 */
export function normalizeCamera(properties: Record<string, unknown> = {}): Camera {
  return {
    x: Number.parseFloat(String(properties['x'] ?? 0)),
    y: Number.parseFloat(String(properties['y'] ?? 0)),
    zoom: Number.parseFloat(String(properties['zoom'] ?? 1)),
    rotation: Number.parseFloat(String(properties['rotation'] ?? 0)),
  };
}

/**
 * Normalize all properties in an object
 */
export function normalizeProperties(properties: Record<string, unknown>): PropertyMap {
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    normalized[key] = normalizeProperty(key, value);
  }
  return normalized as unknown as PropertyMap;
}

/**
 * Normalize a single property value based on its key
 */
export function normalizeProperty(key: string, value: unknown): string | number | boolean {
  if (TIME_PROPERTIES.has(key)) return parseTime(value as string | number);
  if (NUMBER_PROPERTIES.has(key)) return Number.parseFloat(String(value));
  if (COLOR_PROPERTIES.has(key)) return parseColor(value as string | number);
  return parseScalar(value);
}

/**
 * Get default properties for an element kind
 */
export function defaultElementProperties(kind: ElementKind): ElementProperties {
  const common: BaseElementProperties = {
    x: 0,
    y: 0,
    width: null,
    height: null,
    scale: 1,
    rotation: 0,
    originX: 0.5,
    originY: 0.5,
    opacity: 1,
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    grayscale: 0,
    sepia: 0,
    invert: 0,
    shadow: 0,
    layer: 'content',
    center: false,
    cover: false,
  };

  if (kind === 'text') {
    return {
      ...common,
      value: '',
      font: 'Inter, SF Pro Display, Segoe UI, Arial, sans-serif',
      size: 64,
      weight: 600,
      color: '#fff',
      tracking: 0,
    } as TextProperties;
  }

  if (kind === 'image') {
    return {
      ...common,
      source: '',
    } as ImageProperties;
  }

  if (kind === 'overlay') {
    return {
      ...common,
      parent: '',
      shape: 'rect',
      fill: '#000',
      stroke: 'none',
      strokeWidth: 4,
      radius: 48,
      radiusX: 48,
      radiusY: 48,
      x2: 0,
      y2: 0,
      path: '',
      value: '',
      font: 'Inter, SF Pro Display, Segoe UI, Arial, sans-serif',
      size: 48,
      weight: 700,
      clip: false,
      opacity: 0,
      layer: 'effects',
    } as OverlayProperties;
  }

  if (kind === 'effect') {
    return {
      ...common,
      effect: 'gradientMotion',
      opacity: 0,
      offset: 0,
      intensity: 1,
      layer: 'background',
    } as EffectProperties;
  }

  return common;
}
