/**
 * Core Scene Types
 *
 * These types define the scene graph structure that represents
 * a complete .motion animation after parsing and normalization.
 */

/**
 * Canvas configuration defining the output dimensions and timing
 */
export interface Canvas {
  width: number;
  height: number;
  fps: number;
  duration: number;
  background: string;
}

/**
 * Camera position and transformation
 */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

/**
 * Layer types for z-ordering elements
 */
export type Layer =
  'background' | 'hero' | 'supporting' | 'content' | 'details' | 'text' | 'effects';

/**
 * Asset types that can be imported
 */
export type AssetType = 'svg' | 'image' | 'video' | 'lottie';

/**
 * Element kinds that can be rendered
 */
export type ElementKind = 'asset' | 'text' | 'overlay' | 'effect';

/**
 * Effect types for background and atmosphere
 */
export type EffectType =
  | 'gradientMotion'
  | 'noise'
  | 'grid'
  | 'aurora'
  | 'prism'
  | 'rippleGrid'
  | 'ripple-grid'
  | 'particles';

/**
 * Imported asset reference
 */
export interface Asset {
  name: string;
  path: string;
  type: AssetType;
}

/**
 * Base properties common to all elements
 */
export interface BaseElementProperties {
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  scale: number;
  rotation: number;
  opacity: number;
  blur: number;
  brightness: number;
  shadow: number;
  layer: Layer;
  center: boolean;
  cover: boolean;
  pathProgress?: number;
  revealProgress?: number;
  revealStyle?: string;
  revealDirection?: string;
  skewX?: number;
  skewY?: number;
}

/**
 * Text-specific properties
 */
export interface TextProperties extends BaseElementProperties {
  value: string;
  font: string;
  size: number;
  weight: number;
  color: string;
  tracking: number;
}

/**
 * Overlay-specific properties
 */
export interface OverlayProperties extends BaseElementProperties {
  fill: string;
}

/**
 * Effect-specific properties
 */
export interface EffectProperties extends BaseElementProperties {
  effect: EffectType;
  offset: number;
  intensity: number;
  gridSize?: number;
  gridThickness?: number;
}

/**
 * Union of all possible element properties
 */
export type ElementProperties =
  BaseElementProperties | TextProperties | OverlayProperties | EffectProperties;

/**
 * Scene element before animation evaluation
 */
export interface Element {
  id: string;
  kind: ElementKind;
  assetName: string | null;
  asset: Asset | null;
  properties: ElementProperties;
}

/**
 * Scene element after animation evaluation (with render state)
 */
export interface EvaluatedElement extends Element {
  render: ElementProperties;
}

/**
 * Sequence for staggered animations
 */
export interface Sequence {
  name: string;
  delay: number;
  gap: number;
  items: string[];
}

/**
 * Complete scene graph
 */
/**
 * Timeline clip for media/audio
 */
export interface Clip {
  id: string;
  assetName: string;
  asset: Asset | null;
  track: number | string;
  start: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  volume?: number;
  mute?: boolean;
}

/**
 * Complete scene graph
 */
export interface Scene {
  canvas: Canvas;
  camera: Camera;
  sequences: Sequence[];
  imports: Asset[];
  elements: Element[];
  animations: Animation[];
  clips: Clip[];
  audio?: string; // Path to audio file
}

/**
 * Evaluated scene ready for rendering
 */
export interface EvaluatedScene {
  canvas: Canvas;
  camera: ElementProperties;
  elements: EvaluatedElement[];
}

/**
 * Property value that can be animated
 */
export type AnimatableValue = number | string;

/**
 * Map of property names to animatable values
 */
export type PropertyMap = Record<string, AnimatableValue>;

/**
 * Animation keyframe
 */
export interface Keyframe {
  offset: number;
  properties: PropertyMap;
}

/**
 * Easing function names
 */
export type EasingName = 'soft' | 'spring' | 'ease' | 'smooth' | 'expoOut' | 'easeOut' | string;

/**
 * Animation definition
 */
export interface Animation {
  target: string;
  from: PropertyMap;
  to: PropertyMap;
  keyframes: Keyframe[];
  delay: number;
  duration: number;
  easing: EasingName;
  sequence?: string;
}
