/**
 * Canvas renderer for Motionly scenes
 * Renders evaluated scenes to HTML5 Canvas
 */

import type { EvaluatedScene, EvaluatedElement, Canvas, ElementProperties } from '../types/scene';
import type { BoundingBox } from '../types/export';
import type { LoadedAsset } from '../assets/asset-loader';

/**
 * Canvas renderer class
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.context = ctx;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  /**
   * Render frame to canvas
   */
  render(frame: EvaluatedScene, assets: Map<string, LoadedAsset> = new Map()): void {
    const { canvas, camera, elements } = frame;
    this.resize(canvas.width, canvas.height);
    const ctx = this.context;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = canvas.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyCamera(ctx, canvas, camera);
    for (const element of layoutGeneratedText(elements)) {
      const props = element.render as unknown as Record<string, unknown>;
      if (props['layer'] !== 'effects') {
        drawElement(ctx, canvas, element, assets);
      }
    }
    ctx.restore();

    for (const element of layoutGeneratedText(elements)) {
      const props = element.render as unknown as Record<string, unknown>;
      if (props['layer'] === 'effects') {
        drawElement(ctx, canvas, element, assets);
      }
    }

    ctx.restore();
  }

  /**
   * Measure text width
   */
  measureText(text: string, font: string, size: number, weight: number): TextMetrics {
    this.context.font = `${weight} ${size}px ${font}`;
    return this.context.measureText(text);
  }
}

/**
 * Layout generated text elements (word grouping)
 */
function layoutGeneratedText(elements: EvaluatedElement[]): EvaluatedElement[] {
  const groups = new Map<string, EvaluatedElement[]>();
  const output: EvaluatedElement[] = [];

  for (const element of elements) {
    const props = element.properties as unknown as Record<string, unknown>;
    const group = props['textGroup'] as string | undefined;

    if (!group || props['textSplit'] !== 'words') {
      output.push(element);
      continue;
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(element);
  }

  for (const group of groups.values()) {
    output.push(...layoutWordGroup(group));
  }

  return output;
}

/**
 * Layout word group for proper spacing
 */
function layoutWordGroup(group: EvaluatedElement[]): EvaluatedElement[] {
  if (group.length === 0) return group;

  const ctx = layoutContext();
  const first = group[0]!.render as unknown as Record<string, unknown>;
  const groupX = (first['textGroupX'] as number) ?? 0;
  ctx.font = `${first['weight']} ${first['size']}px ${first['font']}`;

  const widths = group.map((element) => {
    const render = element.render as unknown as Record<string, unknown>;
    return ctx.measureText(String(render['value'])).width;
  });

  const space = ctx.measureText(' ').width;
  const total = widths.reduce((sum, width) => sum + width, 0) + space * (group.length - 1);
  let cursor = -total / 2;

  return group.map((element, index) => {
    const width = widths[index]!;
    const finalX = cursor + width / 2;
    cursor += width + space;

    const props = element.properties as unknown as Record<string, unknown>;
    const render = element.render as unknown as Record<string, unknown>;
    const baseX = props['x'] as number;
    const renderX = render['x'] as number | undefined;
    const drift = typeof renderX === 'number' && typeof baseX === 'number' ? renderX - baseX : 0;

    return {
      ...element,
      render: {
        ...element.render,
        x: groupX + finalX + drift,
      } as unknown as ElementProperties,
    };
  });
}

let textMeasureCanvas: HTMLCanvasElement | undefined;

/**
 * Get layout context for text measurement
 */
function layoutContext(): CanvasRenderingContext2D | typeof fallbackMeasureContext {
  if (typeof document === 'undefined') return fallbackMeasureContext;
  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement('canvas');
  }
  const ctx = textMeasureCanvas.getContext('2d');
  return ctx ?? fallbackMeasureContext;
}

/**
 * Fallback context for server-side rendering
 */
const fallbackMeasureContext = {
  font: '',
  measureText(text: string): TextMetrics {
    const size = Number.parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16');
    return { width: String(text).length * size * 0.52 } as TextMetrics;
  },
};

/**
 * Apply camera transformation
 */
function applyCamera(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  camera: ElementProperties
): void {
  const cameraProps = camera as unknown as Record<string, unknown>;
  const zoom = (cameraProps['zoom'] as number) ?? 1;
  const rotation = (cameraProps['rotation'] as number) ?? 0;
  const x = (cameraProps['x'] as number) ?? 0;
  const y = (cameraProps['y'] as number) ?? 0;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-(canvas.width / 2) - x, -(canvas.height / 2) - y);
}

/**
 * Draw element to canvas
 */
function drawElement(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  element: EvaluatedElement,
  assets: Map<string, LoadedAsset>
): void {
  const props = element.render as unknown as Record<string, unknown>;
  const opacity = props['opacity'] as number;

  if (opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  const filter = buildFilter(props);
  if (filter !== 'none') {
    ctx.filter = filter;
  }

  if (element.kind === 'text') {
    drawText(ctx, canvas, props);
  } else if (element.kind === 'overlay') {
    drawOverlay(ctx, canvas, props);
  } else if (element.kind === 'effect') {
    drawEffect(ctx, canvas, props);
  } else {
    drawAsset(ctx, canvas, element, props, assets);
  }

  ctx.restore();
}

/**
 * Draw asset (image or SVG)
 */
function drawAsset(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  element: EvaluatedElement,
  props: Record<string, unknown>,
  assets: Map<string, LoadedAsset>
): void {
  const assetName = element.assetName;
  if (!assetName) return;

  const asset = assets.get(assetName);
  if (!asset) return;

  const box = resolveBox(canvas, asset, props);
  drawShadow(ctx, props);

  const rotation = (props['rotation'] as number) ?? 0;
  const scale = (props['scale'] as number) ?? 1;

  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  clipReveal(ctx, box.width, box.height, props);
  const progress = props['pathProgress'];
  if (typeof progress === 'number' && asset.motionlySvg?.paths.length) {
    drawSvgReveal(ctx, asset, box, progress);
  } else {
    ctx.drawImage(asset, -box.width / 2, -box.height / 2, box.width, box.height);
  }
}

function drawSvgReveal(
  ctx: CanvasRenderingContext2D,
  asset: LoadedAsset,
  box: BoundingBox,
  value: number
): void {
  const svg = asset.motionlySvg!;
  const progress = Math.max(0, Math.min(1, value));
  const artworkOpacity = Math.max(0, Math.min(1, (progress - 0.72) / 0.28));

  if (artworkOpacity > 0) {
    ctx.save();
    ctx.globalAlpha *= artworkOpacity;
    ctx.drawImage(asset, -box.width / 2, -box.height / 2, box.width, box.height);
    ctx.restore();
  }

  if (progress >= 1) return;
  ctx.save();
  ctx.translate(-box.width / 2, -box.height / 2);
  ctx.scale(box.width / svg.width, box.height / svg.height);
  const alpha = ctx.globalAlpha;
  for (const path of svg.paths) {
    ctx.strokeStyle = path.stroke;
    ctx.globalAlpha = alpha * path.opacity;
    ctx.lineWidth = path.strokeWidth;
    ctx.lineCap = path.lineCap;
    ctx.lineJoin = path.lineJoin;
    ctx.setLineDash([path.length, path.length]);
    ctx.lineDashOffset = path.length * (1 - progress);
    ctx.stroke(new Path2D(path.d));
  }
  ctx.restore();
}

/**
 * Draw text element
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  drawShadow(ctx, props);

  ctx.fillStyle = (props['color'] as string) ?? '#fff';
  ctx.font = `${props['weight']} ${props['size']}px ${props['font']}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const center = props['center'] as boolean;
  const x = center
    ? canvas.width / 2 + ((props['x'] as number) ?? 0)
    : ((props['x'] as number) ?? 0);
  const y = center
    ? canvas.height / 2 + ((props['y'] as number) ?? 0)
    : ((props['y'] as number) ?? 0);
  const rotation = (props['rotation'] as number) ?? 0;
  const scale = (props['scale'] as number) ?? 1;
  const value = String(props['value'] ?? '');
  const tracking = (props['tracking'] as number) ?? 0;

  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  drawTrackedText(ctx, value, 0, 0, tracking);
}

/**
 * Draw text with custom tracking
 */
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number
): void {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = Array.from(text);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
  let cursor = x - total / 2;
  ctx.textAlign = 'left';

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const width = widths[index];
    if (char && width !== undefined) {
      ctx.fillText(char, cursor, y);
      cursor += width + tracking;
    }
  }
}

/**
 * Draw overlay element
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  ctx.fillStyle = (props['fill'] as string) ?? '#000';
  const progress = props['revealProgress'];
  if (typeof progress === 'number') {
    const value = Math.max(0, Math.min(1, progress));
    if (props['revealStyle'] === 'iris') {
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        (Math.hypot(canvas.width, canvas.height) * value) / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
      return;
    }
    const direction = String(props['revealDirection'] ?? 'right');
    if (direction === 'left')
      ctx.fillRect(canvas.width * (1 - value), 0, canvas.width * value, canvas.height);
    else if (direction === 'up')
      ctx.fillRect(0, canvas.height * (1 - value), canvas.width, canvas.height * value);
    else if (direction === 'down') ctx.fillRect(0, 0, canvas.width, canvas.height * value);
    else ctx.fillRect(0, 0, canvas.width * value, canvas.height);
    return;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function applySkew(ctx: CanvasRenderingContext2D, props: Record<string, unknown>): void {
  const x = Math.tan((((props['skewX'] as number) ?? 0) * Math.PI) / 180);
  const y = Math.tan((((props['skewY'] as number) ?? 0) * Math.PI) / 180);
  if (x || y) ctx.transform(1, y, x, 1, 0, 0);
}

function clipReveal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  props: Record<string, unknown>
): void {
  const progress = props['revealProgress'];
  if (typeof progress !== 'number') return;
  const value = Math.max(0, Math.min(1, progress));
  const direction = String(props['revealDirection'] ?? 'right');
  ctx.beginPath();
  if (direction === 'left') ctx.rect(width / 2 - width * value, -height / 2, width * value, height);
  else if (direction === 'up')
    ctx.rect(-width / 2, height / 2 - height * value, width, height * value);
  else if (direction === 'down') ctx.rect(-width / 2, -height / 2, width, height * value);
  else ctx.rect(-width / 2, -height / 2, width * value, height);
  ctx.clip();
}

/**
 * Draw effect element
 */
function drawEffect(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const effect = props['effect'] as string;

  if (effect === 'noise') {
    drawNoise(ctx, canvas, props);
    return;
  }

  if (effect === 'grid' || effect === 'mesh') {
    drawGrid(ctx, canvas, props);
    return;
  }

  if (effect === 'rippleGrid' || effect === 'ripple-grid') {
    drawRippleGrid(ctx, canvas, props);
    return;
  }

  if (effect === 'prism') {
    drawPrism(ctx, canvas, props);
    return;
  }

  drawGradientMotion(ctx, canvas, props);
}

/**
 * Draw gradient motion effect
 */
function drawGradientMotion(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const offset = (props['offset'] as number) ?? 0;
  const effect = (props['effect'] as string) ?? 'gradientMotion';

  const x = canvas.width * (0.18 + 0.68 * offset);
  const y = canvas.height * (0.32 + 0.2 * Math.sin(offset * Math.PI * 2));
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * 0.62);
  const palette = gradientPalette(effect);

  gradient.addColorStop(0, palette[0]!);
  gradient.addColorStop(0.42, palette[1]!);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Get gradient color palette
 */
function gradientPalette(effect: string): [string, string] {
  if (effect === 'aurora') return ['rgba(124, 247, 197, 0.32)', 'rgba(138, 180, 255, 0.2)'];
  if (effect === 'codeGlow') return ['rgba(88, 101, 242, 0.3)', 'rgba(124, 247, 197, 0.14)'];
  if (effect === 'heroGlow') return ['rgba(255, 255, 255, 0.18)', 'rgba(138, 180, 255, 0.18)'];
  return ['rgba(124, 247, 197, 0.34)', 'rgba(138, 180, 255, 0.2)'];
}

/**
 * Draw grid effect
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const offset = ((props['offset'] as number) ?? 0) * 48;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)';
  ctx.lineWidth = 1;

  for (let x = -48 + offset; x < canvas.width + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = -48 + offset; y < canvas.height + 48; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

/**
 * Draw prism-style luminous pyramid background.
 */
function drawPrism(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const offset = (props['offset'] as number) ?? 0;
  const intensity = (props['intensity'] as number) ?? 1;
  const cx =
    canvas.width * (0.5 + Math.sin(offset * Math.PI * 2) * 0.08) + ((props['x'] as number) ?? 0);
  const cy =
    canvas.height * (0.54 + Math.cos(offset * Math.PI * 2) * 0.04) + ((props['y'] as number) ?? 0);
  const height = canvas.height * 0.82;
  const half = canvas.width * 0.32;
  const phase = offset * Math.PI * 2;

  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.72);
  bg.addColorStop(0, `rgba(138, 180, 255, ${0.16 * intensity})`);
  bg.addColorStop(0.42, `rgba(124, 247, 197, ${0.08 * intensity})`);
  bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(phase) * 0.12);

  for (let index = 0; index < 7; index += 1) {
    const t = index / 6;
    const y = -height * 0.42 + t * height * 0.82;
    const w = half * (1 - Math.abs(t - 0.5) * 1.35);
    const hue = 170 + Math.sin(phase * 1.8 + index * 0.8) * 80;
    const alpha = (0.17 - index * 0.013) * intensity;

    ctx.beginPath();
    ctx.moveTo(0, -height * 0.5);
    ctx.lineTo(-w, y);
    ctx.lineTo(0, height * 0.46);
    ctx.lineTo(w, y);
    ctx.closePath();
    ctx.strokeStyle = `hsla(${hue}, 92%, 72%, ${alpha})`;
    ctx.lineWidth = 3 + index * 3.5;
    ctx.stroke();
  }

  const core = ctx.createLinearGradient(0, -height * 0.5, 0, height * 0.5);
  core.addColorStop(0, `rgba(255, 255, 255, ${0.18 * intensity})`);
  core.addColorStop(0.45, `rgba(138, 180, 255, ${0.08 * intensity})`);
  core.addColorStop(1, 'rgba(124, 247, 197, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.48);
  ctx.lineTo(-half * 0.45, height * 0.28);
  ctx.lineTo(0, height * 0.48);
  ctx.lineTo(half * 0.45, height * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw animated ripple grid background.
 */
function drawRippleGrid(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const offset = (props['offset'] as number) ?? 0;
  const intensity = (props['intensity'] as number) ?? 1;
  const spacing = (props['gridSize'] as number) ?? 56;
  const amplitude = 34 * intensity;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxDistance = Math.hypot(cx, cy);

  ctx.lineWidth = (props['gridThickness'] as number) ?? 1;
  ctx.strokeStyle = (props['color'] as string) ?? 'rgba(255, 255, 255, 0.22)';

  for (let x = -spacing; x <= canvas.width + spacing; x += spacing) {
    ctx.beginPath();
    for (let y = 0; y <= canvas.height; y += 18) {
      const d = Math.hypot(x - cx, y - cy) / maxDistance;
      const wave = Math.sin(d * 28 - offset * Math.PI * 6) * amplitude * (1 - d);
      if (y === 0) ctx.moveTo(x + wave, y);
      else ctx.lineTo(x + wave, y);
    }
    ctx.stroke();
  }

  for (let y = -spacing; y <= canvas.height + spacing; y += spacing) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 18) {
      const d = Math.hypot(x - cx, y - cy) / maxDistance;
      const wave = Math.sin(d * 28 - offset * Math.PI * 6) * amplitude * (1 - d);
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const fade = ctx.createRadialGradient(cx, cy, canvas.width * 0.18, cx, cy, canvas.width * 0.7);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw noise effect
 */
function drawNoise(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const step = 6;
  const seed = Math.floor(((props['offset'] as number) ?? 0) * 60);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      if (hash(x, y, seed) > 0.92) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * Hash function for noise generation
 */
function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Resolve bounding box for asset
 */
function resolveBox(
  canvas: Canvas,
  asset: LoadedAsset,
  props: Record<string, unknown>
): BoundingBox {
  const assetWidth = asset.width;
  const assetHeight = asset.height;

  const cover = props['cover'] as boolean;
  const center = props['center'] as boolean;
  const propX = (props['x'] as number) ?? 0;
  const propY = (props['y'] as number) ?? 0;
  const propWidth = props['width'] as number | null;
  const propHeight = props['height'] as number | null;

  if (cover) {
    const overscan = (props['overscan'] as number) ?? 1.18;
    const scale = Math.max(canvas.width / assetWidth, canvas.height / assetHeight) * overscan;
    const width = assetWidth * scale;
    const height = assetHeight * scale;

    return {
      x: (canvas.width - width) / 2 + propX,
      y: (canvas.height - height) / 2 + propY,
      width,
      height,
    };
  }

  const width = propWidth ?? (propHeight ? assetWidth * (propHeight / assetHeight) : assetWidth);
  const height = propHeight ?? assetHeight * (width / assetWidth);
  const x = center ? (canvas.width - width) / 2 + propX : propX;
  const y = center ? (canvas.height - height) / 2 + propY : propY;

  return { x, y, width, height };
}

/**
 * Build CSS filter string
 */
function buildFilter(props: Record<string, unknown>): string {
  const filters: string[] = [];
  const blur = props['blur'] as number | undefined;
  const brightness = props['brightness'] as number | undefined;

  if (blur) {
    filters.push(`blur(${blur}px)`);
  }
  if (brightness !== undefined && brightness !== 1) {
    filters.push(`brightness(${brightness})`);
  }

  return filters.length ? filters.join(' ') : 'none';
}

/**
 * Apply shadow to context
 */
function drawShadow(ctx: CanvasRenderingContext2D, props: Record<string, unknown>): void {
  const shadow = props['shadow'] as number | undefined;

  if (!shadow) {
    ctx.shadowBlur = 0;
    return;
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = shadow;
  ctx.shadowOffsetY = shadow / 3;
}
