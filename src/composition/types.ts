export interface SceneDefinition {
  id: string;
  label: string;
  start: number;
  duration: number;
  accent: string;
}

export interface CompositionContext {
  root: HTMLElement;
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
