export type SceneTrackKind =
  "Text" | "Element" | "SVG" | "Background" | "Camera";

export interface SceneTrack {
  id: string;
  label: string;
  kind: SceneTrackKind;
  start: number;
  end: number;
}

export interface SceneDefinition {
  id: string;
  label: string;
  start: number;
  duration: number;
  accent: string;
  tracks?: readonly SceneTrack[];
}

export interface CompositionContext {
  root: HTMLElement;
  element: HTMLElement;
  container: HTMLElement;
  timeline: gsap.core.Timeline;
  register(id: string, element: HTMLElement): HTMLElement;
}

export interface CompositionDefinition {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  scenes: readonly SceneDefinition[];
  sourcePreview: string;
  build(context: CompositionContext): void;
}

export interface ElementOverride {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  color?: string;
  backgroundColor?: string;
  fill?: string;
  stroke?: string;
  fontSize?: number;
  borderRadius?: number;
  hidden?: boolean;
}

export interface AnimationOverride {
  speed: number;
  ease: string;
  tweenCount: number;
}

export interface RuntimeSnapshot {
  time: number;
  playing: boolean;
  sceneId: string;
}

export function defineComposition<const T extends CompositionDefinition>(
  definition: T,
): T {
  return definition;
}
