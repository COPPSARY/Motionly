/**
 * Canvas renderer for Motionly scenes
 * Renders evaluated scenes to HTML5 Canvas
 */

import type { EvaluatedScene, EvaluatedElement, Canvas, ElementProperties } from '../types/scene';
import type { BoundingBox } from '../types/export';
import {
  isLoadedAudio,
  isLoadedVideo,
  type DrawableAsset,
  type LoadedAsset,
  type MotionlySvgData,
} from '../assets/asset-loader';
import { formatCountValue } from '../animation-library/count-up';
import { canonicalEffectName } from '../semantic/catalog';

/**
 * Canvas renderer class
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement;
  private maskContext: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.context = ctx;
    this.maskCanvas = canvas.ownerDocument.createElement('canvas');
    const maskContext = this.maskCanvas.getContext('2d');
    if (!maskContext) throw new Error('Failed to create mask rendering context');
    this.maskContext = maskContext;
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.maskCanvas.width !== width) this.maskCanvas.width = width;
    if (this.maskCanvas.height !== height) this.maskCanvas.height = height;
  }

  /**
   * Render frame to canvas
   */
  render(
    frame: EvaluatedScene,
    assets: Map<string, LoadedAsset> = new Map(),
    outputScale = 1
  ): void {
    const { canvas, camera, elements } = frame;
    const scale = Math.max(0.05, Math.min(1, Number.isFinite(outputScale) ? outputScale : 1));
    this.resize(
      Math.max(1, Math.round(canvas.width * scale)),
      Math.max(1, Math.round(canvas.height * scale))
    );
    const ctx = this.context;

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = scale < 1 ? 'medium' : 'high';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = canvas.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const laidOut = layoutGeneratedText(elements);
    const ordered = [
      ...laidOut.filter((element) => element.kind === 'scene'),
      ...laidOut.filter((element) => element.kind !== 'scene'),
    ];
    const hiddenMaskSources = hiddenMaskSourceIds(laidOut);
    const elementsById = new Map(laidOut.map((element) => [element.id, element]));

    ctx.save();
    applyCamera(ctx, canvas, camera);
    for (const element of ordered) {
      const props = element.render as unknown as Record<string, unknown>;
      if (props['layer'] !== 'effects' && !hiddenMaskSources.has(element.id)) {
        drawElementWithMask(
          ctx,
          canvas,
          element,
          assets,
          elementsById,
          this.maskCanvas,
          this.maskContext
        );
      }
    }
    ctx.restore();

    for (const element of ordered) {
      const props = element.render as unknown as Record<string, unknown>;
      if (props['layer'] === 'effects' && !hiddenMaskSources.has(element.id)) {
        drawElementWithMask(
          ctx,
          canvas,
          element,
          assets,
          elementsById,
          this.maskCanvas,
          this.maskContext
        );
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

    if (!group || !['words', 'chars', 'lines'].includes(String(props['textSplit']))) {
      output.push(element);
      continue;
    }

    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(element);
  }

  for (const group of groups.values()) {
    output.push(...layoutFragmentGroup(group));
  }

  return output;
}

/**
 * Layout word group for proper spacing
 */
function layoutFragmentGroup(group: EvaluatedElement[]): EvaluatedElement[] {
  if (group.length === 0) return group;

  const ctx = layoutContext();
  const first = group[0]!.render as unknown as Record<string, unknown>;
  const groupX = (first['textGroupX'] as number) ?? 0;
  const groupY = Number(first['y'] ?? 0);
  const split = String(
    (group[0]!.properties as unknown as Record<string, unknown>)['textSplit'] ?? 'words'
  );
  ctx.font = `${first['weight']} ${first['size']}px ${first['font']}`;

  const widths = group.map((element) => {
    const render = element.render as unknown as Record<string, unknown>;
    return ctx.measureText(String(render['value'])).width;
  });

  const space = split === 'words' ? ctx.measureText(' ').width : 0;
  const total = widths.reduce((sum, width) => sum + width, 0) + space * (group.length - 1);
  // Anchor the run to the source element's layout box when it was aligned:
  // a left-aligned typewriter starts typing at the box's left edge instead of
  // re-centering (and drifting) as fragments accumulate.
  const groupAlign = String(first['textGroupAlign'] ?? 'center');
  const groupWidth = Number(first['textGroupWidth']);
  let cursor = -total / 2;
  if (Number.isFinite(groupWidth) && groupWidth > 0) {
    if (groupAlign === 'left') cursor = -groupWidth / 2;
    else if (groupAlign === 'right') cursor = groupWidth / 2 - total;
  }

  return group.map((element, index) => {
    const width = widths[index]!;
    const finalX = split === 'lines' ? 0 : cursor + width / 2;
    cursor += width + space;

    const props = element.properties as unknown as Record<string, unknown>;
    const render = element.render as unknown as Record<string, unknown>;
    const baseX = props['x'] as number;
    const renderX = render['x'] as number | undefined;
    const drift = typeof renderX === 'number' && typeof baseX === 'number' ? renderX - baseX : 0;

    const lineHeight = Number(render['lineHeight'] ?? 1.2) * Number(render['size'] ?? 64);
    const finalY =
      split === 'lines'
        ? groupY + (index - (group.length - 1) / 2) * lineHeight
        : Number(render['y'] ?? groupY);
    return {
      ...element,
      render: {
        ...element.render,
        x: groupX + finalX + drift,
        y: finalY,
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

/** Mask layers are hidden unless their target opts into showing them as normal artwork. */
export function hiddenMaskSourceIds(elements: EvaluatedElement[]): Set<string> {
  const hidden = new Set<string>();
  for (const element of elements) {
    const props = element.render as unknown as Record<string, unknown>;
    const mask = String(props['mask'] ?? '');
    if (mask && mask !== 'none' && props['maskVisible'] !== true) hidden.add(mask);
  }
  return hidden;
}

function drawElementWithMask(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  element: EvaluatedElement,
  assets: Map<string, LoadedAsset>,
  elementsById: Map<string, EvaluatedElement>,
  maskCanvas: HTMLCanvasElement,
  maskContext: CanvasRenderingContext2D
): void {
  const props = element.render as unknown as Record<string, unknown>;
  const maskId = String(props['mask'] ?? '');
  const maskElement = maskId && maskId !== 'none' ? elementsById.get(maskId) : undefined;
  if (!maskElement) {
    drawElement(ctx, canvas, element, assets, elementsById);
    return;
  }

  maskContext.save();
  maskContext.setTransform(1, 0, 0, 1, 0, 0);
  maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskContext.restore();

  maskContext.save();
  maskContext.setTransform(ctx.getTransform());
  maskContext.globalAlpha = 1;
  maskContext.filter = 'none';
  maskContext.globalCompositeOperation = 'source-over';
  drawElement(maskContext, canvas, element, assets, elementsById);
  maskContext.globalCompositeOperation =
    props['maskInvert'] === true ? 'destination-out' : 'destination-in';
  drawElement(maskContext, canvas, maskElement, assets, elementsById);
  maskContext.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.restore();
}

/**
 * Draw element to canvas
 */
function drawElement(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  element: EvaluatedElement,
  assets: Map<string, LoadedAsset>,
  elementsById: Map<string, EvaluatedElement>
): void {
  const props = element.render as unknown as Record<string, unknown>;
  const opacity = props['opacity'] as number;

  if (opacity <= 0) return;

  applyMotionPath(props, assets, elementsById);

  ctx.save();
  ctx.globalAlpha = opacity;
  const blendMode = String(props['blendMode'] ?? 'source-over');
  if (isBlendMode(blendMode)) ctx.globalCompositeOperation = blendMode;

  const clipWidth = Number(props['clipWidth'] ?? 0);
  const clipHeight = Number(props['clipHeight'] ?? 0);
  if (clipWidth > 0 && clipHeight > 0) {
    ctx.translate(
      canvas.width / 2 + Number(props['clipX'] ?? 0),
      canvas.height / 2 + Number(props['clipY'] ?? 0)
    );
    ctx.rotate((Number(props['clipRotation'] ?? 0) * Math.PI) / 180);
    ctx.beginPath();
    ctx.rect(-clipWidth / 2, -clipHeight / 2, clipWidth, clipHeight);
    ctx.clip();
    ctx.rotate((-Number(props['clipRotation'] ?? 0) * Math.PI) / 180);
    ctx.translate(
      -(canvas.width / 2 + Number(props['clipX'] ?? 0)),
      -(canvas.height / 2 + Number(props['clipY'] ?? 0))
    );
  }

  const filter = buildCanvasFilter(props);
  if (filter !== 'none') {
    ctx.filter = filter;
  }

  if (element.kind === 'text') {
    drawText(ctx, canvas, props);
  } else if (element.kind === 'path' && props['guide']) {
    // Motion guides are editable helpers, not export artwork.
  } else if (element.kind === 'overlay' || element.kind === 'path') {
    drawOverlay(ctx, canvas, props, assets, elementsById);
  } else if (element.kind === 'effect') {
    drawEffect(ctx, canvas, props);
  } else if (element.kind === 'scene') {
    if (props['background']) {
      ctx.fillStyle = String(props['background']);
      ctx.translate(
        canvas.width / 2 + Number(props['x'] ?? 0),
        canvas.height / 2 + Number(props['y'] ?? 0)
      );
      ctx.rotate((Number(props['rotation'] ?? 0) * Math.PI) / 180);
      ctx.scale(Number(props['scale'] ?? 1), Number(props['scale'] ?? 1));
      ctx.fillRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
    }
  } else if (element.kind === 'group') {
    // Structural layer: descendants already contain its evaluated world transform.
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
  // Audio clips ride the same clip pipeline as visual media but have nothing to draw.
  if (!asset || isLoadedAudio(asset)) return;
  const drawable = isLoadedVideo(asset) ? asset.motionlyPreviewFrame : asset;
  if (!drawable?.width || !drawable.height) return;

  const box = resolveBox(canvas, asset, props);
  drawShadow(ctx, props);

  const rotation = (props['rotation'] as number) ?? 0;
  const scale = (props['scale'] as number) ?? 1;
  const origin = resolveOrigin(props, box.width, box.height);
  const drawX = -origin.x;
  const drawY = -origin.y;

  ctx.translate(box.x + origin.x, box.y + origin.y);
  ctx.rotate((rotation * Math.PI) / 180);
  apply3DTilt(ctx, props, box.width, box.height);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  clipReveal(ctx, box.width, box.height, props, drawX, drawY);
  const progress = props['pathProgress'];
  const morphProgress = props['morphProgress'];
  const morphTarget = props['morphTo'] ? assets.get(String(props['morphTo'])) : undefined;
  if (typeof morphProgress === 'number' && morphTarget && !isLoadedAudio(morphTarget)) {
    drawSvgMorph(ctx, asset, morphTarget, box, morphProgress, drawX, drawY, props);
  } else if (
    typeof progress === 'number' &&
    asset.motionlySvg?.vectorSafe &&
    asset.motionlySvg.paths.length
  ) {
    drawSvgReveal(ctx, asset, box, progress, drawX, drawY, props);
  } else if (
    asset.motionlySvg?.paths.length &&
    asset.motionlySvg.vectorSafe &&
    !asset.motionlySvg.animated &&
    (props['fill'] !== undefined ||
      props['stroke'] !== undefined ||
      props['strokeWidth'] !== undefined)
  ) {
    drawSvgVector(ctx, asset.motionlySvg, box, drawX, drawY, props);
  } else {
    try {
      // drawSVG on assets the vector pipeline cannot reveal path-by-path
      // (rasters, animated SVG) falls back to an alpha reveal so a delayed
      // draw still hides the artwork instead of showing it fully formed.
      if (typeof progress === 'number') {
        ctx.globalAlpha *= Math.max(0, Math.min(1, progress));
      }
      ctx.drawImage(drawable, drawX, drawY, box.width, box.height);
    } catch (error) {
      // Chromium can briefly expose a decoded video as ready while replacing its
      // current frame. Skipping that frame keeps the whole canvas render alive.
      if (!isLoadedVideo(asset)) throw error;
    }
  }
}

function drawSvgMorph(
  ctx: CanvasRenderingContext2D,
  sourceAsset: DrawableAsset,
  targetAsset: DrawableAsset,
  box: BoundingBox,
  value: number,
  drawX: number,
  drawY: number,
  props: Record<string, unknown>
): void {
  const progress = Math.max(0, Math.min(1, value));
  const source = sourceAsset.motionlySvg;
  const target = targetAsset.motionlySvg;
  const compatible =
    source &&
    target &&
    source.vectorSafe &&
    target.vectorSafe &&
    source.width === target.width &&
    source.height === target.height &&
    source.paths.length === target.paths.length &&
    source.paths.every((path, index) =>
      Boolean(interpolateCompatiblePathData(path.d, target.paths[index]?.d ?? '', progress))
    );

  if (!compatible || !source || !target) {
    const targetDrawable = isLoadedVideo(targetAsset)
      ? targetAsset.motionlyPreviewFrame
      : targetAsset;
    ctx.save();
    ctx.globalAlpha *= 1 - progress;
    ctx.drawImage(sourceAsset, drawX, drawY, box.width, box.height);
    ctx.restore();
    if (targetDrawable) {
      ctx.save();
      ctx.globalAlpha *= progress;
      ctx.drawImage(targetDrawable, drawX, drawY, box.width, box.height);
      ctx.restore();
    }
    return;
  }

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(box.width / source.width, box.height / source.height);
  const alpha = ctx.globalAlpha;
  for (let index = 0; index < source.paths.length; index += 1) {
    const from = source.paths[index]!;
    const to = target.paths[index]!;
    const data = interpolateCompatiblePathData(from.d, to.d, progress);
    if (!data) continue;
    const vector = new Path2D(data);
    const fill = String(props['fill'] ?? from.fill);
    const stroke = String(props['stroke'] ?? from.stroke);
    if (fill !== 'none') {
      ctx.globalAlpha = alpha * (from.fillOpacity + (to.fillOpacity - from.fillOpacity) * progress);
      ctx.fillStyle = vectorGradient(ctx, props, source.width, source.height) ?? fill;
      ctx.fill(vector);
    }
    if (stroke !== 'none') {
      ctx.globalAlpha = alpha * (from.opacity + (to.opacity - from.opacity) * progress);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = finiteNumber(
        props['strokeWidth'],
        from.strokeWidth + (to.strokeWidth - from.strokeWidth) * progress
      );
      ctx.lineCap = from.lineCap;
      ctx.lineJoin = from.lineJoin;
      ctx.stroke(vector);
    }
  }
  ctx.restore();
}

const PATH_TOKEN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi;

/** Interpolate path data when both paths have identical command topology. */
export function interpolateCompatiblePathData(
  from: string,
  to: string,
  progress: number
): string | null {
  const fromTokens = from.match(PATH_TOKEN);
  const toTokens = to.match(PATH_TOKEN);
  if (!fromTokens || !toTokens || fromTokens.length !== toTokens.length) return null;
  const clamped = Math.max(0, Math.min(1, progress));
  const output: string[] = [];
  let command = '';
  let parameterIndex = 0;
  for (let index = 0; index < fromTokens.length; index += 1) {
    const left = fromTokens[index]!;
    const right = toTokens[index]!;
    const leftCommand = /^[a-zA-Z]$/.test(left);
    const rightCommand = /^[a-zA-Z]$/.test(right);
    if (leftCommand || rightCommand) {
      if (!leftCommand || !rightCommand || left !== right) return null;
      command = left;
      parameterIndex = 0;
      output.push(left);
      continue;
    }
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return null;
    const arcParameter = command.toLowerCase() === 'a' ? parameterIndex % 7 : -1;
    if (arcParameter === 3 || arcParameter === 4) {
      if (leftNumber !== rightNumber || (leftNumber !== 0 && leftNumber !== 1)) return null;
      output.push(String(leftNumber));
    } else {
      const value = leftNumber + (rightNumber - leftNumber) * clamped;
      output.push(String(Number(value.toFixed(4))));
    }
    parameterIndex += 1;
  }
  return output.join(' ');
}

function drawSvgReveal(
  ctx: CanvasRenderingContext2D,
  asset: DrawableAsset,
  box: BoundingBox,
  value: number,
  drawX: number,
  drawY: number,
  props: Record<string, unknown>
): void {
  const svg = asset.motionlySvg;
  if (!svg) return;
  const trimEnd = Math.max(0, Math.min(1, value));
  const trimStart = Math.max(0, Math.min(trimEnd, finiteNumber(props['trimStart'], 0)));
  // The full-artwork fade-in only makes sense for the default "draw from the
  // start" usage; a moving trimmed segment (trimStart > 0) is a comet-trail
  // effect and should never solidify into the filled artwork.
  const artworkOpacity = trimStart <= 0 ? Math.max(0, Math.min(1, (trimEnd - 0.72) / 0.28)) : 0;

  if (artworkOpacity > 0) {
    ctx.save();
    ctx.globalAlpha *= artworkOpacity;
    ctx.drawImage(asset, drawX, drawY, box.width, box.height);
    ctx.restore();
  }

  if (trimStart <= 0 && trimEnd >= 1) return;
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(box.width / svg.width, box.height / svg.height);
  const alpha = ctx.globalAlpha;
  for (const path of svg.paths) {
    if (path.stroke === 'none') continue;
    ctx.strokeStyle = String(props['stroke'] ?? path.stroke);
    ctx.globalAlpha = alpha * path.opacity;
    ctx.lineWidth = finiteNumber(props['strokeWidth'], path.strokeWidth);
    ctx.lineCap = path.lineCap;
    ctx.lineJoin = path.lineJoin;
    const segment = Math.max(0, trimEnd - trimStart) * path.length;
    ctx.setLineDash([segment, Math.max(0.001, path.length - segment)]);
    ctx.lineDashOffset = -trimStart * path.length;
    ctx.stroke(svgPath(path));
  }
  ctx.restore();
}

const motionPathElementCache = new Map<string, SVGPathElement | null>();

/** Detached, cached DOM path element used only for point-at-length sampling. */
function motionPathElement(d: string): SVGPathElement | null {
  const cached = motionPathElementCache.get(d);
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') return null;
  let element: SVGPathElement | null;
  try {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    element.setAttribute('d', d);
  } catch {
    element = null;
  }
  motionPathElementCache.set(d, element);
  return element;
}

/**
 * Move (and optionally orient) an element along an imported path asset's
 * geometry, using `motionPathProgress` (0-1) as position along the path.
 * The path's own SVG coordinate space is used directly as an x/y offset —
 * author guide paths in the same units as your canvas layout.
 */
function applyMotionPath(
  props: Record<string, unknown>,
  assets: Map<string, LoadedAsset>,
  elementsById: Map<string, EvaluatedElement>
): void {
  const pathAssetName = props['motionPath'];
  if (!pathAssetName) return;

  const asset = assets.get(String(pathAssetName));
  const svg = asset?.motionlySvg;
  const guide = elementsById.get(String(pathAssetName));
  const guideProps = guide?.render as unknown as Record<string, unknown> | undefined;
  const path = svg?.vectorSafe ? svg.paths[0] : undefined;
  const d = path?.d ?? (guide?.kind === 'path' ? String(guideProps?.['path'] ?? '') : '');
  if (!d) return;

  const element = motionPathElement(d);
  if (!element) return;
  let length = path?.length ?? 0;
  if (!length) {
    try {
      length = element.getTotalLength();
    } catch {
      return;
    }
  }

  const progress = Math.max(0, Math.min(1, finiteNumber(props['motionPathProgress'], 0)));
  let point: { x: number; y: number };
  try {
    point = element.getPointAtLength(length * progress);
  } catch {
    return;
  }

  props['x'] =
    finiteNumber(props['x'], 0) + point.x + (guide ? finiteNumber(guideProps?.['x'], 0) : 0);
  props['y'] =
    finiteNumber(props['y'], 0) + point.y + (guide ? finiteNumber(guideProps?.['y'], 0) : 0);

  if (props['motionPathRotate']) {
    const aheadProgress = Math.min(1, progress + 0.001);
    try {
      const ahead = element.getPointAtLength(length * aheadProgress);
      const angle = (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI;
      props['rotation'] = finiteNumber(props['rotation'], 0) + angle;
    } catch {
      // Keep the position update even if tangent sampling fails.
    }
  }
}

function drawSvgVector(
  ctx: CanvasRenderingContext2D,
  svg: MotionlySvgData,
  box: BoundingBox,
  drawX: number,
  drawY: number,
  props: Record<string, unknown>
): void {
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(box.width / svg.width, box.height / svg.height);
  const alpha = ctx.globalAlpha;
  for (const path of svg.paths) {
    const vector = svgPath(path);
    const fill = String(props['fill'] ?? path.fill);
    const stroke = String(props['stroke'] ?? path.stroke);
    if (fill !== 'none') {
      ctx.globalAlpha = alpha * path.fillOpacity;
      ctx.fillStyle = vectorGradient(ctx, props, svg.width, svg.height) ?? fill;
      ctx.fill(vector);
    }
    if (stroke !== 'none') {
      ctx.globalAlpha = alpha * path.opacity;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = finiteNumber(props['strokeWidth'], path.strokeWidth);
      ctx.lineCap = path.lineCap;
      ctx.lineJoin = path.lineJoin;
      ctx.stroke(vector);
    }
  }
  ctx.restore();
}

function vectorGradient(
  ctx: CanvasRenderingContext2D,
  props: Record<string, unknown>,
  width: number,
  height: number
): CanvasGradient | null {
  const from = props['gradientFrom'];
  const to = props['gradientTo'];
  if (!from || !to) return null;
  const angle = (finiteNumber(props['gradientAngle'], 0) * Math.PI) / 180;
  const radius = Math.hypot(width, height) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const dx = Math.cos(angle) * radius;
  const dy = Math.sin(angle) * radius;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  gradient.addColorStop(0, String(from));
  gradient.addColorStop(1, String(to));
  return gradient;
}

const svgPaths = new WeakMap<MotionlySvgData['paths'][number], Path2D>();

function svgPath(path: MotionlySvgData['paths'][number]): Path2D {
  const cached = svgPaths.get(path);
  if (cached) return cached;
  const created = new Path2D(path.d);
  svgPaths.set(path, created);
  return created;
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

  const center = props['center'] as boolean;
  const x = center
    ? canvas.width / 2 + ((props['x'] as number) ?? 0)
    : ((props['x'] as number) ?? 0);
  const y = center
    ? canvas.height / 2 + ((props['y'] as number) ?? 0)
    : ((props['y'] as number) ?? 0);
  const rotation = (props['rotation'] as number) ?? 0;
  const scale = (props['scale'] as number) ?? 1;
  const value =
    typeof props['countDecimals'] === 'number'
      ? `${String(props['countPrefix'] ?? '')}${formatCountValue(
          props['value'],
          String(props['countSeparator'] ?? ''),
          props['countDecimals']
        )}${String(props['countSuffix'] ?? '')}`
      : String(props['value'] ?? '');
  const tracking = (props['tracking'] as number) ?? 0;
  const boxWidth = Number(props['width']);
  const boxHeight = Number(props['height']);

  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  apply3DTilt(ctx, props);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  const hasBox = Number.isFinite(boxWidth) && boxWidth > 0;
  const revealWidth = hasBox ? boxWidth : Math.max(1, ctx.measureText(value).width);
  const align = String(props['textAlign'] ?? 'center');
  // Without an explicit box, glyphs run rightward from the origin for
  // textAlign left (and leftward for right) — anchor the reveal clip to the
  // same span instead of a box centered on the origin.
  const revealX =
    hasBox || align === 'center' ? -revealWidth / 2 : align === 'left' ? 0 : -revealWidth;
  clipReveal(
    ctx,
    revealWidth,
    Number.isFinite(boxHeight) && boxHeight > 0 ? boxHeight : Number(props['size'] ?? 64) * 1.4,
    props,
    revealX
  );
  const textAlign = String(props['textAlign'] ?? 'center') as CanvasTextAlign;
  const verticalAlign = String(props['verticalAlign'] ?? 'middle');
  const lineHeight =
    Math.max(0.1, Number(props['lineHeight'] ?? 1.2)) * Number(props['size'] ?? 64);
  const wrap = String(props['wrap'] ?? 'none');
  const lines = layoutTextLines(
    ctx,
    value,
    Number.isFinite(boxWidth) && boxWidth > 0 ? boxWidth : Infinity,
    wrap
  );
  const totalHeight = lineHeight * lines.length;
  const top =
    Number.isFinite(boxHeight) && boxHeight > 0
      ? verticalAlign === 'top'
        ? -boxHeight / 2 + lineHeight / 2
        : verticalAlign === 'bottom'
          ? boxHeight / 2 - totalHeight + lineHeight / 2
          : -totalHeight / 2 + lineHeight / 2
      : -totalHeight / 2 + lineHeight / 2;
  ctx.textAlign = textAlign;
  const lineX =
    Number.isFinite(boxWidth) && boxWidth > 0
      ? textAlign === 'left'
        ? -boxWidth / 2
        : textAlign === 'right'
          ? boxWidth / 2
          : 0
      : 0;
  lines.forEach((line, index) =>
    drawTrackedText(ctx, line, lineX, top + index * lineHeight, tracking, textAlign)
  );
}

export function layoutTextLines(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  value: string,
  width: number,
  wrap: string
): string[] {
  const paragraphs = value.split('\n');
  if (wrap === 'none' || !Number.isFinite(width)) return paragraphs;
  const output: string[] = [];
  for (const paragraph of paragraphs) {
    const tokens =
      wrap === 'char' ? Array.from(paragraph) : paragraph.split(/(\s+)/).filter(Boolean);
    let line = '';
    for (const token of tokens) {
      const candidate = line + token;
      if (line && ctx.measureText(candidate).width > width) {
        output.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = candidate;
      }
    }
    output.push(line);
  }
  return output.length ? output : [''];
}

/**
 * Draw text with custom tracking
 */
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  alignment: CanvasTextAlign = 'center'
): void {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return;
  }

  const chars = Array.from(text);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
  let cursor = alignment === 'left' ? x : alignment === 'right' ? x - total : x - total / 2;
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
  props: Record<string, unknown>,
  assets: Map<string, LoadedAsset>,
  elementsById: Map<string, EvaluatedElement>
): void {
  const parentId = String(props['parent'] ?? '');
  const parent = parentId ? elementsById.get(parentId) : undefined;
  if (parent && (parent.kind === 'image' || parent.kind === 'asset')) {
    drawImageOverlay(ctx, canvas, props, parentId, assets, elementsById);
    return;
  }

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
  drawStandaloneOverlay(ctx, canvas, props);
}

/**
 * Draw a freestanding overlay shape (rect/circle/ellipse/text/...) positioned
 * relative to canvas center, for UI-composition primitives (cards, buttons,
 * progress bars, badges) that aren't annotating an image.
 */
function drawStandaloneOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const x = Number(props['x'] ?? 0);
  const y = Number(props['y'] ?? 0);
  const scale = Number(props['scale'] ?? 1);
  const rotation = Number(props['rotation'] ?? 0);
  const shape = String(props['shape'] ?? 'rect');
  const cx = canvas.width / 2 + x;
  const cy = canvas.height / 2 + y;

  const shapeWidth = Number(props['width'] ?? 120);
  const shapeHeight = Number(props['height'] ?? 80);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  apply3DTilt(ctx, props, shapeWidth, shapeHeight);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  drawShadow(ctx, props);
  drawVectorPrimitive(ctx, shape, props, canvas.width, canvas.height, cx, cy);
  ctx.restore();
}

/**
 * Draw SVG-compatible primitives in the source image's pixel coordinate system.
 * The evaluator drives these properties, so preview and frame export share the
 * exact same timing instead of relying on browser-only SMIL/CSS animation.
 */
function drawImageOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>,
  parentId: string,
  assets: Map<string, LoadedAsset>,
  elementsById: Map<string, EvaluatedElement>
): void {
  const parent = elementsById.get(parentId);
  if (!parent || (parent.kind !== 'image' && parent.kind !== 'asset')) return;
  const parentProps = parent.render as unknown as Record<string, unknown>;
  const parentOpacity = Number(parentProps['opacity'] ?? 1);
  if (parentOpacity <= 0) return;
  const assetName = parent.assetName;
  const asset = assetName ? assets.get(assetName) : undefined;
  if (!asset || isLoadedAudio(asset)) return;

  const box = resolveBox(canvas, asset, parentProps);
  const referenceWidth = asset.width || box.width;
  const referenceHeight = asset.height || box.height;
  const parentRotation = Number(parentProps['rotation'] ?? 0);
  const parentScale = Number(parentProps['scale'] ?? 1);
  const parentOrigin = resolveOrigin(parentProps, box.width, box.height);

  ctx.save();
  ctx.translate(box.x + parentOrigin.x, box.y + parentOrigin.y);
  ctx.rotate((parentRotation * Math.PI) / 180);
  apply3DTilt(ctx, parentProps, box.width, box.height);
  applySkew(ctx, parentProps);
  ctx.scale(parentScale, parentScale);
  ctx.translate(-parentOrigin.x, -parentOrigin.y);
  ctx.scale(box.width / referenceWidth, box.height / referenceHeight);

  if (props['clip']) {
    ctx.beginPath();
    ctx.rect(0, 0, referenceWidth, referenceHeight);
    ctx.clip();
  }

  const x = Number(props['imageOverlayX'] ?? props['x'] ?? 0);
  const y = Number(props['imageOverlayY'] ?? props['y'] ?? 0);
  const scale = Number(props['imageOverlayScale'] ?? props['scale'] ?? 1);
  const rotation = Number(props['imageOverlayRotation'] ?? props['rotation'] ?? 0);
  const shape = String(props['shape'] ?? 'rect');
  const shapeWidth = Number(props['width'] ?? 120);
  const shapeHeight = Number(props['height'] ?? 80);
  ctx.translate(x, y);
  ctx.rotate((rotation * Math.PI) / 180);
  apply3DTilt(ctx, props, shapeWidth, shapeHeight);
  applySkew(ctx, props);
  ctx.scale(scale, scale);
  drawVectorPrimitive(ctx, shape, props, referenceWidth, referenceHeight, x, y);
  ctx.restore();
}

function drawVectorPrimitive(
  ctx: CanvasRenderingContext2D,
  shape: string,
  props: Record<string, unknown>,
  referenceWidth: number,
  referenceHeight: number,
  originX: number,
  originY: number
): void {
  const fill = String(props['fill'] ?? 'none');
  const stroke = String(props['stroke'] ?? 'none');
  const strokeWidth = Number(props['strokeWidth'] ?? 4);
  const width = Number(props['width'] ?? 120);
  const height = Number(props['height'] ?? 80);
  const radius = Number(props['radius'] ?? 48);
  const radiusX = Number(props['radiusX'] ?? radius);
  const radiusY = Number(props['radiusY'] ?? radius);
  const progress = Math.max(0, Math.min(1, Number(props['pathProgress'] ?? 1)));

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (fill !== 'none') ctx.fillStyle = vectorGradient(ctx, props, width, height) ?? fill;
  if (stroke !== 'none') ctx.strokeStyle = stroke;

  if (shape === 'text') {
    ctx.fillStyle = fill === 'none' ? String(props['color'] ?? '#fff') : fill;
    ctx.font = `${Number(props['weight'] ?? 700)} ${Number(props['size'] ?? 48)}px ${String(props['font'] ?? 'sans-serif')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(props['value'] ?? ''), 0, 0);
    return;
  }

  if (shape === 'arrow' || shape === 'line') {
    drawOverlayLine(ctx, props, progress, shape === 'arrow');
    return;
  }

  if (shape === 'spotlight') {
    const reveal = Math.max(0, Math.min(1, Number(props['revealProgress'] ?? 1)));
    const mask = new Path2D();
    mask.rect(-originX, -originY, referenceWidth, referenceHeight);
    mask.ellipse(0, 0, radiusX * reveal, radiusY * reveal, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill === 'none' ? 'rgba(0, 0, 0, 0.58)' : fill;
    ctx.fill(mask, 'evenodd');
    return;
  }

  const path = new Path2D();
  if (shape === 'circle') {
    path.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  } else if (shape === 'ellipse') {
    path.ellipse(0, 0, radiusX, radiusY, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  } else if (shape === 'path') {
    const d = String(props['path'] ?? '');
    if (!d) return;
    if (progress <= 0) return;
    const svgPath = new Path2D(d);
    const trimStart = Math.max(0, Math.min(progress, finiteNumber(props['trimStart'], 0)));
    if (fill !== 'none' && progress >= 1 && trimStart <= 0) ctx.fill(svgPath);
    if (stroke !== 'none') {
      const measure = motionPathElement(d);
      const length = (() => {
        try {
          return measure?.getTotalLength() ?? 0;
        } catch {
          return 0;
        }
      })();
      if (length > 0 && (progress < 1 || trimStart > 0)) {
        const segment = Math.max(0, progress - trimStart) * length;
        ctx.setLineDash([segment, Math.max(0.001, length - segment)]);
        ctx.lineDashOffset = -trimStart * length;
      }
      ctx.stroke(svgPath);
    }
    return;
  } else {
    const originX = finiteNumber(props['originX'], 0.5);
    const originY = finiteNumber(props['originY'], 0.5);
    const corner =
      props['radius'] !== undefined
        ? Math.max(0, Math.min(radius, Math.min(width, height) / 2))
        : 0;
    if (corner > 0 && typeof path.roundRect === 'function') {
      path.roundRect(-width * originX, -height * originY, width, height, corner);
    } else {
      path.rect(-width * originX, -height * originY, width, height);
    }
  }

  if (fill !== 'none' && progress >= 1) ctx.fill(path);
  if (stroke !== 'none') ctx.stroke(path);
}

function drawOverlayLine(
  ctx: CanvasRenderingContext2D,
  props: Record<string, unknown>,
  progress: number,
  arrow: boolean
): void {
  const x2 = Number(props['x2'] ?? 0);
  const y2 = Number(props['y2'] ?? 0);
  const endX = x2 * progress;
  const endY = y2 * progress;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  if (!arrow || progress < 0.92) return;

  const angle = Math.atan2(y2, x2);
  const head = Math.max(10, Number(props['strokeWidth'] ?? 4) * 3.5);
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - head * Math.cos(angle - Math.PI / 6),
    endY - head * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - head * Math.cos(angle + Math.PI / 6),
    endY - head * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function applySkew(ctx: CanvasRenderingContext2D, props: Record<string, unknown>): void {
  const x = Math.tan((((props['skewX'] as number) ?? 0) * Math.PI) / 180);
  const y = Math.tan((((props['skewY'] as number) ?? 0) * Math.PI) / 180);
  if (x || y) ctx.transform(1, y, x, 1, 0, 0);
}

/**
 * Resolve the rotation/scale anchor point for an element, in pixels relative
 * to its own top-left corner. `originXPixel`/`originYPixel` (absolute pixels)
 * override the normalized `originX`/`originY` fraction (0-1) when present.
 */
export function resolveOrigin(
  props: Record<string, unknown>,
  width: number,
  height: number
): { x: number; y: number } {
  const pixelX = props['originXPixel'];
  const pixelY = props['originYPixel'];
  const x =
    typeof pixelX === 'number' && Number.isFinite(pixelX)
      ? pixelX
      : width * finiteNumber(props['originX'], 0.5);
  const y =
    typeof pixelY === 'number' && Number.isFinite(pixelY)
      ? pixelY
      : height * finiteNumber(props['originY'], 0.5);
  return { x, y };
}

/**
 * Fake 3D tilt (rotationX/rotationY) in the flat 2D canvas context: the
 * tilted axis is foreshortened by its cosine, and a perspective-scaled skew
 * approximates the convergence a real projection matrix would produce.
 * `perspective` behaves like CSS `perspective` — smaller values exaggerate
 * the effect, larger values flatten it. `width`/`height` are optional; pass
 * the element's box size for the skew term, or omit for pure axis scaling.
 */
export function apply3DTilt(
  ctx: CanvasRenderingContext2D,
  props: Record<string, unknown>,
  width = 0,
  height = 0
): void {
  const rotationX = finiteNumber(props['rotationX'], 0);
  const rotationY = finiteNumber(props['rotationY'], 0);
  if (!rotationX && !rotationY) return;

  const perspective = Math.max(1, finiteNumber(props['perspective'], 800));
  const radX = (rotationX * Math.PI) / 180;
  const radY = (rotationY * Math.PI) / 180;

  const scaleY = Math.max(0.02, Math.cos(radX));
  const scaleX = Math.max(0.02, Math.cos(radY));
  const skewFromX = (Math.sin(radX) * height) / 2 / perspective;
  const skewFromY = (Math.sin(radY) * width) / 2 / perspective;

  ctx.transform(scaleX, skewFromX, skewFromY, scaleY, 0, 0);
}

function clipReveal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  props: Record<string, unknown>,
  x = -width / 2,
  y = -height / 2
): void {
  const progress = props['revealProgress'];
  if (typeof progress !== 'number') return;
  const value = Math.max(0, Math.min(1, progress));
  const direction = String(props['revealDirection'] ?? 'right');
  ctx.beginPath();
  if (direction === 'left') ctx.rect(x + width - width * value, y, width * value, height);
  else if (direction === 'up') ctx.rect(x, y + height - height * value, width, height * value);
  else if (direction === 'down') ctx.rect(x, y, width, height * value);
  else ctx.rect(x, y, width * value, height);
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
  const effect = canonicalEffectName(String(props['effect'] ?? 'gradientMotion'));

  if (effect === 'noise') {
    drawNoise(ctx, canvas, props);
    return;
  }

  if (effect === 'grain') {
    drawNoise(ctx, canvas, props);
    return;
  }

  if (effect === 'grid' || effect === 'mesh') {
    drawGrid(ctx, canvas, props);
    return;
  }

  if (effect === 'gridFade') {
    drawGrid(ctx, canvas, props);
    drawVignette(ctx, canvas, { ...props, intensity: Number(props['intensity'] ?? 1) * 0.55 });
    return;
  }

  if (effect === 'vignette' || effect === 'edgeFade') {
    drawVignette(ctx, canvas, props);
    return;
  }

  if (effect === 'glass' || effect === 'card' || effect === 'deviceFrame') {
    drawSurfaceEffect(ctx, canvas, props, effect);
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

  if (effect === 'particles') {
    drawParticles(ctx, canvas, props);
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
  const palette = gradientPalette(effect, props);

  gradient.addColorStop(0, palette[0]!);
  gradient.addColorStop(0.42, palette[1]!);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Get gradient color palette
 */
function gradientPalette(effect: string, props: Record<string, unknown>): [string, string] {
  const from = props['gradientFrom'];
  const to = props['gradientTo'];
  if (from && to) return [String(from), String(to)];
  if (effect === 'aurora') return ['rgba(124, 247, 197, 0.32)', 'rgba(138, 180, 255, 0.2)'];
  if (effect === 'codeGlow') return ['rgba(88, 101, 242, 0.3)', 'rgba(124, 247, 197, 0.14)'];
  if (effect === 'heroGlow') return ['rgba(255, 255, 255, 0.18)', 'rgba(138, 180, 255, 0.18)'];
  return ['rgba(124, 247, 197, 0.34)', 'rgba(138, 180, 255, 0.2)'];
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const intensity = bounded(props['intensity'], 0.6, 0, 1);
  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.16,
    canvas.width / 2,
    canvas.height / 2,
    Math.hypot(canvas.width, canvas.height) * 0.58
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.68, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${0.82 * intensity})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSurfaceEffect(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>,
  effect: string
): void {
  const width = bounded(props['width'], 760, 1, canvas.width * 2);
  const height = bounded(props['height'], 420, 1, canvas.height * 2);
  const x = canvas.width / 2 + finiteNumber(props['x'], 0) - width / 2;
  const y = canvas.height / 2 + finiteNumber(props['y'], 0) - height / 2;
  const radius = bounded(
    props['radius'],
    effect === 'deviceFrame' ? 34 : 24,
    0,
    Math.min(width, height) / 2
  );
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = String(
    props['fill'] ??
      (effect === 'glass' ? 'rgba(255,255,255,.1)' : (props['gradientFrom'] ?? '#12161D'))
  );
  ctx.fill();
  ctx.strokeStyle = String(props['stroke'] ?? props['gradientTo'] ?? 'rgba(255,255,255,.16)');
  ctx.lineWidth = bounded(props['strokeWidth'], effect === 'deviceFrame' ? 8 : 1.5, 0, 40);
  ctx.stroke();
}

/** Deterministic bounded particle field driven by the normal animated offset. */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  canvas: Canvas,
  props: Record<string, unknown>
): void {
  const count = Math.round(bounded(props['particleCount'], 42, 1, 240));
  const size = bounded(props['particleSize'], 3, 0.5, 20);
  const intensity = bounded(props['intensity'], 1, 0, 4);
  const offset = finiteNumber(props['offset'], 0);
  const color = String(props['color'] ?? props['fill'] ?? '#8ab4ff');
  ctx.fillStyle = color;
  const baseAlpha = ctx.globalAlpha;

  for (let index = 0; index < count; index += 1) {
    const seedX = hash(index * 17 + 11, 0, 0);
    const seedY = hash(index * 31 + 7, 0, 0);
    const phase = (offset * (0.18 + hash(index * 13, 0, 0) * 0.42) + seedY) % 1;
    const x = seedX * canvas.width + Math.sin((phase + seedX) * Math.PI * 2) * 22;
    const y = canvas.height * (1 - phase);
    const radius = size * (0.45 + hash(index * 47 + 3, 0, 0) * 0.8);
    const alpha = Math.min(1, intensity * (0.2 + (1 - Math.abs(phase - 0.5) * 2) * 0.65));
    ctx.globalAlpha = baseAlpha * alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = baseAlpha;
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
  const transform = ctx.getTransform();
  const previewScale = Math.max(0.05, Math.hypot(transform.a, transform.b));
  const step = Math.max(6, Math.round(6 / previewScale));
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
  asset: DrawableAsset,
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

    const focalX = bounded(props['focalX'], 0.5, 0, 1);
    const focalY = bounded(props['focalY'], 0.5, 0, 1);
    return {
      x: (canvas.width - width) * focalX + propX,
      y: (canvas.height - height) * focalY + propY,
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

function isBlendMode(value: string): value is GlobalCompositeOperation {
  return new Set([
    'source-over',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
  ]).has(value);
}

/**
 * Build CSS filter string
 */
function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bounded(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

/** Build the deterministic Canvas 2D filter string for an evaluated element. */
export function buildCanvasFilter(props: Record<string, unknown>): string {
  const filters: string[] = [];
  const blur = bounded(props['blur'], 0, 0, 100);
  const brightness = bounded(props['brightness'], 1, 0, 10);
  const contrast = bounded(props['contrast'], 1, 0, 10);
  const saturation = bounded(props['saturation'], 1, 0, 10);
  const hue = finiteNumber(props['hue'], 0);
  const grayscale = bounded(props['grayscale'], 0, 0, 1);
  const sepia = bounded(props['sepia'], 0, 0, 1);
  const invert = bounded(props['invert'], 0, 0, 1);

  if (blur !== 0) filters.push(`blur(${blur}px)`);
  if (brightness !== 1) filters.push(`brightness(${brightness})`);
  if (contrast !== 1) filters.push(`contrast(${contrast})`);
  if (saturation !== 1) filters.push(`saturate(${saturation})`);
  if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
  if (grayscale !== 0) filters.push(`grayscale(${grayscale})`);
  if (sepia !== 0) filters.push(`sepia(${sepia})`);
  if (invert !== 0) filters.push(`invert(${invert})`);

  return filters.length ? filters.join(' ') : 'none';
}

/**
 * Apply shadow to context
 */
function drawShadow(ctx: CanvasRenderingContext2D, props: Record<string, unknown>): void {
  const glow = finiteNumber(props['glow'], 0);
  const shadow = finiteNumber(props['shadow'], 0);

  if (glow > 0) {
    ctx.shadowColor = String(props['glowColor'] ?? props['color'] ?? props['stroke'] ?? '#8ab4ff');
    ctx.shadowBlur = glow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }

  if (!shadow) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    return;
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = shadow;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = shadow / 3;
}
