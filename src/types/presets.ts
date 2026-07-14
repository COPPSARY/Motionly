/**
 * Animation Preset Types
 *
 * These types define the animation preset system for reusable animations.
 */

import type { Animation, PropertyMap } from './scene';

/**
 * Preset categories
 */
export type PresetCategory = 'text' | 'logo' | 'camera' | 'object' | 'background' | 'transition';

/**
 * Text animation split modes
 */
export type TextSplitMode = 'words' | 'characters' | 'lines';

/**
 * Preset options parsed from preset calls
 */
export interface PresetOptions {
  delay?: number;
  duration?: number;
  stagger?: number;
  split?: TextSplitMode;
  easing?: string;
  exitAt?: number;
  exitDuration?: number;
  [key: string]: number | string | undefined;
}

/**
 * Parsed preset call from .motion source
 */
export interface PresetCall {
  name: string;
  options: PresetOptions;
}

/**
 * Text animation preset definition
 */
export interface TextPreset {
  category: 'text';
  name: string;
  defaultSplit: TextSplitMode;
  from: (options: PresetOptions) => PropertyMap;
  to: (options: PresetOptions) => PropertyMap;
  duration: number;
  easing: string;
}

/**
 * Logo animation preset definition
 */
export interface LogoPreset {
  category: 'logo';
  name: string;
  from: PropertyMap;
  to: PropertyMap;
  duration: number;
  easing: string;
}

/**
 * Object animation preset definition
 */
export interface ObjectPreset {
  category: 'object';
  name: string;
  from: PropertyMap;
  to: PropertyMap;
  duration: number;
  easing: string;
}

/**
 * Camera movement preset definition
 */
export interface CameraPreset {
  category: 'camera';
  name: string;
  keyframes?: Array<{
    offset: number;
    x?: number;
    y?: number;
    zoom?: number;
    rotation?: number;
  }>;
  duration: number;
  easing: string;
}

/**
 * Background effect preset definition
 */
export interface BackgroundPreset {
  category: 'background';
  name: string;
  effect: string;
  properties: PropertyMap;
  animation?: Animation;
}

/**
 * Transition preset definition
 */
export interface TransitionPreset {
  category: 'transition';
  name: string;
  from: PropertyMap;
  to: PropertyMap;
  duration: number;
  easing: string;
}

/**
 * Union of all preset types
 */
export type Preset =
  TextPreset | LogoPreset | ObjectPreset | CameraPreset | BackgroundPreset | TransitionPreset;

/**
 * Preset registry for looking up presets by name
 */
export interface PresetRegistry {
  text: Map<string, TextPreset>;
  logo: Map<string, LogoPreset>;
  object: Map<string, ObjectPreset>;
  camera: Map<string, CameraPreset>;
  background: Map<string, BackgroundPreset>;
  transition: Map<string, TransitionPreset>;
}

/**
 * Text part for split animations
 */
export interface TextPart {
  text: string;
  index: number;
  x: number;
  width: number;
}

/**
 * Split text layout result
 */
export interface SplitTextLayout {
  parts: TextPart[];
  totalWidth: number;
  totalHeight: number;
}
