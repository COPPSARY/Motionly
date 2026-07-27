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
export type ElementKind =
  'asset' | 'image' | 'text' | 'overlay' | 'effect' | 'scene' | 'group' | 'path' | 'svgpart';

/**
 * SVG-compatible primitives available to image overlay sublayers.
 */
export type OverlayShape =
  'circle' | 'ellipse' | 'rect' | 'line' | 'arrow' | 'path' | 'text' | 'spotlight';

/**
 * Effect types for background and atmosphere
 */
export type EffectType =
  | 'gradientMotion'
  | 'meshGradient'
  | 'radialGlow'
  | 'noise'
  | 'grain'
  | 'grid'
  | 'gridFade'
  | 'aurora'
  | 'vignette'
  | 'edgeFade'
  | 'bloom'
  | 'glass'
  | 'card'
  | 'deviceFrame'
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
  width?: number;
  height?: number;
  dominantColor?: string;
  layers?: Array<{ id: string; label: string; parentId: string; kind: 'group' | 'path' }>;
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
  rotationX: number;
  rotationY: number;
  perspective: number;
  rotationDirection: 'auto' | 'cw' | 'ccw';
  originX: number;
  originY: number;
  originXPixel?: number;
  originYPixel?: number;
  opacity: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
  sepia: number;
  invert: number;
  mask?: string;
  maskInvert?: boolean;
  maskVisible?: boolean;
  followThrough?: string;
  followThroughLag?: number;
  followThroughDamping?: number;
  shadow: number;
  glow?: number;
  glowColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  morphTo?: string;
  morphProgress?: number;
  layer: Layer;
  center: boolean;
  cover: boolean;
  focalX?: number;
  focalY?: number;
  blendMode?: string;
  pathProgress?: number;
  trimStart?: number;
  motionPath?: string;
  motionPathProgress?: number;
  motionPathRotate?: boolean;
  revealProgress?: number;
  revealStyle?: string;
  revealDirection?: string;
  skewX?: number;
  skewY?: number;
  mediaTime?: number;
  mediaTrimOut?: number;
  mediaVolume?: number;
  mediaMuted?: boolean;
  parent?: string;
  start?: number;
  duration?: number;
  depth?: number;
  clip?: boolean;
  locked?: boolean;
  label?: string;
  sourceId?: string;
  sourcePath?: string;
  cameraX?: number;
  cameraY?: number;
  cameraZoom?: number;
  cameraRotation?: number;
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
  countSeparator?: string;
  countDecimals?: number;
  countTo?: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  wrap: 'none' | 'word' | 'char';
}

/**
 * A named imported bitmap used as the coordinate parent for vector overlays.
 */
export interface ImageProperties extends BaseElementProperties {
  source: string;
}

/**
 * Overlay-specific properties
 */
export interface OverlayProperties extends BaseElementProperties {
  parent: string;
  shape: OverlayShape;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  radiusX: number;
  radiusY: number;
  x2: number;
  y2: number;
  path: string;
  value: string;
  font: string;
  size: number;
  weight: number;
  clip: boolean;
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
  BaseElementProperties | ImageProperties | TextProperties | OverlayProperties | EffectProperties;

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
  hierarchy: 'linear' | 'wave' | 'center-out';
}

/**
 * Complete scene graph
 */
export type TrackRole = 'main' | 'overlay' | 'audio';
export type TrackContent = 'primary' | 'video' | 'image' | 'text' | 'effect' | 'audio' | 'mixed';

export interface Track {
  id: string;
  label: string;
  role: TrackRole;
  content: TrackContent;
  hidden: boolean;
  muted: boolean;
  order: number;
  declared: boolean;
}

/**
 * Timeline clip for media/audio
 */
export type ClipTransitionType = 'crossfade';

export interface Clip {
  id: string;
  assetName: string;
  asset: Asset | null;
  track: number | string;
  start: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  transitionIn?: ClipTransitionType;
  transitionInDuration: number;
  transitionOut?: ClipTransitionType;
  transitionOutDuration: number;
  volume?: number;
  mute?: boolean;
  sourceOrder: number;
}

export interface SemanticComponent {
  id: string;
  type: import('../semantic/vector-registry').SemanticComponentType;
  provider: import('../semantic/vector-registry').VectorProvider | 'custom';
  role: 'main' | 'supporting' | 'connection' | 'background';
  intent: string;
  behaviors: string[];
  rootElementId: string;
  childElementIds: string[];
  capabilities: string[];
  source: string;
}

export interface SemanticRelationship {
  id: string;
  from: string;
  to: string;
  type: string;
  connectorElementId: string;
  particleElementIds: string[];
}

/**
 * Complete scene graph
 */
export interface Scene {
  canvas: Canvas;
  camera: Camera;
  theme: import('../semantic/catalog').MotionTheme;
  sequences: Sequence[];
  imports: Asset[];
  elements: Element[];
  animations: Animation[];
  components: SemanticComponent[];
  relationships: SemanticRelationship[];
  tracks: Track[];
  clips: Clip[];
  transitions: SharedTransition[];
  /** Storyboard beats, present when the project uses the beat system. */
  beats?: import('../motion-system').BeatPlan[];
  audio?: string; // Path to audio file
  audioStart: number;
}

export interface SharedTransition {
  id: string;
  from: string;
  to: string;
  at: number;
  duration: number;
  easing: EasingName;
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
  easing?: string;
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
  repeat?: number | 'infinite';
  repeatType?: 'loop' | 'yoyo';
}
