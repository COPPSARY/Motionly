import type { AnimationNode, ElementNode, KeyframeNode } from '../types/parser';
import {
  REACTBITS_COMPONENT_ALIASES,
  type BaseSemanticComponentType,
  type SemanticComponentType,
} from './vector-registry';
import { DEFAULT_THEME, type MotionTheme } from './catalog';
import { MOTION_BUDGET } from '../motion-system/budget';
import { ARRIVAL } from '../motion-system/layout';

/**
 * Structured visual builders for semantic components.
 *
 * Each component compiles into a group root plus real vector children —
 * frames, toolbars, cards, labels, charts, code lines — with a staggered
 * entrance choreography, so generated scenes contain recognizable structured
 * artwork instead of a lone icon or an empty rectangle. Everything emitted
 * here is an ordinary editable element that flows through the normal parser,
 * scene graph, evaluator, and renderer.
 */

export interface StructureContext {
  name: string;
  type: SemanticComponentType;
  /** Authored root position — root-level animations must stay relative to it. */
  x: number;
  y: number;
  width: number;
  color: string;
  accent: string;
  surface: string;
  theme: MotionTheme;
  delay: number;
  duration: number;
  role: 'main' | 'supporting' | 'connection' | 'background';
  layer: string;
  behaviors: string[];
  iconAlias: string;
  style: 'filled' | 'outline';
  strokeWidth: number;
  label?: string;
  detail?: string;
  headline?: string;
  url?: string;
  cta?: string;
  values?: string[];
  labels?: string[];
  countTo?: number;
  variant?: string;
  motionPreset?: string;
  clickAt?: number;
  exitAt?: number;
  exitDuration: number;
}

export interface ComponentStructure {
  children: ElementNode[];
  animations: AnimationNode[];
  childIds: string[];
  /** Element id idle glow/pulse behaviors should target instead of the group root. */
  glowTargetId: string;
}

const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const RAISED = '#1A2029';
const EDGE = '#2A313C';
const MUTED_TEXT = '#8B94A1';
const BRIGHT_TEXT = '#EDF0F4';
/** Design tokens shared by every structured component. */
const DISPLAY_FONT = "'Space Grotesk', Inter, sans-serif";

type Props = Record<string, unknown>;

interface Builder {
  children: ElementNode[];
  animations: AnimationNode[];
  add(kind: ElementNode['kind'], suffix: string, properties: Props): string;
  enter(
    target: string,
    at: number,
    duration: number,
    from: Props,
    to: Props,
    easing?: string
  ): void;
  key(
    target: string,
    at: number,
    duration: number,
    frames: KeyframeNode[],
    easing?: string,
    repeat?: 'infinite',
    repeatType?: 'loop' | 'yoyo'
  ): void;
}

function createBuilder(ctx: StructureContext): Builder {
  const children: ElementNode[] = [];
  const animations: AnimationNode[] = [];
  return {
    children,
    animations,
    add(kind, suffix, properties) {
      const name = `${ctx.name}__${suffix}`;
      const typography = kind === 'text' && !properties['font'] ? { font: DISPLAY_FONT } : {};
      children.push({
        type: 'Element',
        kind,
        name,
        properties: { parent: ctx.name, layer: ctx.layer, ...typography, ...properties },
      });
      return name;
    },
    enter(target, at, duration, from, to, easing = 'power3.out') {
      animations.push({
        type: 'Animation',
        target,
        from,
        to,
        keyframes: [],
        delay: ctx.delay + at,
        duration,
        easing,
      });
    },
    key(target, at, duration, frames, easing = 'power3.out', repeat, repeatType) {
      animations.push({
        type: 'Animation',
        target,
        from: {},
        to: {},
        keyframes: frames,
        delay: ctx.delay + at,
        duration,
        easing,
        ...(repeat ? { repeat } : {}),
        ...(repeatType ? { repeatType } : {}),
      });
    },
  };
}

function frame(offset: number, properties: Props): KeyframeNode {
  return { offset, properties };
}

const fadeUp = (
  b: Builder,
  target: string,
  at: number,
  duration: number,
  rise: number,
  baseY: number,
  extra: Props = {}
) =>
  b.enter(
    target,
    at,
    duration,
    { opacity: 0, y: baseY + rise, ...extra },
    {
      opacity: 1,
      y: baseY,
      ...Object.fromEntries(Object.keys(extra).map((key) => [key, resetOf(key)])),
    }
  );

function resetOf(key: string): number {
  if (key === 'scale') return 1;
  return 0;
}

const pop = (b: Builder, target: string, at: number, duration: number, fromScale = 0.82) =>
  b.enter(
    target,
    at,
    duration,
    { opacity: 0, scale: fromScale },
    { opacity: 1, scale: 1 },
    'back.out'
  );

/** Grow a rect upward from its baseline by animating height and re-centering y. */
function growBar(
  b: Builder,
  target: string,
  at: number,
  duration: number,
  baseline: number,
  height: number
): void {
  b.key(
    target,
    at,
    duration,
    [
      frame(0, { opacity: 0, height: 2, y: baseline - 1 }),
      frame(0.12, { opacity: 1 }),
      frame(1, { opacity: 1, height, y: baseline - height / 2 }),
    ],
    'power3.out'
  );
}

export function buildComponentStructure(ctx: StructureContext): ComponentStructure {
  const b = createBuilder(ctx);
  const glowTargetId = BUILDERS[ctx.type](ctx, b);
  applyThemePalette(b.children, ctx.theme);

  if (ctx.exitAt !== undefined) {
    b.animations.push({
      type: 'Animation',
      target: ctx.name,
      from: { opacity: 1, y: ctx.y },
      to: { opacity: 0, y: ctx.y - 26 },
      keyframes: [],
      delay: ctx.exitAt,
      duration: ctx.exitDuration,
      easing: 'power2.in',
    });
  }
  applyThemeMotion(b.animations, ctx);

  return {
    children: b.children,
    animations: b.animations,
    childIds: b.children.map((child) => child.name),
    glowTargetId,
  };
}

function applyThemeMotion(animations: AnimationNode[], ctx: StructureContext): void {
  const durationScale = ctx.theme.duration / DEFAULT_THEME.duration;
  const staggerScale = ctx.theme.stagger / DEFAULT_THEME.stagger;
  const preset = {
    minimal: { easing: 'power3.out', duration: 0.82 },
    smooth: { easing: 'power4.out', duration: 1 },
    spring: { easing: 'back.out(1.6)', duration: 1 },
    premium: { easing: 'power4.out', duration: 0.92 },
  }[ctx.motionPreset ?? ''];
  for (const animation of animations) {
    animation.duration = timeNumber(animation.duration) * durationScale;
    // Doctrine: one entrance is at most MOTION_BUDGET.maxEntry. Clamping here
    // covers every builder at once — a longer buildup is a staggered group, not
    // a single slow part.
    if (animation.repeat === undefined && isEntranceAnimation(animation)) {
      if (preset) {
        animation.easing = preset.easing;
        animation.duration *= preset.duration;
      }
      animation.duration = Math.min(animation.duration, MOTION_BUDGET.maxEntry);
    }
    const delay = timeNumber(animation.delay);
    if (delay >= ctx.delay && delay < ctx.delay + 20) {
      animation.delay = ctx.delay + (delay - ctx.delay) * staggerScale;
    }
    if (animation.easing === DEFAULT_THEME.easing) animation.easing = ctx.theme.easing;
  }
  retimeInternalCascade(animations, ctx);
  snapArrivalOpacity(animations);
}

/**
 * Keep arrivals hidden until their cue, then reveal them on the next sampled
 * frame while movement carries the entrance.
 */
function snapArrivalOpacity(animations: AnimationNode[]): void {
  const rewritten: AnimationNode[] = [];
  for (const animation of animations) {
    const opacityFrames = (animation.keyframes ?? [])
      .filter((keyframe) => keyframe.properties['opacity'] !== undefined)
      .map((keyframe) => Number(keyframe.properties['opacity']));
    const fromOpacity = opacityFrames[0] ?? Number(animation.from?.['opacity']);
    const toOpacity = opacityFrames.at(-1) ?? Number(animation.to?.['opacity']);

    if (
      animation.repeat === undefined &&
      Number.isFinite(fromOpacity) &&
      fromOpacity < 1 &&
      Number.isFinite(toOpacity) &&
      toOpacity >= 1
    ) {
      delete animation.from?.['opacity'];
      delete animation.to?.['opacity'];
      for (const keyframe of animation.keyframes ?? []) delete keyframe.properties['opacity'];
      rewritten.push(animation, {
        type: 'Animation',
        target: animation.target,
        from: { opacity: fromOpacity },
        to: { opacity: toOpacity },
        keyframes: [],
        delay: animation.delay,
        duration: 0.001,
        easing: 'linear',
      });
      continue;
    }
    rewritten.push(animation);
  }
  animations.splice(0, animations.length, ...rewritten);
}

/**
 * Retime a component's own entrance cascade.
 *
 * Builders author part offsets by hand, which produces evenly spaced gaps — a
 * queue. This rewrites those offsets as one accelerating wave that lands inside
 * a single beat, preserving the authored order and any simultaneous parts, so
 * every component gains correct choreography without touching 18 builders.
 */
function retimeInternalCascade(animations: AnimationNode[], ctx: StructureContext): void {
  const entrances = animations.filter(
    (animation) => animation.repeat === undefined && isEntranceAnimation(animation)
  );
  if (entrances.length < 3) return;

  // Distinct authored offsets keep their order; parts sharing an offset stay together.
  const offsets = [...new Set(entrances.map((animation) => timeNumber(animation.delay)))].sort(
    (left, right) => left - right
  );
  if (offsets.length < 3) return;

  const stagger = ctx.theme.stagger;
  const gaps = offsets.slice(1).map((_, step) => stagger * ARRIVAL.gapDecay ** step);
  const window = gaps.reduce((total, gap) => total + gap, 0);
  const scale = window > ARRIVAL.maxStaggerWindow ? ARRIVAL.maxStaggerWindow / window : 1;
  const retimed = new Map<number, number>();
  let cursor = offsets[0]!;
  retimed.set(offsets[0]!, cursor);
  for (const [index, gap] of gaps.entries()) {
    cursor += gap * scale;
    retimed.set(offsets[index + 1]!, Number(cursor.toFixed(4)));
  }

  for (const animation of entrances) {
    const next = retimed.get(timeNumber(animation.delay));
    if (next !== undefined) animation.delay = next;
  }
}

/** An entrance starts below full opacity, whether authored as from or keyframes. */
function isEntranceAnimation(animation: AnimationNode): boolean {
  const start = animation.keyframes?.length
    ? animation.keyframes[0]!.properties
    : (animation.from ?? {});
  return start['opacity'] !== undefined && Number(start['opacity']) < 1;
}

function timeNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Map the old component palette onto the active theme without changing legacy source files. */
function applyThemePalette(children: ElementNode[], theme: MotionTheme): void {
  const activeThemeColors = new Set(
    [
      theme.background,
      theme.surface,
      theme.raised,
      theme.text,
      theme.muted,
      theme.accent,
      theme.secondary,
      theme.positive,
      theme.warning,
      theme.negative,
      theme.ink,
      theme.edge,
    ].map((color) => color.toUpperCase())
  );
  const colors: Record<string, string> = {
    '#12161D': theme.surface,
    '#1A2029': theme.raised,
    '#1B212C': theme.raised,
    '#242B38': theme.surface,
    '#2A313C': theme.edge,
    '#1C2334': theme.edge,
    '#39424E': theme.muted,
    '#4A5563': theme.muted,
    '#55555E': theme.muted,
    '#8B94A1': theme.muted,
    '#EDF0F4': theme.text,
    '#F5F6F8': theme.text,
    '#FFFFFF': theme.text,
    '#7CF7C5': theme.accent,
    '#57D98B': theme.positive,
    '#28C840': theme.positive,
    '#FEBC2E': theme.warning,
    '#FF5F57': theme.negative,
    '#5B8DEF': theme.secondary,
    '#7C6CFF': theme.secondary,
    '#3E8BFF': theme.secondary,
    '#0A0E1B': theme.ink,
    '#0A0E19': theme.ink,
    '#0B0D10': theme.ink,
    '#0B0D11': theme.background,
    '#080B12': theme.background,
    '#10141B': theme.background,
    '#151A22': theme.raised,
    '#181611': theme.text,
    '#8D867D': theme.muted,
    '#F4F1EB': theme.surface,
  };
  for (const child of children) {
    for (const [key, value] of Object.entries(child.properties)) {
      if (key === 'radius' && typeof value === 'number') {
        child.properties[key] = value * (theme.radius / DEFAULT_THEME.radius);
      }
      if (key === 'shadow' && typeof value === 'number') {
        child.properties[key] = value * (theme.shadow / DEFAULT_THEME.shadow);
      }
      if (key === 'size' && typeof value === 'number') {
        child.properties[key] = value * (theme.bodySize / DEFAULT_THEME.bodySize);
      }
      if (key === 'weight' && typeof value === 'number') {
        child.properties[key] = value >= 650 ? theme.weightBold : theme.weightRegular;
      }
      if (typeof value !== 'string') continue;
      const normalized = value.toUpperCase();
      const themed = activeThemeColors.has(normalized) ? undefined : colors[normalized];
      if (themed) child.properties[key] = themed;
      if (key === 'font' && value.includes('Space Grotesk'))
        child.properties[key] = theme.displayFont;
      if (key === 'font' && value.includes('ui-monospace')) child.properties[key] = theme.monoFont;
    }
  }
}

type StructureBuilder = (ctx: StructureContext, b: Builder) => string;

/** Shared glyph treatment: halo + provider icon + optional caption label. */
function glyphStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  if (ctx.role === 'main') {
    const halo = b.add('overlay', 'halo', {
      shape: 'circle',
      radius: W * 0.62,
      fill: '#151A22',
      glow: 0,
      glowColor: ctx.accent,
      opacity: 0,
    });
    b.enter(halo, 0, ctx.duration * 1.1, { opacity: 0, scale: 0.6 }, { opacity: 0.9, scale: 1 });
  }
  const glyph = b.add('image', 'glyph', {
    source: ctx.iconAlias,
    width: W,
    center: true,
    fill: ctx.style === 'filled' ? ctx.color : 'none',
    stroke: ctx.style === 'outline' ? ctx.color : 'none',
    strokeWidth: ctx.strokeWidth,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
    ...(ctx.behaviors.includes('draw') || ctx.type === 'arrow' || ctx.type === 'logo'
      ? {
          animation: `drawSVG(delay ${seconds(ctx.delay + 0.1)} duration ${seconds(Math.max(0.7, ctx.duration))} ease power2.inOut)`,
        }
      : {}),
  });
  if (!(ctx.behaviors.includes('draw') || ctx.type === 'arrow' || ctx.type === 'logo')) {
    b.enter(
      glyph,
      0.08,
      ctx.duration,
      { opacity: 0, y: 22, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1 }
    );
  }
  if (ctx.type === 'server' || ctx.type === 'database') {
    const ledA = b.add('overlay', 'ledA', {
      shape: 'circle',
      x: W * 0.34,
      y: W * 0.4,
      radius: Math.max(4, W * 0.03),
      fill: '#57D98B',
      glow: 0,
      glowColor: '#57D98B',
      opacity: 0,
    });
    const ledB = b.add('overlay', 'ledB', {
      shape: 'circle',
      x: W * 0.44,
      y: W * 0.4,
      radius: Math.max(4, W * 0.03),
      fill: ctx.accent,
      glow: 0,
      glowColor: ctx.accent,
      opacity: 0,
    });
    pop(b, ledA, ctx.duration + 0.1, 0.4);
    pop(b, ledB, ctx.duration + 0.22, 0.4);
    b.key(
      ledB,
      ctx.duration + 0.7,
      1.6,
      [frame(0, { opacity: 1 }), frame(0.5, { opacity: 0.35 }), frame(1, { opacity: 1 })],
      'sine.inOut',
      'infinite',
      'loop'
    );
  }
  if (ctx.label) {
    const caption = b.add('text', 'label', {
      value: ctx.label,
      center: true,
      y: W * 0.62,
      width: W * 1.6,
      height: 44,
      textAlign: 'center',
      verticalAlign: 'middle',
      size: Math.max(18, W * 0.11),
      weight: 560,
      tracking: 1,
      color: MUTED_TEXT,
      opacity: 0,
      layer: 'text',
    });
    fadeUp(b, caption, ctx.duration * 0.7, 0.55, 18, W * 0.62);
  }
  return glyph;
}

function dashboardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.66;
  const radius = W * 0.045;
  const pad = W * 0.055;
  const values = ctx.values ?? ['$84.9k', '12,480', '99.98%'];
  const labels = ctx.labels ?? ['Revenue', 'Active users', 'Uptime'];

  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 34, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const title = b.add('text', 'title', {
    value: ctx.label ?? 'Overview',
    center: true,
    x: -W / 2 + pad + W * 0.14,
    y: -H / 2 + H * 0.11,
    width: W * 0.28,
    height: H * 0.1,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(15, W * 0.034),
    weight: 660,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, title, 0.16, 0.5, 12, -H / 2 + H * 0.11);

  const live = b.add('overlay', 'live', {
    shape: 'circle',
    x: W / 2 - pad,
    y: -H / 2 + H * 0.11,
    radius: Math.max(4, W * 0.011),
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  pop(b, live, 0.3, 0.4);
  b.key(
    live,
    0.9,
    1.8,
    [frame(0, { opacity: 1 }), frame(0.5, { opacity: 0.4 }), frame(1, { opacity: 1 })],
    'sine.inOut',
    'infinite',
    'loop'
  );

  const cardW = W * 0.283;
  const cardH = H * 0.28;
  const cardY = -H * 0.09;
  [-1, 0, 1].forEach((slot, index) => {
    const x = slot * (cardW + pad * 0.55);
    const card = b.add('overlay', `card${index}`, {
      shape: 'rect',
      x,
      y: cardY,
      width: cardW,
      height: cardH,
      radius: radius * 0.7,
      fill: RAISED,
      stroke: EDGE,
      strokeWidth: 1.5,
      opacity: 0,
    });
    b.enter(
      card,
      0.3 + index * 0.12,
      0.6,
      { opacity: 0, y: cardY + 22, scale: 0.94 },
      { opacity: 1, y: cardY, scale: 1 }
    );
    const value = b.add('text', `value${index}`, {
      value: values[index] ?? '',
      center: true,
      x,
      y: cardY - cardH * 0.14,
      width: cardW * 0.82,
      height: cardH * 0.4,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(16, W * 0.038),
      weight: 700,
      color: BRIGHT_TEXT,
      opacity: 0,
      layer: 'text',
    });
    const caption = b.add('text', `caption${index}`, {
      value: labels[index] ?? '',
      center: true,
      x,
      y: cardY + cardH * 0.22,
      width: cardW * 0.82,
      height: cardH * 0.3,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(12, W * 0.024),
      weight: 520,
      color: MUTED_TEXT,
      opacity: 0,
      layer: 'text',
    });
    fadeUp(b, value, 0.42 + index * 0.12, 0.5, 10, cardY - cardH * 0.14);
    fadeUp(b, caption, 0.5 + index * 0.12, 0.5, 8, cardY + cardH * 0.22);
  });

  const chartTop = H * 0.12;
  const chartBottom = H / 2 - pad;
  const chartLeft = -W / 2 + pad;
  const chartRight = W / 2 - pad;
  const baselineY = chartBottom;
  const axis = b.add('overlay', 'axis', {
    shape: 'line',
    x: chartLeft,
    y: baselineY,
    x2: chartRight - chartLeft,
    y2: 0,
    stroke: EDGE,
    strokeWidth: 2,
    fill: 'none',
    opacity: 0,
  });
  b.enter(axis, 0.62, 0.5, { opacity: 0 }, { opacity: 1 });

  const span = chartRight - chartLeft;
  const points = [0.06, 0.2, 0.34, 0.48, 0.62, 0.76, 0.92];
  const heights = [0.24, 0.5, 0.36, 0.66, 0.5, 0.82, 0.98];
  const lineD = points
    .map((position, index) => {
      const x = chartLeft + span * position;
      const y = baselineY - (chartBottom - chartTop) * (heights[index] ?? 0.4) * 0.86;
      return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
    })
    .join(' ');
  const line = b.add('path', 'chartline', {
    d: lineD,
    fill: 'none',
    stroke: ctx.accent,
    strokeWidth: Math.max(3, W * 0.008),
    pathProgress: 0,
    opacity: 0,
    glow: 0,
    glowColor: ctx.accent,
  });
  b.enter(
    line,
    0.78,
    1.1,
    { opacity: 0, pathProgress: 0 },
    { opacity: 1, pathProgress: 1 },
    'power2.inOut'
  );
  const tip = b.add('overlay', 'chartTip', {
    shape: 'circle',
    x: chartLeft + span * 0.92,
    y: baselineY - (chartBottom - chartTop) * 0.98 * 0.86,
    radius: Math.max(4, W * 0.012),
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  pop(b, tip, 1.82, 0.4);
  return shell;
}

function browserStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.66;
  const radius = W * 0.032;
  const barH = H * 0.135;
  const barY = -H / 2 + barH / 2;

  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 36, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const toolbar = b.add('overlay', 'toolbar', {
    shape: 'rect',
    y: barY,
    width: W,
    height: barH,
    radius,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(toolbar, 0.14, 0.5, { opacity: 0, y: barY - 12 }, { opacity: 1, y: barY });

  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((dotColor, index) => {
    const dot = b.add('overlay', `dot${index}`, {
      shape: 'circle',
      x: -W / 2 + W * 0.045 + index * W * 0.032,
      y: barY,
      radius: Math.max(3.5, W * 0.009),
      fill: dotColor,
      opacity: 0,
    });
    pop(b, dot, 0.24 + index * 0.07, 0.35);
  });

  const address = b.add('overlay', 'address', {
    shape: 'rect',
    x: W * 0.05,
    y: barY,
    width: W * 0.56,
    height: barH * 0.56,
    radius: barH * 0.28,
    fill: '#10141B',
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(address, 0.34, 0.45, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 });
  const url = b.add('text', 'url', {
    value: ctx.url ?? 'yourproduct.com',
    center: true,
    x: W * 0.05,
    y: barY,
    width: W * 0.5,
    height: barH * 0.56,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.021),
    weight: 520,
    font: MONO_FONT,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(url, 0.46, 0.4, { opacity: 0 }, { opacity: 1 });

  const contentTop = barY + barH / 2;
  const headlineY = contentTop + H * 0.24;
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Ship your idea',
    center: true,
    y: headlineY,
    width: W * 0.78,
    height: H * 0.18,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(22, W * 0.052),
    weight: 700,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, headline, 0.52, 0.6, 20, headlineY);

  [0.46, 0.32].forEach((widthFactor, index) => {
    const y = headlineY + H * 0.145 + index * H * 0.062;
    const dash = b.add('overlay', `line${index}`, {
      shape: 'rect',
      y,
      width: W * widthFactor,
      height: Math.max(5, H * 0.02),
      radius: Math.max(2.5, H * 0.01),
      fill: '#39424E',
      opacity: 0,
    });
    b.enter(
      dash,
      0.66 + index * 0.1,
      0.5,
      { opacity: 0, width: W * widthFactor * 0.4 },
      { opacity: 1, width: W * widthFactor }
    );
  });

  const ctaY = headlineY + H * 0.32;
  const ctaW = W * 0.2;
  const ctaH = H * 0.085;
  const cta = b.add('overlay', 'cta', {
    shape: 'rect',
    y: ctaY,
    width: ctaW,
    height: ctaH,
    radius: ctaH / 2,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  pop(b, cta, 0.9, 0.5);
  const ctaLabel = b.add('text', 'ctaLabel', {
    value: ctx.cta ?? 'Get started',
    center: true,
    y: ctaY,
    width: ctaW,
    height: ctaH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.02),
    weight: 640,
    color: '#0B0D10',
    opacity: 0,
    layer: 'text',
  });
  b.enter(ctaLabel, 1.02, 0.35, { opacity: 0 }, { opacity: 1 });
  return shell;
}

function buttonStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.3;
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: H / 2,
    fill: ctx.color,
    gradientFrom: ctx.color,
    gradientTo: ctx.accent,
    gradientAngle: 24,
    glow: 0,
    shadow: 18,
    opacity: 0,
  });
  pop(b, surface, 0, Math.max(0.5, ctx.duration * 0.7), 0.72);
  const label = b.add('text', 'label', {
    value: ctx.label ?? 'Get started',
    center: true,
    width: W * 0.9,
    height: H * 0.8,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(15, W * 0.1),
    weight: 660,
    color: '#FFFFFF',
    opacity: 0,
    layer: 'text',
  });
  b.enter(label, 0.16, 0.4, { opacity: 0, y: 8 }, { opacity: 1, y: 0 });

  if (ctx.clickAt !== undefined) {
    const at = ctx.clickAt - ctx.delay;
    b.key(
      ctx.name,
      at,
      0.36,
      [
        frame(0, { scale: 1 }),
        frame(0.4, { scale: 0.93 }),
        frame(0.75, { scale: 1.03 }),
        frame(1, { scale: 1 }),
      ],
      'power2.inOut'
    );
    const ripple = b.add('overlay', 'ripple', {
      shape: 'circle',
      radius: H * 0.7,
      fill: 'none',
      stroke: ctx.accent,
      strokeWidth: 3,
      opacity: 0,
      glow: 0,
    });
    b.key(
      ripple,
      at + 0.08,
      0.55,
      [
        frame(0, { opacity: 0, scale: 0.5 }),
        frame(0.01, { opacity: 0.85, scale: 0.5 }),
        frame(1, { opacity: 0, scale: 1.9 }),
      ],
      'power2.out'
    );
  }
  return surface;
}

function phoneStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 2.02;
  const radius = W * 0.16;
  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: '#0B0D11',
    stroke: EDGE,
    strokeWidth: Math.max(4, W * 0.02),
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 44, scale: 0.93 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const screen = b.add('overlay', 'screen', {
    shape: 'rect',
    width: W * 0.88,
    height: H * 0.94,
    radius: radius * 0.72,
    fill: ctx.surface,
    opacity: 0,
  });
  b.enter(screen, 0.16, 0.55, { opacity: 0 }, { opacity: 1 });
  const notch = b.add('overlay', 'notch', {
    shape: 'rect',
    y: -H * 0.43,
    width: W * 0.3,
    height: H * 0.022,
    radius: H * 0.011,
    fill: '#0B0D11',
    opacity: 0,
  });
  b.enter(notch, 0.24, 0.35, { opacity: 0 }, { opacity: 1 });
  const appTitle = b.add('text', 'title', {
    value: ctx.label ?? 'Inbox',
    center: true,
    y: -H * 0.34,
    width: W * 0.7,
    height: H * 0.06,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(15, W * 0.075),
    weight: 680,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, appTitle, 0.34, 0.5, 12, -H * 0.34);
  [0, 1, 2].forEach((index) => {
    const y = -H * 0.22 + index * H * 0.135;
    const card = b.add('overlay', `row${index}`, {
      shape: 'rect',
      y,
      width: W * 0.76,
      height: H * 0.1,
      radius: radius * 0.4,
      fill: RAISED,
      stroke: EDGE,
      strokeWidth: 1,
      opacity: 0,
    });
    b.enter(
      card,
      0.46 + index * 0.12,
      0.5,
      { opacity: 0, y: y + 16, scale: 0.95 },
      { opacity: 1, y, scale: 1 }
    );
    const dot = b.add('overlay', `rowDot${index}`, {
      shape: 'circle',
      x: -W * 0.28,
      y,
      radius: Math.max(4, W * 0.032),
      fill: index === 0 ? ctx.accent : '#39424E',
      opacity: 0,
    });
    pop(b, dot, 0.56 + index * 0.12, 0.35);
    const dash = b.add('overlay', `rowLine${index}`, {
      shape: 'rect',
      x: W * 0.045,
      y,
      width: W * 0.5,
      height: Math.max(4, H * 0.008),
      radius: 2,
      fill: '#39424E',
      opacity: 0,
    });
    b.enter(
      dash,
      0.62 + index * 0.12,
      0.4,
      { opacity: 0, width: W * 0.2 },
      { opacity: 1, width: W * 0.5 }
    );
  });
  return shell;
}

function chartStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.62;
  const pad = W * 0.06;
  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.04,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 26,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 30, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const total = b.add('text', 'total', {
    value: ctx.countTo ?? 12480,
    center: true,
    x: -W / 2 + pad + W * 0.17,
    y: -H / 2 + H * 0.16,
    width: W * 0.34,
    height: H * 0.16,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(22, W * 0.062),
    weight: 720,
    color: BRIGHT_TEXT,
    countDecimals: 0,
    countSeparator: ',',
    opacity: 0,
    layer: 'text',
  });
  b.animations.push({
    type: 'Animation',
    target: total,
    from: { opacity: 0, value: 0 },
    to: { opacity: 1, value: ctx.countTo ?? 12480 },
    keyframes: [],
    delay: ctx.delay + 0.5,
    duration: 1.3,
    easing: 'power2.out',
  });
  const caption = b.add('text', 'caption', {
    value: ctx.label ?? 'Active users',
    center: true,
    x: -W / 2 + pad + W * 0.17,
    y: -H / 2 + H * 0.27,
    width: W * 0.4,
    height: H * 0.1,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.026),
    weight: 520,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, caption, 0.62, 0.5, 8, -H / 2 + H * 0.27);

  const baseline = H / 2 - pad;
  const left = -W / 2 + pad * 1.4;
  const right = W / 2 - pad * 1.4;
  const axis = b.add('overlay', 'axis', {
    shape: 'line',
    x: left,
    y: baseline,
    x2: right - left,
    y2: 0,
    stroke: EDGE,
    strokeWidth: 2,
    fill: 'none',
    opacity: 0,
  });
  b.enter(axis, 0.3, 0.45, { opacity: 0 }, { opacity: 1 });

  const bars = [0.34, 0.58, 0.42, 0.72, 0.56, 0.9];
  const barW = ((right - left) / bars.length) * 0.52;
  bars.forEach((height, index) => {
    const x = left + ((index + 0.5) * (right - left)) / bars.length;
    const barH = H * 0.42 * height;
    const bar = b.add('overlay', `bar${index}`, {
      shape: 'rect',
      x,
      y: baseline - 1,
      width: barW,
      height: 2,
      radius: Math.min(6, barW * 0.3),
      fill: index === bars.length - 1 ? ctx.accent : '#39424E',
      ...(index === bars.length - 1 ? { glow: 0, glowColor: ctx.accent } : {}),
      opacity: 0,
    });
    growBar(b, bar, 0.4 + index * 0.09, 0.7, baseline, barH);
  });
  return shell;
}

function notificationStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.26;
  const card = b.add('overlay', 'card', {
    shape: 'rect',
    width: W,
    height: H,
    radius: H * 0.3,
    fill: RAISED,
    stroke: EDGE,
    strokeWidth: 1.5,
    shadow: 24,
    opacity: 0,
  });
  b.animations.push({
    type: 'Animation',
    target: ctx.name,
    from: { opacity: 0, y: ctx.y - 22, scale: 0.9 },
    to: { opacity: 1, y: ctx.y, scale: 1 },
    keyframes: [],
    delay: ctx.delay,
    duration: Math.max(0.45, ctx.duration * 0.6),
    easing: 'back.out',
  });
  b.enter(card, 0, 0.3, { opacity: 0 }, { opacity: 1 });
  const stripe = b.add('overlay', 'stripe', {
    shape: 'rect',
    x: -W / 2 + W * 0.02,
    width: W * 0.014,
    height: H * 0.62,
    radius: W * 0.007,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  b.enter(stripe, 0.1, 0.35, { opacity: 0, height: H * 0.2 }, { opacity: 1, height: H * 0.62 });
  const icon = b.add('image', 'icon', {
    source: ctx.iconAlias,
    x: -W / 2 + W * 0.1,
    width: W * 0.075,
    center: true,
    stroke: ctx.accent,
    fill: 'none',
    strokeWidth: 2,
    opacity: 0,
  });
  pop(b, icon, 0.14, 0.4);
  const title = b.add('text', 'title', {
    value: ctx.label ?? 'Deploy complete',
    center: true,
    x: W * 0.075,
    y: -H * 0.14,
    width: W * 0.68,
    height: H * 0.34,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(15, W * 0.048),
    weight: 660,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'Production is live.',
    center: true,
    x: W * 0.075,
    y: H * 0.16,
    width: W * 0.68,
    height: H * 0.3,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.036),
    weight: 500,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(title, 0.2, 0.4, { opacity: 0, x: W * 0.075 + 12 }, { opacity: 1, x: W * 0.075 });
  b.enter(detail, 0.3, 0.4, { opacity: 0, x: W * 0.075 + 12 }, { opacity: 1, x: W * 0.075 });
  return card;
}

function cursorStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const pointer = b.add('image', 'pointer', {
    source: ctx.iconAlias,
    width: W,
    center: true,
    fill: '#F5F6F8',
    stroke: '#10141B',
    strokeWidth: 1.6,
    shadow: 10,
    opacity: 0,
  });
  b.enter(
    pointer,
    0,
    Math.max(0.35, ctx.duration * 0.5),
    { opacity: 0, scale: 0.7 },
    { opacity: 1, scale: 1 }
  );
  const ripple = b.add('overlay', 'ripple', {
    shape: 'circle',
    x: -W * 0.32,
    y: -W * 0.32,
    radius: W * 0.55,
    fill: 'none',
    stroke: ctx.accent,
    strokeWidth: 3,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  if (ctx.clickAt !== undefined) {
    b.key(
      ripple,
      ctx.clickAt - ctx.delay,
      0.55,
      [
        frame(0, { opacity: 0, scale: 0.4 }),
        frame(0.01, { opacity: 0.9, scale: 0.4 }),
        frame(1, { opacity: 0, scale: 2 }),
      ],
      'power2.out'
    );
    b.key(
      pointer,
      ctx.clickAt - ctx.delay - 0.04,
      0.3,
      [frame(0, { scale: 1 }), frame(0.45, { scale: 0.86 }), frame(1, { scale: 1 })],
      'power2.inOut'
    );
  }
  return pointer;
}

function codeEditorStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.62;
  const radius = W * 0.03;
  const barH = H * 0.12;
  const barY = -H / 2 + barH / 2;
  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 34, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const titlebar = b.add('overlay', 'titlebar', {
    shape: 'rect',
    y: barY,
    width: W,
    height: barH,
    radius,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(titlebar, 0.12, 0.45, { opacity: 0 }, { opacity: 1 });
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((dotColor, index) => {
    const dot = b.add('overlay', `dot${index}`, {
      shape: 'circle',
      x: -W / 2 + W * 0.04 + index * W * 0.028,
      y: barY,
      radius: Math.max(3, W * 0.008),
      fill: dotColor,
      opacity: 0,
    });
    pop(b, dot, 0.2 + index * 0.06, 0.3);
  });
  const filename = b.add('text', 'filename', {
    value: ctx.label ?? 'app.ts',
    center: true,
    y: barY,
    width: W * 0.4,
    height: barH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.02),
    weight: 540,
    font: MONO_FONT,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(filename, 0.3, 0.4, { opacity: 0 }, { opacity: 1 });

  const lines = [
    { width: 0.42, color: ctx.accent, indent: 0 },
    { width: 0.56, color: '#4A5563', indent: 0.05 },
    { width: 0.34, color: '#4A5563', indent: 0.05 },
    { width: 0.48, color: '#5B8DEF', indent: 0.09 },
    { width: 0.26, color: '#4A5563', indent: 0 },
  ];
  const lineTop = barY + barH / 2 + H * 0.1;
  lines.forEach((spec, index) => {
    const y = lineTop + index * H * 0.115;
    const fullWidth = W * spec.width;
    const x = -W / 2 + W * 0.08 + W * spec.indent + fullWidth / 2;
    const bar = b.add('overlay', `codeline${index}`, {
      shape: 'rect',
      x,
      y,
      width: fullWidth,
      height: Math.max(6, H * 0.03),
      radius: Math.max(3, H * 0.015),
      fill: spec.color,
      opacity: 0,
    });
    b.key(
      bar,
      0.42 + index * 0.16,
      0.5,
      [
        frame(0, { opacity: 0, width: 4, x: x - fullWidth / 2 + 2 }),
        frame(0.2, { opacity: 1 }),
        frame(1, { opacity: 1, width: fullWidth, x }),
      ],
      'power2.out'
    );
  });
  const status = b.add('text', 'status', {
    value: ctx.cta ?? '✓ build passing',
    center: true,
    x: -W / 2 + W * 0.08 + W * 0.12,
    y: H / 2 - H * 0.1,
    width: W * 0.4,
    height: H * 0.09,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.022),
    weight: 580,
    font: MONO_FONT,
    color: '#57D98B',
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, status, 0.5 + lines.length * 0.16, 0.5, 10, H / 2 - H * 0.1);
  return shell;
}

function websiteStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.64;
  const radius = W * 0.03;
  const surface = ctx.surface === '#12161D' ? '#F4F1EB' : ctx.surface;
  const ink = '#181611';
  const inkMuted = '#8D867D';
  const navH = H * 0.12;
  const navY = -H / 2 + navH / 2;

  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: surface,
    shadow: 34,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 38, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const logoDot = b.add('overlay', 'logoDot', {
    shape: 'circle',
    x: -W / 2 + W * 0.06,
    y: navY,
    radius: Math.max(5, W * 0.012),
    fill: ctx.accent,
    opacity: 0,
  });
  pop(b, logoDot, 0.18, 0.4);
  const brandDash = b.add('overlay', 'brand', {
    shape: 'rect',
    x: -W / 2 + W * 0.135,
    y: navY,
    width: W * 0.09,
    height: Math.max(5, H * 0.018),
    radius: 3,
    fill: ink,
    opacity: 0,
  });
  b.enter(brandDash, 0.24, 0.4, { opacity: 0 }, { opacity: 0.9 });
  [0, 1, 2].forEach((index) => {
    const dash = b.add('overlay', `nav${index}`, {
      shape: 'rect',
      x: W / 2 - W * 0.22 + index * W * 0.075,
      y: navY,
      width: W * 0.05,
      height: Math.max(4, H * 0.014),
      radius: 2.5,
      fill: inkMuted,
      opacity: 0,
    });
    b.enter(dash, 0.28 + index * 0.06, 0.35, { opacity: 0 }, { opacity: 0.75 });
  });

  const headlineY = -H * 0.1;
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Launch what matters',
    center: true,
    y: headlineY,
    width: W * 0.72,
    height: H * 0.22,
    textAlign: 'center',
    verticalAlign: 'middle',
    wrap: 'word',
    lineHeight: 1.05,
    size: Math.max(24, W * 0.055),
    weight: 720,
    color: ink,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, headline, 0.36, 0.65, 22, headlineY);
  const subline = b.add('overlay', 'subline', {
    shape: 'rect',
    y: headlineY + H * 0.15,
    width: W * 0.4,
    height: Math.max(5, H * 0.018),
    radius: 3,
    fill: inkMuted,
    opacity: 0,
  });
  b.enter(subline, 0.54, 0.5, { opacity: 0, width: W * 0.18 }, { opacity: 0.6, width: W * 0.4 });

  const ctaY = headlineY + H * 0.31;
  const ctaW = W * 0.2;
  const ctaH = H * 0.1;
  const cta = b.add('overlay', 'cta', {
    shape: 'rect',
    y: ctaY,
    width: ctaW,
    height: ctaH,
    radius: ctaH / 2,
    fill: ink,
    opacity: 0,
  });
  pop(b, cta, 0.7, 0.5);
  const ctaLabel = b.add('text', 'ctaLabel', {
    value: ctx.cta ?? 'Start free',
    center: true,
    y: ctaY,
    width: ctaW,
    height: ctaH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.021),
    weight: 640,
    color: '#FAF8F2',
    opacity: 0,
    layer: 'text',
  });
  b.enter(ctaLabel, 0.82, 0.35, { opacity: 0 }, { opacity: 1 });

  const bannerY = H / 2 - H * 0.17;
  const banner = b.add('overlay', 'banner', {
    shape: 'rect',
    y: bannerY,
    width: W * 0.84,
    height: H * 0.18,
    radius: radius * 0.8,
    fill: ctx.accent,
    gradientFrom: ctx.color,
    gradientTo: ctx.accent,
    gradientAngle: 18,
    opacity: 0,
  });
  b.enter(
    banner,
    0.92,
    0.6,
    { opacity: 0, y: bannerY + 18, scale: 0.96 },
    { opacity: 1, y: bannerY, scale: 1 }
  );
  return shell;
}

function terminalStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.6;
  const radius = W * 0.028;
  const barH = H * 0.12;
  const barY = -H / 2 + barH / 2;
  const pad = W * 0.06;

  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 22,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 30, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const titlebar = b.add('overlay', 'titlebar', {
    shape: 'rect',
    y: barY,
    width: W,
    height: barH,
    radius,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(titlebar, 0.1, 0.35, { opacity: 0 }, { opacity: 1 });
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((dotColor, index) => {
    const dot = b.add('overlay', `dot${index}`, {
      shape: 'circle',
      x: -W / 2 + W * 0.045 + index * W * 0.03,
      y: barY,
      radius: Math.max(3, W * 0.008),
      fill: dotColor,
      opacity: 0,
    });
    pop(b, dot, 0.16 + index * 0.05, 0.25);
  });
  const title = b.add('text', 'title', {
    value: ctx.label ?? 'agent',
    center: true,
    y: barY,
    width: W * 0.5,
    height: barH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.022),
    weight: 540,
    font: MONO_FONT,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(title, 0.24, 0.3, { opacity: 0 }, { opacity: 1 });

  const lineY = barY + barH / 2 + H * 0.16;
  const prompt = b.add('text', 'prompt', {
    value: ctx.detail ?? '> motionly generate launch.motion',
    center: true,
    x: 0,
    y: lineY,
    width: W - pad * 2,
    height: H * 0.14,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(14, W * 0.028),
    weight: 520,
    font: MONO_FONT,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(prompt, 0.34, 0.4, { opacity: 0, x: -14 }, { opacity: 1, x: 0 });

  const caret = b.add('overlay', 'caret', {
    shape: 'rect',
    x: -W / 2 + pad + W * 0.015,
    y: lineY + H * 0.12,
    width: Math.max(6, W * 0.014),
    height: Math.max(14, W * 0.032),
    fill: ctx.accent,
    opacity: 0,
  });
  b.key(
    caret,
    0.5,
    0.9,
    [frame(0, { opacity: 1 }), frame(0.5, { opacity: 0 }), frame(1, { opacity: 1 })],
    'linear',
    'infinite',
    'loop'
  );

  const trackY = lineY + H * 0.3;
  const track = b.add('overlay', 'track', {
    shape: 'rect',
    x: -W / 2 + pad,
    y: trackY,
    originX: 0,
    width: W - pad * 2,
    height: Math.max(6, H * 0.022),
    radius: 4,
    fill: EDGE,
    opacity: 0,
  });
  b.enter(track, 0.7, 0.3, { opacity: 0 }, { opacity: 1 });
  const fill = b.add('overlay', 'fill', {
    shape: 'rect',
    x: -W / 2 + pad,
    y: trackY,
    originX: 0,
    width: 0,
    height: Math.max(6, H * 0.022),
    radius: 4,
    fill: ctx.accent,
    opacity: 0,
  });
  b.enter(
    fill,
    0.85,
    0.9,
    { opacity: 0, width: 0 },
    { opacity: 1, width: W - pad * 2 },
    'power2.inOut'
  );

  const done = b.add('text', 'done', {
    value: ctx.cta ?? '✓ launch.motion — ready in 12s',
    center: true,
    x: 0,
    y: trackY + H * 0.18,
    width: W - pad * 2,
    height: H * 0.14,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(13, W * 0.026),
    weight: 560,
    font: MONO_FONT,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  b.enter(
    done,
    1.85,
    0.35,
    { opacity: 0, y: trackY + H * 0.18 + 10 },
    { opacity: 1, y: trackY + H * 0.18 }
  );
  return shell;
}

function pricingCardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 1.24;
  const radius = W * 0.06;
  const labels = ctx.labels ?? ['Unlimited exports', 'Every AI agent', 'Editable forever'];

  const card = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 24,
    opacity: 0,
  });
  b.enter(
    card,
    0,
    ctx.duration,
    { opacity: 0, y: 34, scale: 0.93 },
    { opacity: 1, y: 0, scale: 1 },
    'back.out(1.4)'
  );

  const plan = b.add('text', 'plan', {
    value: ctx.label ?? 'Pro',
    center: true,
    y: -H * 0.36,
    width: W * 0.8,
    height: H * 0.1,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(16, W * 0.06),
    weight: 700,
    tracking: 2,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, plan, 0.18, 0.35, 12, -H * 0.36);

  const price = b.add('text', 'price', {
    value: ctx.countTo ?? 19,
    countDecimals: 0,
    countPrefix: '$',
    countSuffix: '/mo',
    center: true,
    y: -H * 0.2,
    width: W * 0.9,
    height: H * 0.16,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(30, W * 0.16),
    weight: 700,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.animations.push({
    type: 'Animation',
    target: price,
    from: { opacity: 0, value: 0 },
    to: { opacity: 1, value: ctx.countTo ?? 19 },
    keyframes: [],
    delay: ctx.delay + 0.32,
    duration: 0.7,
    easing: 'power2.out',
  });

  labels.slice(0, 3).forEach((feature, index) => {
    const y = -H * 0.02 + index * H * 0.12;
    const dot = b.add('overlay', `featureDot${index}`, {
      shape: 'circle',
      x: -W * 0.32,
      y,
      radius: Math.max(3.5, W * 0.012),
      fill: ctx.accent,
      opacity: 0,
    });
    const text = b.add('text', `feature${index}`, {
      value: feature,
      center: true,
      x: W * 0.05,
      y,
      width: W * 0.62,
      height: H * 0.09,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(13, W * 0.048),
      weight: 500,
      color: BRIGHT_TEXT,
      opacity: 0,
      layer: 'text',
    });
    pop(b, dot, 0.55 + index * 0.12, 0.25);
    b.enter(
      text,
      0.6 + index * 0.12,
      0.3,
      { opacity: 0, x: W * 0.05 + 14 },
      { opacity: 1, x: W * 0.05 }
    );
  });

  const ctaH = H * 0.1;
  const cta = b.add('overlay', 'cta', {
    shape: 'rect',
    y: H * 0.36,
    width: W * 0.74,
    height: ctaH,
    radius: ctaH / 2,
    fill: ctx.accent,
    opacity: 0,
  });
  pop(b, cta, 1.05, 0.35, 0.8);
  const ctaLabel = b.add('text', 'ctaLabel', {
    value: ctx.cta ?? 'Start free',
    center: true,
    y: H * 0.36,
    width: W * 0.7,
    height: ctaH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(13, W * 0.05),
    weight: 700,
    color: '#0A0E1B',
    opacity: 0,
    layer: 'text',
  });
  b.enter(ctaLabel, 1.18, 0.25, { opacity: 0 }, { opacity: 1 });
  return card;
}

function laptopStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const lidW = W * 0.78;
  const lidH = lidW * 0.64;
  const lidY = -W * 0.06;
  const radius = W * 0.02;

  const lid = b.add('overlay', 'lid', {
    shape: 'rect',
    y: lidY,
    width: lidW,
    height: lidH,
    radius,
    fill: '#080B12',
    stroke: EDGE,
    strokeWidth: Math.max(4, W * 0.008),
    shadow: 26,
    opacity: 0,
  });
  b.enter(
    lid,
    0,
    ctx.duration,
    { opacity: 0, y: lidY + 34, scale: 0.95 },
    { opacity: 1, y: lidY, scale: 1 }
  );

  const screen = b.add('overlay', 'screen', {
    shape: 'rect',
    y: lidY,
    width: lidW * 0.94,
    height: lidH * 0.9,
    radius: radius * 0.7,
    fill: ctx.surface,
    opacity: 0,
  });
  b.enter(screen, 0.14, 0.4, { opacity: 0 }, { opacity: 1 });

  const navY = lidY - lidH * 0.34;
  const nav = b.add('overlay', 'nav', {
    shape: 'rect',
    y: navY,
    width: lidW * 0.94,
    height: lidH * 0.12,
    radius: radius * 0.7,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(nav, 0.26, 0.32, { opacity: 0, y: navY - 8 }, { opacity: 1, y: navY });
  const navDot = b.add('overlay', 'navDot', {
    shape: 'circle',
    x: -lidW * 0.4,
    y: navY,
    radius: Math.max(4, W * 0.008),
    fill: ctx.accent,
    opacity: 0,
  });
  pop(b, navDot, 0.36, 0.25);

  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Launch day',
    center: true,
    y: lidY - lidH * 0.08,
    width: lidW * 0.8,
    height: lidH * 0.2,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(20, W * 0.045),
    weight: 700,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, headline, 0.44, 0.4, 16, lidY - lidH * 0.08);

  [0.42, 0.3].forEach((widthFactor, index) => {
    const y = lidY + lidH * 0.08 + index * lidH * 0.08;
    const dash = b.add('overlay', `line${index}`, {
      shape: 'rect',
      y,
      width: lidW * widthFactor,
      height: Math.max(4, lidH * 0.02),
      radius: 3,
      fill: '#39424E',
      opacity: 0,
    });
    b.enter(
      dash,
      0.58 + index * 0.1,
      0.32,
      { opacity: 0, width: lidW * widthFactor * 0.4 },
      { opacity: 1, width: lidW * widthFactor }
    );
  });

  const ctaW = lidW * 0.22;
  const ctaH = lidH * 0.11;
  const cta = b.add('overlay', 'cta', {
    shape: 'rect',
    y: lidY + lidH * 0.3,
    width: ctaW,
    height: ctaH,
    radius: ctaH / 2,
    fill: ctx.accent,
    opacity: 0,
  });
  pop(b, cta, 0.8, 0.32, 0.75);
  const ctaLabel = b.add('text', 'ctaLabel', {
    value: ctx.cta ?? 'Get started',
    center: true,
    y: lidY + lidH * 0.3,
    width: ctaW,
    height: ctaH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.018),
    weight: 700,
    color: '#0A0E1B',
    opacity: 0,
    layer: 'text',
  });
  b.enter(ctaLabel, 0.92, 0.22, { opacity: 0 }, { opacity: 1 });

  const baseY = lidY + lidH / 2 + W * 0.017;
  const base = b.add('overlay', 'base', {
    shape: 'rect',
    y: baseY,
    width: W,
    height: W * 0.034,
    radius: W * 0.017,
    fill: '#1B212C',
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(base, 0.12, 0.4, { opacity: 0, y: baseY + 10 }, { opacity: 1, y: baseY });
  const notch = b.add('overlay', 'notch', {
    shape: 'rect',
    y: baseY - W * 0.008,
    width: W * 0.14,
    height: W * 0.012,
    radius: W * 0.006,
    fill: '#242B38',
    opacity: 0,
  });
  b.enter(notch, 0.2, 0.3, { opacity: 0 }, { opacity: 1 });
  return lid;
}

/**
 * The Motionly workspace itself: rail, top bar, canvas, timeline, and
 * properties cascade in, the prompt types, and an editable draft assembles
 * on the canvas while the layer list answers each object. Everything is
 * parameterized - filename (`label`), prompt (`detail`), draft headline and
 * CTA (`headline`/`cta`), layer names (`labels`) - so projects compose the
 * editor instead of hand-drawing it.
 */
function editorStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.56;
  const radius = W * 0.016;
  const railW = W * 0.16;
  const panelW = W * 0.17;
  const barH = H * 0.075;
  const barY = -H / 2 + barH / 2;
  const layers = ctx.labels ?? ['headline', 'banner', 'chart'];
  const chrome = ctx.values ?? ['LAYERS', 'Export', 'PROPERTIES', 'x  96', 'y  -38'];
  const S = 1.35; // generation starts after the shell settles

  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 2,
    shadow: 26,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    0.34,
    { opacity: 0, y: 34, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1 },
    'back.out(1.4)'
  );

  const rail = b.add('overlay', 'rail', {
    shape: 'rect',
    x: -W / 2 + railW / 2,
    y: barH / 2,
    width: railW,
    height: H - barH,
    opacity: 0,
    fill: RAISED,
  });
  b.enter(
    rail,
    0.14,
    0.28,
    { opacity: 0, x: -W / 2 - railW * 0.2 },
    { opacity: 1, x: -W / 2 + railW / 2 },
    'back.out(1.6)'
  );
  const railTitle = b.add('text', 'railTitle', {
    value: chrome[0] ?? '',
    center: true,
    x: -W / 2 + railW / 2,
    y: barY + barH * 1.4,
    width: railW * 0.8,
    height: barH * 0.8,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.011),
    weight: 700,
    tracking: 3,
    color: '#55555E',
    opacity: 0,
    layer: 'text',
  });
  b.enter(railTitle, 0.4, 0.25, { opacity: 0 }, { opacity: 1 });

  const topbar = b.add('overlay', 'topbar', {
    shape: 'rect',
    y: barY,
    width: W,
    height: barH,
    radius,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(
    topbar,
    0.26,
    0.26,
    { opacity: 0, y: barY - barH * 0.8 },
    { opacity: 1, y: barY },
    'back.out(1.6)'
  );
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((dotColor, index) => {
    const dot = b.add('overlay', `dot${index}`, {
      shape: 'circle',
      x: -W / 2 + W * 0.022 + index * W * 0.016,
      y: barY,
      radius: Math.max(3, W * 0.0045),
      fill: dotColor,
      opacity: 0,
    });
    pop(b, dot, 0.44 + index * 0.05, 0.22);
  });
  const filename = b.add('text', 'filename', {
    value: ctx.label ?? 'launch.motion',
    center: true,
    y: barY,
    width: W * 0.3,
    height: barH,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.012),
    weight: 540,
    font: MONO_FONT,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(filename, 0.56, 0.25, { opacity: 0 }, { opacity: 1 });
  const exportChip = b.add('overlay', 'exportChip', {
    shape: 'rect',
    x: W / 2 - W * 0.06,
    y: barY,
    width: W * 0.085,
    height: barH * 0.62,
    radius: barH * 0.31,
    fill: ctx.accent,
    opacity: 0,
  });
  pop(b, exportChip, 0.62, 0.24, 0.8);
  const exportLabel = b.add('text', 'exportLabel', {
    value: chrome[1] ?? '',
    center: true,
    x: W / 2 - W * 0.06,
    y: barY,
    width: W * 0.085,
    height: barH * 0.62,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(9, W * 0.01),
    weight: 700,
    color: '#0A0E1B',
    opacity: 0,
    layer: 'text',
  });
  b.enter(exportLabel, 0.7, 0.2, { opacity: 0 }, { opacity: 1 });

  const canvasX = (railW - panelW) / 2;
  const canvasW = W - railW - panelW - W * 0.04;
  const canvasH = H * 0.56;
  const canvasY = -H * 0.06;
  const canvasArea = b.add('overlay', 'canvas', {
    shape: 'rect',
    x: canvasX,
    y: canvasY,
    width: canvasW,
    height: canvasH,
    radius: radius * 0.8,
    fill: '#0A0E19',
    stroke: '#1C2334',
    strokeWidth: 2,
    opacity: 0,
  });
  b.enter(
    canvasArea,
    0.38,
    0.3,
    { opacity: 0, scale: 0.92 },
    { opacity: 1, scale: 1 },
    'back.out(1.5)'
  );

  const tlY = H / 2 - H * 0.14;
  const timeline = b.add('overlay', 'timeline', {
    shape: 'rect',
    x: canvasX,
    y: tlY,
    width: canvasW,
    height: H * 0.2,
    radius: radius * 0.8,
    fill: RAISED,
    stroke: '#1C2334',
    strokeWidth: 2,
    opacity: 0,
  });
  b.enter(
    timeline,
    0.5,
    0.28,
    { opacity: 0, y: tlY + H * 0.06 },
    { opacity: 1, y: tlY },
    'back.out(1.6)'
  );
  for (let tick = 0; tick < 7; tick += 1) {
    const tickMark = b.add('overlay', `tick${tick}`, {
      shape: 'rect',
      x: canvasX - canvasW * 0.42 + tick * canvasW * 0.14,
      y: tlY - H * 0.082,
      width: 2,
      height: H * 0.02,
      fill: '#2A3140',
      opacity: 0,
    });
    b.enter(tickMark, 0.66 + tick * 0.04, 0.18, { opacity: 0 }, { opacity: 1 });
  }
  const playheadMark = b.add('overlay', 'playhead', {
    shape: 'rect',
    x: canvasX - canvasW * 0.42,
    y: tlY,
    width: 2.5,
    height: H * 0.17,
    fill: '#EDF0F4',
    opacity: 0,
  });
  b.key(
    playheadMark,
    S + 3.4,
    6,
    [
      frame(0, { opacity: 0.55, x: canvasX - canvasW * 0.42 }),
      frame(1, { opacity: 0.55, x: canvasX + canvasW * 0.44 }),
    ],
    'linear',
    'infinite',
    'loop'
  );

  const panel = b.add('overlay', 'panel', {
    shape: 'rect',
    x: W / 2 - panelW / 2,
    y: barH / 2,
    width: panelW,
    height: H - barH,
    fill: RAISED,
    opacity: 0,
  });
  b.enter(
    panel,
    0.62,
    0.28,
    { opacity: 0, x: W / 2 + panelW * 0.2 },
    { opacity: 1, x: W / 2 - panelW / 2 },
    'back.out(1.6)'
  );
  const panelTitle = b.add('text', 'panelTitle', {
    value: chrome[2] ?? '',
    center: true,
    x: W / 2 - panelW / 2,
    y: barY + barH * 1.4,
    width: panelW * 0.8,
    height: barH * 0.8,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.011),
    weight: 700,
    tracking: 3,
    color: '#55555E',
    opacity: 0,
    layer: 'text',
  });
  b.enter(panelTitle, 0.74, 0.25, { opacity: 0 }, { opacity: 1 });
  const sizeChip = b.add('overlay', 'sizeChip', {
    shape: 'rect',
    x: W / 2 - panelW / 2,
    y: barY + barH * 2.6,
    width: panelW * 0.78,
    height: barH * 0.85,
    radius: 8,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(sizeChip, 0.82, 0.24, { opacity: 0 }, { opacity: 1 });
  const sizeValue = b.add('text', 'sizeValue', {
    value: ctx.countTo ?? 64,
    countDecimals: 0,
    center: true,
    x: W / 2 - panelW / 2,
    y: barY + barH * 2.6,
    width: panelW * 0.66,
    height: barH * 0.8,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.011),
    weight: 600,
    font: MONO_FONT,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  b.enter(sizeValue, 0.9, 0.2, { opacity: 0 }, { opacity: 1 });
  chrome.slice(3, 5).forEach((coordinate, index) => {
    const chipX = W / 2 - panelW / 2 + (index === 0 ? -panelW * 0.2 : panelW * 0.2);
    const coordChip = b.add('overlay', `posChip${index}`, {
      shape: 'rect',
      x: chipX,
      y: barY + barH * 3.8,
      width: panelW * 0.36,
      height: barH * 0.8,
      radius: 7,
      fill: ctx.surface,
      stroke: EDGE,
      strokeWidth: 1.5,
      opacity: 0,
    });
    const coordText = b.add('text', `posText${index}`, {
      value: coordinate,
      center: true,
      x: chipX,
      y: barY + barH * 3.8,
      width: panelW * 0.3,
      height: barH * 0.7,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(9, W * 0.0095),
      weight: 540,
      font: MONO_FONT,
      color: MUTED_TEXT,
      opacity: 0,
      layer: 'text',
    });
    b.enter(coordChip, 0.96 + index * 0.06, 0.2, { opacity: 0 }, { opacity: 1 });
    b.enter(coordText, 1.02 + index * 0.06, 0.18, { opacity: 0 }, { opacity: 1 });
  });
  ['#7C6CFF', '#3E8BFF', '#EDF0F4'].forEach((swatchColor, index) => {
    const swatch = b.add('overlay', `swatch${index}`, {
      shape: 'circle',
      x: W / 2 - panelW * 0.68 + index * panelW * 0.18,
      y: barY + barH * 5,
      radius: Math.max(4, W * 0.005),
      fill: swatchColor,
      opacity: 0,
    });
    pop(b, swatch, 1.1 + index * 0.06, 0.2);
  });

  // The prompt, then the draft assembles while layer chips answer.
  const prompt = b.add('overlay', 'prompt', {
    shape: 'rect',
    x: canvasX,
    y: canvasY - canvasH / 2 - H * 0.005 + canvasH * 0.13,
    width: canvasW * 0.8,
    height: canvasH * 0.15,
    radius: 10,
    fill: RAISED,
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(
    prompt,
    0.95,
    0.28,
    { opacity: 0, y: canvasY - canvasH / 2 + canvasH * 0.13 - 20 },
    { opacity: 1, y: canvasY - canvasH / 2 + canvasH * 0.13 },
    'back.out(1.6)'
  );
  b.add('text', 'promptText', {
    value: ctx.detail ?? '> a launch film for our product',
    center: true,
    x: canvasX,
    y: canvasY - canvasH / 2 + canvasH * 0.13,
    width: canvasW * 0.74,
    height: canvasH * 0.13,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.013),
    weight: 520,
    font: MONO_FONT,
    color: BRIGHT_TEXT,
    opacity: 1,
    layer: 'text',
    textAnimation: `typewriter(split chars stagger 14ms delay ${seconds(ctx.delay + 1.3)} duration 260ms ease power3.out)`,
  });

  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Launch day',
    center: true,
    x: canvasX - canvasW * 0.12,
    y: canvasY + canvasH * 0.02,
    width: canvasW * 0.56,
    height: canvasH * 0.24,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(18, W * 0.032),
    weight: 700,
    tracking: 2,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.key(
    headline,
    S + 1.15,
    0.28,
    [
      frame(0, { opacity: 0, scale: 1.18, blur: 6 }),
      frame(0.55, { opacity: 1, scale: 0.99, blur: 0 }),
      frame(1, { opacity: 1, scale: 1 }),
    ],
    'power3.out'
  );

  const bar = b.add('overlay', 'bar', {
    shape: 'rect',
    x: canvasX - canvasW * 0.1,
    y: canvasY + canvasH * 0.24,
    width: canvasW * 0.4,
    height: canvasH * 0.11,
    radius: 8,
    fill: ctx.accent,
    opacity: 0,
  });
  b.key(
    bar,
    S + 1.65,
    0.26,
    [
      frame(0, { opacity: 0, y: canvasY + canvasH * 0.3, scale: 0.92 }),
      frame(0.6, { opacity: 1, y: canvasY + canvasH * 0.23, scale: 1.02 }),
      frame(1, { opacity: 1, y: canvasY + canvasH * 0.24, scale: 1 }),
    ],
    'power3.out'
  );
  const barLabel = b.add('text', 'barLabel', {
    value: ctx.cta ?? 'Get started',
    center: true,
    x: canvasX - canvasW * 0.1,
    y: canvasY + canvasH * 0.24,
    width: canvasW * 0.36,
    height: canvasH * 0.1,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.012),
    weight: 700,
    color: '#0A0E1B',
    opacity: 0,
    layer: 'text',
  });
  b.enter(barLabel, S + 1.85, 0.2, { opacity: 0 }, { opacity: 1 });
  const subline = b.add('overlay', 'subline', {
    shape: 'rect',
    x: canvasX - canvasW * 0.16,
    y: canvasY + canvasH * 0.135,
    width: canvasW * 0.3,
    height: Math.max(3, canvasH * 0.016),
    radius: 3,
    fill: '#39424E',
    opacity: 0,
  });
  b.enter(
    subline,
    S + 1.5,
    0.24,
    { opacity: 0, width: canvasW * 0.12 },
    { opacity: 1, width: canvasW * 0.3 }
  );

  const chartLeft = canvasX + canvasW * 0.16;
  const chart = b.add('path', 'chart', {
    d: `M${round(chartLeft)} ${round(canvasY + canvasH * 0.3)} C${round(chartLeft + canvasW * 0.08)} ${round(canvasY + canvasH * 0.26)} ${round(chartLeft + canvasW * 0.12)} ${round(canvasY + canvasH * 0.08)} ${round(chartLeft + canvasW * 0.2)} ${round(canvasY + canvasH * 0.02)} C${round(chartLeft + canvasW * 0.26)} ${round(canvasY - canvasH * 0.02)} ${round(chartLeft + canvasW * 0.3)} ${round(canvasY - canvasH * 0.14)} ${round(chartLeft + canvasW * 0.34)} ${round(canvasY - canvasH * 0.18)}`,
    fill: 'none',
    stroke: ctx.accent,
    strokeWidth: Math.max(3, W * 0.004),
    pathProgress: 0,
    opacity: 0,
  });
  b.enter(
    chart,
    S + 2.05,
    0.6,
    { opacity: 0, pathProgress: 0 },
    { opacity: 1, pathProgress: 1 },
    'power2.inOut'
  );

  // Timeline clips shoot in; a keyframe diamond and easing chip complete it.
  const clipColors = [ctx.accent, '#EDF0F4', '#55555E'];
  clipColors.forEach((clipColor, index) => {
    const clip = b.add('overlay', `clip${index}`, {
      shape: 'rect',
      x: canvasX - canvasW * 0.42 + index * canvasW * 0.09,
      y: tlY - H * 0.05 + index * H * 0.05,
      originX: 0,
      width: 0,
      height: H * 0.022,
      radius: 6,
      fill: clipColor,
      opacity: 0,
    });
    b.enter(
      clip,
      S + 2.5 + index * 0.14,
      0.3,
      { opacity: 0, width: 0 },
      { opacity: 1, width: canvasW * (0.34 - index * 0.06) },
      'power3.out'
    );
  });
  const keyframe = b.add('overlay', 'keyframe', {
    shape: 'rect',
    x: canvasX - canvasW * 0.3,
    y: tlY - H * 0.05,
    width: Math.max(7, W * 0.008),
    height: Math.max(7, W * 0.008),
    rotation: 45,
    fill: '#EDF0F4',
    opacity: 0,
  });
  pop(b, keyframe, S + 3.1, 0.24);

  layers.slice(0, 4).forEach((layerName, index) => {
    const chipY = barY + barH * (2.6 + index * 1.15);
    const chip = b.add('overlay', `layerChip${index}`, {
      shape: 'rect',
      x: -W / 2 + railW / 2,
      y: chipY,
      width: railW * 0.8,
      height: barH * 0.85,
      radius: 8,
      fill: ctx.surface,
      stroke: EDGE,
      strokeWidth: 1.5,
      opacity: 0,
    });
    const text = b.add('text', `layerText${index}`, {
      value: layerName,
      center: true,
      x: -W / 2 + railW / 2 + railW * 0.05,
      y: chipY,
      width: railW * 0.66,
      height: barH * 0.8,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(10, W * 0.011),
      weight: 540,
      font: MONO_FONT,
      color: BRIGHT_TEXT,
      opacity: 0,
      layer: 'text',
    });
    b.enter(
      chip,
      S + 1.3 + index * 0.42,
      0.24,
      { opacity: 0, x: -W / 2 + railW * 0.28 },
      { opacity: 1, x: -W / 2 + railW / 2 },
      'back.out(1.8)'
    );
    b.enter(text, S + 1.38 + index * 0.42, 0.24, { opacity: 0 }, { opacity: 1 });
  });

  return shell;
}

function cardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.66;
  const treatment = ctx.variant ?? ctx.type;
  const featured = [
    'featured',
    'chroma-grid',
    'magic-bento',
    'pixel-card',
    'spotlight-card',
  ].includes(treatment);
  const glass = ['fluid-glass', 'glass-surface'].includes(treatment);
  const tilted = treatment === 'tilted-card' || treatment === 'decay-card';
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: treatment === 'pixel-card' ? W * 0.015 : W * 0.05,
    fill: glass ? 'rgba(255,255,255,.1)' : ctx.surface,
    stroke: featured ? ctx.accent : EDGE,
    strokeWidth: featured ? 2.5 : 1.5,
    shadow: featured ? 34 : 22,
    rotation: tilted ? -3 : 0,
    opacity: 0,
  });
  b.enter(
    surface,
    0,
    ctx.duration,
    { opacity: 0, y: 40, scale: 0.94, rotation: tilted ? -8 : 0 },
    { opacity: 1, y: 0, scale: 1, rotation: tilted ? -3 : 0 }
  );

  const spotlight = b.add('overlay', 'spotlight', {
    shape: 'circle',
    x: -W * 0.34,
    y: -H * 0.34,
    radius: W * 0.22,
    fill: ctx.accent,
    opacity: 0,
    blur: W * 0.08,
    glow: 0,
    glowColor: ctx.accent,
  });
  b.key(
    spotlight,
    0.18,
    1.2,
    [
      frame(0, { opacity: 0, x: -W * 0.34 }),
      frame(0.2, { opacity: 0.2 }),
      frame(0.75, { opacity: 0.1, x: W * 0.28 }),
      frame(1, { opacity: 0, x: W * 0.34 }),
    ],
    'power2.inOut'
  );

  const eyebrow = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'FEATURE',
    center: true,
    x: -W * 0.35,
    y: -H * 0.28,
    width: W * 0.22,
    height: H * 0.12,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.03),
    weight: 680,
    tracking: 1.6,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Everything in one place',
    center: true,
    x: -W * 0.04,
    y: -H * 0.06,
    width: W * 0.78,
    height: H * 0.24,
    textAlign: 'left',
    verticalAlign: 'middle',
    wrap: 'word',
    size: Math.max(22, W * 0.065),
    weight: 710,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'A focused interface block with premium motion built in.',
    center: true,
    x: -W * 0.04,
    y: H * 0.19,
    width: W * 0.78,
    height: H * 0.22,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.35,
    size: Math.max(14, W * 0.038),
    weight: 500,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, eyebrow, 0.12, 0.42, 12, -H * 0.28);
  fadeUp(b, headline, 0.22, 0.58, 22, -H * 0.06);
  fadeUp(b, detail, 0.34, 0.52, 18, H * 0.19);

  const cta = b.add('text', 'cta', {
    value: ctx.cta ?? 'Explore →',
    center: true,
    x: W * 0.29,
    y: H * 0.37,
    width: W * 0.28,
    height: H * 0.11,
    textAlign: 'right',
    verticalAlign: 'middle',
    size: Math.max(13, W * 0.035),
    weight: 650,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, cta, 0.44, 0.44, 10, H * 0.37);
  return surface;
}

function tiltedCardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.68;
  b.key(
    ctx.name,
    0,
    ctx.duration,
    [frame(0, { rotation: -9, y: 42, scale: 0.94 }), frame(1, { rotation: -4, y: 0, scale: 1 })],
    'power4.out'
  );
  const poster = b.add('overlay', 'poster', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.025,
    fill: ctx.surface,
    stroke: '#171717',
    strokeWidth: 2,
    shadow: 20,
    opacity: 0,
  });
  b.enter(poster, 0, ctx.duration, { opacity: 0 }, { opacity: 1 });
  const stripe = b.add('overlay', 'stripe', {
    shape: 'rect',
    x: -W * 0.43,
    width: W * 0.08,
    height: H,
    fill: ctx.accent,
    opacity: 0,
  });
  b.enter(stripe, 0.08, 0.48, { opacity: 0, height: 0 }, { opacity: 1, height: H });
  const index = b.add('text', 'index', {
    value: ctx.cta ?? '01',
    center: true,
    x: W * 0.33,
    y: -H * 0.28,
    width: W * 0.18,
    height: H * 0.2,
    textAlign: 'right',
    verticalAlign: 'middle',
    size: Math.max(34, W * 0.11),
    weight: 760,
    color: '#171717',
    opacity: 0,
    layer: 'text',
  });
  const label = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'FEATURE',
    center: true,
    x: -W * 0.08,
    y: -H * 0.3,
    width: W * 0.5,
    height: H * 0.1,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.028),
    weight: 720,
    tracking: 1.8,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Build the story once',
    center: true,
    x: -W * 0.08,
    y: -H * 0.02,
    width: W * 0.66,
    height: H * 0.22,
    textAlign: 'left',
    verticalAlign: 'middle',
    wrap: 'word',
    size: Math.max(24, W * 0.066),
    weight: 740,
    color: '#171717',
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'Replace the content while the component keeps its structure.',
    center: true,
    x: -W * 0.08,
    y: H * 0.22,
    width: W * 0.66,
    height: H * 0.2,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.3,
    size: Math.max(14, W * 0.034),
    weight: 500,
    color: '#5B5B5B',
    opacity: 0,
    layer: 'text',
  });
  b.enter(index, 0.1, 0.46, { opacity: 0, x: W * 0.38 }, { opacity: 1, x: W * 0.33 });
  b.enter(label, 0.14, 0.42, { opacity: 0, x: -W * 0.18 }, { opacity: 1, x: -W * 0.12 });
  b.enter(headline, 0.22, 0.54, { opacity: 0, y: H * 0.06 }, { opacity: 1, y: -H * 0.02 });
  b.enter(detail, 0.3, 0.48, { opacity: 0, y: H * 0.28 }, { opacity: 1, y: H * 0.22 });
  b.key(
    index,
    1.05,
    0.6,
    [
      frame(0, { scale: 1, x: W * 0.33 }),
      frame(0.5, { scale: 1.1, x: W * 0.3 }),
      frame(1, { scale: 1, x: W * 0.33 }),
    ],
    'power3.out'
  );
  b.key(
    stripe,
    1.72,
    0.58,
    [
      frame(0, { width: W * 0.08 }),
      frame(0.45, { width: W * 0.13 }),
      frame(1, { width: W * 0.08 }),
    ],
    'power3.out'
  );
  return poster;
}

function magicBentoStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.68;
  const shell = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.045,
    fill: ctx.surface,
    stroke: '#171717',
    strokeWidth: 1.5,
    shadow: 16,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 38, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1 }
  );

  const mainTile = b.add('overlay', 'mainTile', {
    shape: 'rect',
    x: -W * 0.17,
    width: W * 0.58,
    height: H * 0.72,
    radius: W * 0.03,
    fill: ctx.theme.raised,
    opacity: 0,
  });
  const topTile = b.add('overlay', 'topTile', {
    shape: 'rect',
    x: W * 0.3,
    y: -H * 0.19,
    width: W * 0.25,
    height: H * 0.32,
    radius: W * 0.025,
    fill: ctx.accent,
    opacity: 0,
  });
  const bottomTile = b.add('overlay', 'bottomTile', {
    shape: 'rect',
    x: W * 0.3,
    y: H * 0.2,
    width: W * 0.25,
    height: H * 0.34,
    radius: W * 0.025,
    fill: '#171717',
    opacity: 0,
  });
  b.enter(mainTile, 0.1, 0.5, { opacity: 0, x: -W * 0.23 }, { opacity: 1, x: -W * 0.17 });
  b.enter(topTile, 0.18, 0.42, { opacity: 0, y: -H * 0.1 }, { opacity: 1, y: -H * 0.19 });
  b.enter(bottomTile, 0.24, 0.42, { opacity: 0, y: H * 0.29 }, { opacity: 1, y: H * 0.2 });

  const label = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'COMPOSITION',
    center: true,
    x: -W * 0.2,
    y: -H * 0.23,
    width: W * 0.42,
    height: H * 0.08,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.024),
    weight: 720,
    tracking: 1.5,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Magic Bento',
    center: true,
    x: -W * 0.2,
    y: -H * 0.02,
    width: W * 0.42,
    height: H * 0.2,
    textAlign: 'left',
    verticalAlign: 'middle',
    wrap: 'word',
    size: Math.max(20, W * 0.052),
    weight: 730,
    color: ctx.theme.text,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'One focal tile supported by smaller live modules.',
    center: true,
    x: -W * 0.2,
    y: H * 0.19,
    width: W * 0.42,
    height: H * 0.18,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.25,
    size: Math.max(12, W * 0.027),
    weight: 500,
    color: ctx.theme.muted,
    opacity: 0,
    layer: 'text',
  });
  const stat = b.add('text', 'stat', {
    value: ctx.countTo ?? 24,
    center: true,
    x: W * 0.3,
    y: -H * 0.2,
    width: W * 0.2,
    height: H * 0.2,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(28, W * 0.072),
    weight: 780,
    color: '#171717',
    opacity: 0,
    layer: 'text',
  });
  const status = b.add('text', 'status', {
    value: ctx.cta ?? 'LIVE',
    center: true,
    x: W * 0.3,
    y: H * 0.2,
    width: W * 0.2,
    height: H * 0.12,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.03),
    weight: 720,
    tracking: 1.5,
    color: '#FFFFFF',
    opacity: 0,
    layer: 'text',
  });
  b.enter(label, 0.18, 0.38, { opacity: 0 }, { opacity: 1 });
  b.enter(headline, 0.24, 0.48, { opacity: 0, y: H * 0.04 }, { opacity: 1, y: -H * 0.02 });
  b.enter(detail, 0.3, 0.44, { opacity: 0 }, { opacity: 1 });
  b.enter(stat, 0.3, 0.4, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 });
  b.enter(status, 0.36, 0.36, { opacity: 0 }, { opacity: 1 });
  return shell;
}

function fluidGlassStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.68;
  const backplate = b.add('overlay', 'backplate', {
    shape: 'rect',
    x: -W * 0.035,
    y: H * 0.035,
    width: W * 0.94,
    height: H * 0.9,
    radius: W * 0.055,
    fill: ctx.accent,
    opacity: 0,
    rotation: -4,
  });
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.055,
    fill: 'rgba(255,255,255,.82)',
    stroke: 'rgba(23,23,23,.18)',
    strokeWidth: 1.5,
    shadow: 14,
    opacity: 0,
  });
  b.enter(backplate, 0, 0.54, { opacity: 0, rotation: -9 }, { opacity: 0.22, rotation: -4 });
  b.enter(
    surface,
    0.08,
    ctx.duration,
    { opacity: 0, x: W * 0.1, skewX: -5 },
    { opacity: 1, x: 0, skewX: 0 }
  );
  const rule = b.add('overlay', 'rule', {
    shape: 'rect',
    x: -W * 0.4,
    width: W * 0.018,
    height: H * 0.68,
    radius: W * 0.009,
    fill: ctx.accent,
    opacity: 0,
  });
  b.enter(rule, 0.16, 0.46, { opacity: 0, height: 0 }, { opacity: 1, height: H * 0.68 });
  const label = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'MATERIAL',
    center: true,
    x: -W * 0.08,
    y: -H * 0.27,
    width: W * 0.5,
    height: H * 0.09,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.024),
    weight: 720,
    tracking: 1.5,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Fluid Glass',
    center: true,
    x: -W * 0.12,
    y: -H * 0.03,
    width: W * 0.58,
    height: H * 0.2,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(22, W * 0.056),
    weight: 730,
    color: '#171717',
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'Layered material with a refracted edge and clear hierarchy.',
    center: true,
    x: -W * 0.08,
    y: H * 0.18,
    width: W * 0.5,
    height: H * 0.18,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.25,
    size: Math.max(12, W * 0.027),
    weight: 500,
    color: '#5B5B5B',
    opacity: 0,
    layer: 'text',
  });
  for (const [index, y] of [-H * 0.18, H * 0.02, H * 0.22].entries()) {
    const chip = b.add('overlay', `chip${index}`, {
      shape: 'rect',
      x: W * 0.31,
      y,
      width: W * (0.18 - index * 0.025),
      height: H * 0.1,
      radius: H * 0.05,
      fill: index === 0 ? ctx.accent : '#171717',
      opacity: 0,
    });
    b.enter(
      chip,
      0.22 + index * 0.07,
      0.4,
      { opacity: 0, x: W * 0.4 },
      { opacity: 1, x: W * 0.31 }
    );
  }
  b.enter(label, 0.18, 0.38, { opacity: 0 }, { opacity: 1 });
  b.enter(headline, 0.24, 0.48, { opacity: 0, y: H * 0.03 }, { opacity: 1, y: -H * 0.03 });
  b.enter(detail, 0.32, 0.44, { opacity: 0 }, { opacity: 1 });
  return surface;
}

function spotlightCardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.68;
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.035,
    fill: '#171717',
    shadow: 16,
    opacity: 0,
  });
  b.enter(surface, 0, ctx.duration, { opacity: 0, y: 38 }, { opacity: 1, y: 0 });
  const sun = b.add('overlay', 'sun', {
    shape: 'circle',
    x: W * 0.31,
    y: -H * 0.25,
    radius: W * 0.12,
    fill: ctx.accent,
    opacity: 0,
  });
  b.key(
    sun,
    0.12,
    0.72,
    [
      frame(0, { opacity: 0, x: -W * 0.35, scale: 0.7 }),
      frame(0.08, { opacity: 1 }),
      frame(1, { opacity: 1, x: W * 0.31, scale: 1 }),
    ],
    'power4.out'
  );
  const label = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'FOCUS',
    center: true,
    x: -W * 0.28,
    y: -H * 0.27,
    width: W * 0.3,
    height: H * 0.09,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.024),
    weight: 720,
    tracking: 1.6,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Spotlight Card',
    center: true,
    x: -W * 0.08,
    y: -H * 0.01,
    width: W * 0.7,
    height: H * 0.22,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(22, W * 0.056),
    weight: 730,
    color: '#FAF8F2',
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'A moving hard light establishes the focal point.',
    center: true,
    x: -W * 0.08,
    y: H * 0.2,
    width: W * 0.7,
    height: H * 0.18,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.25,
    size: Math.max(12, W * 0.027),
    weight: 500,
    color: '#B8B8B8',
    opacity: 0,
    layer: 'text',
  });
  const footer = b.add('overlay', 'footer', {
    shape: 'rect',
    x: -W * 0.2,
    y: H * 0.38,
    width: W * 0.58,
    height: 4,
    fill: ctx.accent,
    opacity: 0,
  });
  b.enter(label, 0.2, 0.36, { opacity: 0 }, { opacity: 1 });
  b.enter(headline, 0.28, 0.48, { opacity: 0, x: -W * 0.14 }, { opacity: 1, x: -W * 0.08 });
  b.enter(detail, 0.34, 0.44, { opacity: 0 }, { opacity: 1 });
  b.enter(footer, 0.4, 0.44, { opacity: 0, width: 0 }, { opacity: 1, width: W * 0.58 });
  return surface;
}

function metricCardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.62;
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.04,
    fill: ctx.surface,
    stroke: ctx.theme.edge,
    strokeWidth: 1.5,
    shadow: 16,
    opacity: 0,
  });
  b.enter(
    surface,
    0,
    ctx.duration,
    { opacity: 0, y: 30, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const eyebrow = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'ACTIVE USERS',
    center: true,
    x: -W * 0.32,
    y: -H * 0.3,
    width: W * 0.28,
    height: H * 0.1,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.027),
    weight: 700,
    tracking: 1.4,
    color: ctx.theme.muted,
    opacity: 0,
    layer: 'text',
  });
  const value = b.add('text', 'value', {
    value: ctx.countTo ?? 42800,
    countDecimals: 0,
    countSeparator: ',',
    center: true,
    x: -W * 0.2,
    y: -H * 0.05,
    width: W * 0.52,
    height: H * 0.25,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(36, W * 0.12),
    weight: 760,
    color: ctx.theme.text,
    opacity: 0,
    layer: 'text',
  });
  b.animations.push({
    type: 'Animation',
    target: value,
    from: { opacity: 0, value: 0 },
    to: { opacity: 1, value: ctx.countTo ?? 42800 },
    keyframes: [],
    delay: ctx.delay + 0.16,
    duration: 0.72,
    easing: 'power3.out',
  });
  const delta = b.add('text', 'delta', {
    value: ctx.cta ?? '+18.4%',
    center: true,
    x: W * 0.3,
    y: -H * 0.03,
    width: W * 0.2,
    height: H * 0.13,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(13, W * 0.032),
    weight: 700,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'vs previous period',
    center: true,
    x: W * 0.3,
    y: H * 0.11,
    width: W * 0.25,
    height: H * 0.1,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.024),
    weight: 520,
    color: ctx.theme.muted,
    opacity: 0,
    layer: 'text',
  });
  const baseline = b.add('overlay', 'baseline', {
    shape: 'rect',
    y: H * 0.3,
    width: W * 0.8,
    height: 2,
    fill: ctx.theme.edge,
    opacity: 0,
  });
  const sparkline = b.add('path', 'sparkline', {
    d: `M${round(-W * 0.4)} ${round(H * 0.26)} C${round(-W * 0.22)} ${round(H * 0.18)} ${round(-W * 0.12)} ${round(H * 0.3)} 0 ${round(H * 0.14)} C${round(W * 0.14)} ${round(-H * 0.02)} ${round(W * 0.25)} ${round(H * 0.12)} ${round(W * 0.4)} ${round(-H * 0.12)}`,
    fill: 'none',
    stroke: ctx.accent,
    strokeWidth: Math.max(3, W * 0.008),
    pathProgress: 0,
    opacity: 0,
  });
  b.enter(eyebrow, 0.08, 0.34, { opacity: 0, x: -W * 0.38 }, { opacity: 1, x: -W * 0.32 });
  pop(b, delta, 0.22, 0.34);
  b.enter(detail, 0.24, 0.3, { opacity: 0 }, { opacity: 1 });
  b.enter(baseline, 0.24, 0.36, { opacity: 0, width: 0 }, { opacity: 1, width: W * 0.8 });
  b.enter(
    sparkline,
    0.3,
    0.62,
    { opacity: 0, pathProgress: 0 },
    { opacity: 1, pathProgress: 1 },
    'power2.inOut'
  );
  return surface;
}

function mediaCardStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.72;
  const surface = b.add('overlay', 'surface', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.035,
    fill: ctx.surface,
    stroke: ctx.theme.edge,
    strokeWidth: 1.5,
    shadow: 18,
    opacity: 0,
  });
  b.enter(
    surface,
    0,
    ctx.duration,
    { opacity: 0, y: 34, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const media = b.add('image', 'media', {
    source: ctx.iconAlias,
    center: true,
    y: -H * 0.15,
    width: W * 0.9,
    height: H * 0.52,
    radius: W * 0.025,
    fit: 'cover',
    opacity: 0,
  });
  const eyebrow = b.add('text', 'eyebrow', {
    value: ctx.label ?? 'CASE STUDY',
    center: true,
    x: -W * 0.3,
    y: H * 0.2,
    width: W * 0.3,
    height: H * 0.08,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(10, W * 0.024),
    weight: 700,
    tracking: 1.5,
    color: ctx.accent,
    opacity: 0,
    layer: 'text',
  });
  const headline = b.add('text', 'headline', {
    value: ctx.headline ?? 'Show the real product',
    center: true,
    x: -W * 0.02,
    y: H * 0.28,
    width: W * 0.86,
    height: H * 0.13,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(20, W * 0.05),
    weight: 730,
    color: ctx.theme.text,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'Replace the media and copy without rebuilding the motion.',
    center: true,
    x: -W * 0.02,
    y: H * 0.39,
    width: W * 0.86,
    height: H * 0.09,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(11, W * 0.026),
    weight: 500,
    color: ctx.theme.muted,
    opacity: 0,
    layer: 'text',
  });
  b.enter(
    media,
    0.06,
    0.56,
    { opacity: 0, y: -H * 0.08, scale: 1.06 },
    { opacity: 1, y: -H * 0.15, scale: 1 }
  );
  b.enter(eyebrow, 0.18, 0.36, { opacity: 0 }, { opacity: 1 });
  fadeUp(b, headline, 0.24, 0.44, 16, H * 0.28);
  b.enter(detail, 0.3, 0.38, { opacity: 0 }, { opacity: 1 });
  return surface;
}

function formStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 1.12;
  const pad = W * 0.09;
  const fieldLabels = ctx.labels ?? ['Email', 'Password'];
  const values = ctx.values ?? ['you@example.com', '••••••••'];
  const titleText =
    ctx.label ??
    (ctx.variant === 'signup'
      ? 'Create account'
      : ctx.variant === 'search'
        ? 'Search'
        : 'Welcome back');
  const panel = b.add('overlay', 'panel', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.055,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 1.5,
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    panel,
    0,
    ctx.duration,
    { opacity: 0, y: 48, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const title = b.add('text', 'title', {
    value: titleText,
    center: true,
    x: -W * 0.04,
    y: -H * 0.34,
    width: W - pad * 2,
    height: H * 0.12,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(24, W * 0.07),
    weight: 720,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'Continue to your workspace',
    center: true,
    x: -W * 0.04,
    y: -H * 0.23,
    width: W - pad * 2,
    height: H * 0.08,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(13, W * 0.036),
    weight: 500,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, title, 0.12, 0.52, 18, -H * 0.34);
  fadeUp(b, detail, 0.2, 0.46, 12, -H * 0.23);

  fieldLabels.slice(0, 2).forEach((fieldLabel, index) => {
    const y = -H * 0.05 + index * H * 0.22;
    const field = b.add('overlay', `field${index}`, {
      shape: 'rect',
      y,
      width: W - pad * 2,
      height: H * 0.15,
      radius: W * 0.025,
      fill: RAISED,
      stroke: index === 0 ? ctx.accent : EDGE,
      strokeWidth: index === 0 ? 2 : 1.5,
      glow: 0,
      glowColor: ctx.accent,
      opacity: 0,
    });
    const label = b.add('text', `fieldLabel${index}`, {
      value: fieldLabel,
      center: true,
      x: -W * 0.04,
      y: y - H * 0.035,
      width: W - pad * 2.5,
      height: H * 0.05,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(11, W * 0.03),
      weight: 620,
      color: index === 0 ? ctx.accent : MUTED_TEXT,
      opacity: 0,
      layer: 'text',
    });
    const value = b.add('text', `fieldValue${index}`, {
      value: values[index] ?? '',
      center: true,
      x: -W * 0.04,
      y: y + H * 0.025,
      width: W - pad * 2.5,
      height: H * 0.065,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(13, W * 0.036),
      weight: 520,
      color: BRIGHT_TEXT,
      opacity: 0,
      layer: 'text',
    });
    b.enter(
      field,
      0.3 + index * 0.12,
      0.52,
      { opacity: 0, y: y + 22, scale: 0.97 },
      { opacity: 1, y, scale: 1 }
    );
    b.enter(label, 0.38 + index * 0.12, 0.38, { opacity: 0 }, { opacity: 1 });
    b.enter(value, 0.44 + index * 0.12, 0.38, { opacity: 0 }, { opacity: 1 });
  });

  const submitY = H * 0.36;
  const submit = b.add('overlay', 'submit', {
    shape: 'rect',
    y: submitY,
    width: W - pad * 2,
    height: H * 0.14,
    radius: H * 0.07,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  const submitLabel = b.add('text', 'submitLabel', {
    value: ctx.cta ?? (ctx.variant === 'signup' ? 'Create account' : 'Continue'),
    center: true,
    y: submitY,
    width: W - pad * 2,
    height: H * 0.12,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(14, W * 0.04),
    weight: 680,
    color: ctx.theme.ink,
    opacity: 0,
    layer: 'text',
  });
  pop(b, submit, 0.64, 0.5, 0.9);
  b.enter(submitLabel, 0.72, 0.34, { opacity: 0 }, { opacity: 1 });
  return panel;
}

function chatStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.9;
  const messages = ctx.values ?? [
    'Can you summarize the launch?',
    'Absolutely — here are the key moments.',
    'Perfect, ship it.',
  ];
  const senders = ctx.labels ?? ['You', 'Assistant', 'You'];
  const shell = b.add('overlay', 'frame', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.04,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 1.5,
    shadow: 30,
    opacity: 0,
  });
  b.enter(
    shell,
    0,
    ctx.duration,
    { opacity: 0, y: 38, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1 }
  );
  const headerY = -H * 0.42;
  const header = b.add('overlay', 'header', {
    shape: 'rect',
    y: headerY,
    width: W,
    height: H * 0.16,
    radius: W * 0.04,
    fill: RAISED,
    opacity: 0,
  });
  const avatar = b.add('overlay', 'avatar', {
    shape: 'circle',
    x: -W * 0.39,
    y: headerY,
    radius: W * 0.035,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  const title = b.add('text', 'title', {
    value: ctx.label ?? 'Product team',
    center: true,
    x: -W * 0.12,
    y: headerY,
    width: W * 0.46,
    height: H * 0.09,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(16, W * 0.038),
    weight: 680,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(header, 0.1, 0.46, { opacity: 0, y: headerY - 14 }, { opacity: 1, y: headerY });
  pop(b, avatar, 0.18, 0.4);
  b.enter(title, 0.24, 0.4, { opacity: 0, x: -W * 0.15 }, { opacity: 1, x: -W * 0.12 });

  messages.slice(0, 3).forEach((message, index) => {
    const mine = index % 2 === 0;
    const y = -H * 0.2 + index * H * 0.21;
    const bubbleW = W * (index === 1 ? 0.68 : 0.56);
    const x = mine ? W * 0.16 : -W * 0.12;
    const bubble = b.add('overlay', `bubble${index}`, {
      shape: 'rect',
      x,
      y,
      width: bubbleW,
      height: H * 0.15,
      radius: H * 0.06,
      fill: mine ? ctx.accent : RAISED,
      stroke: mine ? 'none' : EDGE,
      strokeWidth: 1.5,
      opacity: 0,
    });
    const sender = b.add('text', `sender${index}`, {
      value: senders[index] ?? '',
      center: true,
      x: x - bubbleW * 0.39,
      y: y - H * 0.04,
      width: bubbleW * 0.16,
      height: H * 0.04,
      textAlign: 'left',
      verticalAlign: 'middle',
      size: Math.max(9, W * 0.018),
      weight: 700,
      color: mine ? ctx.theme.ink : ctx.accent,
      opacity: 0,
      layer: 'text',
    });
    const copy = b.add('text', `message${index}`, {
      value: message,
      center: true,
      x,
      y: y + H * 0.02,
      width: bubbleW * 0.84,
      height: H * 0.09,
      textAlign: 'left',
      verticalAlign: 'middle',
      wrap: 'word',
      size: Math.max(12, W * 0.027),
      weight: 520,
      color: mine ? ctx.theme.ink : BRIGHT_TEXT,
      opacity: 0,
      layer: 'text',
    });
    b.enter(
      bubble,
      0.34 + index * 0.14,
      0.5,
      { opacity: 0, y: y + 24, scale: 0.92 },
      { opacity: 1, y, scale: 1 },
      'back.out(1.35)'
    );
    b.enter(sender, 0.42 + index * 0.14, 0.34, { opacity: 0 }, { opacity: 1 });
    b.enter(copy, 0.46 + index * 0.14, 0.38, { opacity: 0 }, { opacity: 1 });
  });

  const typingY = H * 0.39;
  const typing = b.add('overlay', 'typing', {
    shape: 'rect',
    x: -W * 0.34,
    y: typingY,
    width: W * 0.19,
    height: H * 0.1,
    radius: H * 0.05,
    fill: RAISED,
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(typing, 0.82, 0.42, { opacity: 0, y: typingY + 14 }, { opacity: 1, y: typingY });
  [0, 1, 2].forEach((index) => {
    const dot = b.add('overlay', `typingDot${index}`, {
      shape: 'circle',
      x: -W * 0.39 + index * W * 0.05,
      y: typingY,
      radius: W * 0.009,
      fill: MUTED_TEXT,
      opacity: 0,
    });
    b.key(
      dot,
      1 + index * 0.12,
      0.8,
      [
        frame(0, { opacity: 0.35, y: typingY }),
        frame(0.5, { opacity: 1, y: typingY - 5 }),
        frame(1, { opacity: 0.35, y: typingY }),
      ],
      'sine.inOut',
      'infinite',
      'loop'
    );
  });
  return shell;
}

function modalStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const H = W * 0.62;
  const backdrop = b.add('overlay', 'backdrop', {
    shape: 'rect',
    width: W * 2.35,
    height: H * 2.5,
    radius: W * 0.05,
    fill: ctx.theme.background,
    opacity: 0,
    blur: 3,
  });
  b.enter(backdrop, 0, 0.12, { opacity: 0 }, { opacity: 0.72 });
  const panel = b.add('overlay', 'panel', {
    shape: 'rect',
    width: W,
    height: H,
    radius: W * 0.045,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 1.5,
    shadow: 34,
    opacity: 0,
  });
  b.enter(
    panel,
    0.08,
    Math.min(ctx.duration, 0.62),
    { opacity: 0, y: 34, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1 },
    'back.out(1.5)'
  );
  const title = b.add('text', 'title', {
    value: ctx.label ?? 'Confirm action',
    center: true,
    x: -W * 0.04,
    y: -H * 0.25,
    width: W * 0.78,
    height: H * 0.14,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(22, W * 0.058),
    weight: 710,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  const detail = b.add('text', 'detail', {
    value: ctx.detail ?? 'This change will be applied immediately.',
    center: true,
    x: -W * 0.04,
    y: -H * 0.02,
    width: W * 0.78,
    height: H * 0.26,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: 'word',
    lineHeight: 1.35,
    size: Math.max(14, W * 0.036),
    weight: 500,
    color: MUTED_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, title, 0.2, 0.46, 16, -H * 0.25);
  fadeUp(b, detail, 0.28, 0.44, 12, -H * 0.02);

  const buttonY = H * 0.3;
  const actions = ctx.values ?? ['Cancel', 'Confirm'];
  const cancel = b.add('overlay', 'cancel', {
    shape: 'rect',
    x: W * 0.15,
    y: buttonY,
    width: W * 0.23,
    height: H * 0.16,
    radius: H * 0.08,
    fill: RAISED,
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  const confirm = b.add('overlay', 'confirm', {
    shape: 'rect',
    x: W * 0.37,
    y: buttonY,
    width: W * 0.18,
    height: H * 0.16,
    radius: H * 0.08,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  const cancelLabel = b.add('text', 'cancelLabel', {
    value: actions[0] ?? '',
    center: true,
    x: W * 0.15,
    y: buttonY,
    width: W * 0.23,
    height: H * 0.14,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.032),
    weight: 640,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  const confirmLabel = b.add('text', 'confirmLabel', {
    value: ctx.cta ?? actions[1] ?? '',
    center: true,
    x: W * 0.37,
    y: buttonY,
    width: W * 0.18,
    height: H * 0.14,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(12, W * 0.032),
    weight: 680,
    color: ctx.theme.ink,
    opacity: 0,
    layer: 'text',
  });
  pop(b, cancel, 0.42, 0.4, 0.9);
  pop(b, confirm, 0.48, 0.42, 0.86);
  b.enter(cancelLabel, 0.5, 0.3, { opacity: 0 }, { opacity: 1 });
  b.enter(confirmLabel, 0.56, 0.3, { opacity: 0 }, { opacity: 1 });
  return panel;
}

function navigationStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const mobile = ['mobile', 'bottom', 'dock'].includes(ctx.variant ?? '');
  const H = W * (mobile ? 0.16 : 0.115);
  const labels = (ctx.labels ?? ['Home', 'Explore', 'Inbox', 'Profile']).slice(0, 4);
  const bar = b.add('overlay', 'bar', {
    shape: 'rect',
    width: W,
    height: H,
    radius: H / 2,
    fill: ctx.surface,
    stroke: EDGE,
    strokeWidth: 1.5,
    shadow: 24,
    opacity: 0,
  });
  b.enter(bar, 0, ctx.duration, { opacity: 0, y: 34, scale: 0.94 }, { opacity: 1, y: 0, scale: 1 });

  const brand = b.add('text', 'brand', {
    value: ctx.label ?? 'Motionly',
    center: true,
    x: -W * 0.36,
    width: W * 0.2,
    height: H * 0.7,
    textAlign: 'left',
    verticalAlign: 'middle',
    size: Math.max(14, W * 0.028),
    weight: 720,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  b.enter(brand, 0.12, 0.4, { opacity: 0, x: -W * 0.4 }, { opacity: 1, x: -W * 0.36 });

  const itemStart = mobile ? -W * 0.2 : -W * 0.05;
  const step = mobile ? W * 0.14 : W * 0.13;
  const active = b.add('overlay', 'active', {
    shape: 'rect',
    x: itemStart,
    width: mobile ? W * 0.12 : W * 0.11,
    height: H * 0.62,
    radius: H * 0.31,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  pop(b, active, 0.2, 0.42, 0.76);
  labels.forEach((label, index) => {
    const x = itemStart + index * step;
    const item = b.add('text', `item${index}`, {
      value: label,
      center: true,
      x,
      y: index === 0 ? -H * 0.03 : 0,
      width: mobile ? W * 0.12 : W * 0.11,
      height: H * 0.62,
      textAlign: 'center',
      verticalAlign: 'middle',
      size: Math.max(11, W * 0.02),
      weight: index === 0 ? 700 : 560,
      color: index === 0 ? ctx.theme.ink : MUTED_TEXT,
      opacity: 0,
      layer: 'text',
    });
    b.enter(
      item,
      0.24 + index * 0.08,
      0.42,
      { opacity: 0, y: H * 0.24, scale: 0.88 },
      { opacity: 1, y: index === 0 ? -H * 0.03 : 0, scale: 1 },
      index === 0 ? 'back.out(1.5)' : 'power4.out'
    );
  });
  return bar;
}

function loaderStructure(ctx: StructureContext, b: Builder): string {
  const W = ctx.width;
  const progress = Math.max(0, Math.min(1, (ctx.countTo ?? 72) / 100));
  const track = b.add('overlay', 'track', {
    shape: 'rect',
    width: W,
    height: W * 0.11,
    radius: W * 0.055,
    fill: RAISED,
    stroke: EDGE,
    strokeWidth: 1.5,
    opacity: 0,
  });
  b.enter(track, 0, 0.42, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 });

  const fillWidth = Math.max(W * 0.1, W * progress);
  const progressId = b.add('overlay', 'progress', {
    shape: 'rect',
    x: -(W - fillWidth) / 2,
    width: fillWidth,
    height: W * 0.11,
    radius: W * 0.055,
    fill: ctx.accent,
    glow: 0,
    glowColor: ctx.accent,
    opacity: 0,
  });
  b.enter(
    progressId,
    0.12,
    0.68,
    { opacity: 1, scale: 0.08, x: -W * 0.46 },
    { opacity: 1, scale: 1, x: -(W - fillWidth) / 2 },
    'power3.out'
  );

  const label = b.add('text', 'label', {
    value: ctx.label ?? 'Loading…',
    center: true,
    y: W * 0.18,
    width: W,
    height: W * 0.16,
    textAlign: 'center',
    verticalAlign: 'middle',
    size: Math.max(14, W * 0.1),
    weight: 620,
    color: BRIGHT_TEXT,
    opacity: 0,
    layer: 'text',
  });
  fadeUp(b, label, 0.22, 0.42, 10, W * 0.18);
  return progressId;
}

const BASE_BUILDERS: Record<BaseSemanticComponentType, StructureBuilder> = {
  cloud: glyphStructure,
  database: glyphStructure,
  server: glyphStructure,
  arrow: glyphStructure,
  logo: glyphStructure,
  button: buttonStructure,
  dashboard: dashboardStructure,
  phone: phoneStructure,
  browser: browserStructure,
  chart: chartStructure,
  notification: notificationStructure,
  cursor: cursorStructure,
  codeeditor: codeEditorStructure,
  website: websiteStructure,
  terminal: terminalStructure,
  pricingcard: pricingCardStructure,
  laptop: laptopStructure,
  editor: editorStructure,
  card: cardStructure,
  form: formStructure,
  chat: chatStructure,
  modal: modalStructure,
  navigation: navigationStructure,
  loader: loaderStructure,
};

const BUILDERS = {
  ...BASE_BUILDERS,
  ...Object.fromEntries(
    Object.entries(REACTBITS_COMPONENT_ALIASES).map(([alias, target]) => [
      alias,
      BASE_BUILDERS[target],
    ])
  ),
  'tilted-card': tiltedCardStructure,
  'magic-bento': magicBentoStructure,
  'fluid-glass': fluidGlassStructure,
  'spotlight-card': spotlightCardStructure,
  'metric-card': metricCardStructure,
  'media-card': mediaCardStructure,
} as Record<SemanticComponentType, StructureBuilder>;

function seconds(value: number): string {
  return `${Number(value.toFixed(3))}s`;
}

function round(value: number): number {
  return Number(value.toFixed(1));
}
