/**
 * Export and Rendering Types
 *
 * These types define the export pipeline and rendering interfaces.
 */

import type { Scene, EvaluatedScene } from './scene';

/**
 * Supported export formats
 */
export type ExportFormat = 'mp4' | 'webm' | 'gif';

/**
 * Export format support information
 */
export interface ExportSupport {
  webm: boolean;
  mp4: boolean;
  gif: boolean;
}

/**
 * Export options
 */
export interface ExportOptions {
  scene: Scene;
  assets: Map<string, HTMLImageElement | SVGSVGElement>;
  format: ExportFormat;
  height: number;
  fps: number;
  onProgress?: (progress: number) => void;
}

/**
 * Export resolution preset
 */
export interface ResolutionPreset {
  name: string;
  width: number;
  height: number;
  label: string;
}

/**
 * Export FPS preset
 */
export interface FPSPreset {
  value: number;
  label: string;
}

/**
 * Export bitrate configuration
 */
export interface BitrateConfig {
  videoBitsPerSecond: number;
}

/**
 * Render frame options
 */
export interface RenderOptions {
  renderer: CanvasRenderer;
  scene: Scene;
  assets: Map<string, HTMLImageElement | SVGSVGElement>;
  fps: number;
  onProgress?: (progress: number) => void;
}

/**
 * Canvas renderer interface
 */
export interface CanvasRenderer {
  resize(width: number, height: number): void;
  render(scene: EvaluatedScene, assets: Map<string, HTMLImageElement | SVGSVGElement>): void;
  measureText(text: string, font: string, size: number, weight: number): TextMetrics;
}

/**
 * Renderer context for drawing operations
 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  assets: Map<string, HTMLImageElement | SVGSVGElement>;
}

/**
 * Bounding box for elements
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Text layout result
 */
export interface TextLayout {
  lines: TextLine[];
  width: number;
  height: number;
}

/**
 * Single line of text
 */
export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
}

/**
 * Word group for word-based animations
 */
export interface WordGroup {
  text: string;
  x: number;
  width: number;
}

/**
 * Gradient palette for effects
 */
export interface GradientPalette {
  colors: string[];
  positions: number[];
}

/**
 * Filter configuration for effects
 */
export interface FilterConfig {
  blur?: number;
  brightness?: number;
  opacity?: number;
}
