/**
 * Composition engine.
 *
 * Layouts solve the composition problems the AI used to guess at: hierarchy,
 * spacing rhythm, alignment, and pacing. A layout is a pure function from a
 * `LayoutSpec` to positioned `LayoutSlot`s, expressed in the same centered
 * coordinate space Motionly elements already use (x/y are offsets from the
 * parent center). Nothing here touches the renderer — the semantic compiler
 * copies the resolved slots onto ordinary elements.
 *
 * Every solver is deterministic: the same spec always yields the same frame, so
 * generated projects are reproducible and testable.
 */

import type { AssetKind } from './asset-kinds';

export const LAYOUT_TYPES = [
  'heroLayout',
  'splitLayout',
  'bentoGrid',
  'featureGrid',
  'masonryGrid',
  'deviceStack',
  'logoWall',
  'comparisonLayout',
  'timelineLayout',
  'carousel',
  'gallery',
  'floatingCollage',
] as const;

export type LayoutType = (typeof LAYOUT_TYPES)[number];

/** Visual rhythm unit. Every resolved coordinate and size snaps to this grid. */
export const RHYTHM = 8;

/**
 * Arrival motion budget.
 *
 * A cascade is a wave, not a queue. Three rules produce that:
 *
 * 1. **Velocity varies by weight.** The focal subject travels further and
 *    settles longer; support items snap in tight. Uniform travel and duration
 *    across a group is what makes generated motion read as machine-made.
 * 2. **Gaps shrink.** Each successive gap is `gapDecay` times the last, so the
 *    group accelerates into place and the final item snaps.
 * 3. **The group lands inside one beat.** The whole cascade window is capped, so
 *    a twenty-logo wall still reads as one arrival instead of a slow roll call.
 *
 * Arrivals also reveal binary — opacity snaps on and the motion carries the
 * entrance. Fading an arrival fights its own snap.
 */
export const ARRIVAL = {
  focal: { travel: 64, duration: 0.62 },
  support: { travel: 40, duration: 0.46 },
  /** Longest total cascade window, in seconds. */
  maxStaggerWindow: 0.5,
  /** Each gap is this fraction of the previous one. */
  gapDecay: 0.84,
  /** Never an `.inOut` curve on an arrival. */
  easing: 'power4.out',
} as const;

/** Default safe composition frame inside a 1920x1080 canvas. */
export const DEFAULT_FRAME = { width: 1600, height: 820 } as const;

export interface LayoutSpec {
  type: LayoutType;
  /** Number of children the layout has to place. */
  count: number;
  /** Composition frame the slots are laid out inside. */
  width?: number;
  height?: number;
  columns?: number;
  gap?: number;
  /** Explicit item size; solvers fall back to a derived size. */
  itemWidth?: number;
  itemHeight?: number;
  /** Reading order used for entrance pacing. */
  order?: 'linear' | 'center-out' | 'reverse';
  /** Incremental entrance delay between adjacent slots. */
  stagger?: number;
  /** First entrance delay. */
  delay?: number;
}

export interface LayoutSlot {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Entrance delay in seconds — math-driven, never simultaneous. */
  delay: number;
  /** Composition weight, used to pick focal treatment and camera targets. */
  emphasis: 'focal' | 'support';
  /** Entrance travel distance in pixels, scaled by composition weight. */
  travel: number;
  /** Entrance duration in seconds, scaled by composition weight. */
  duration: number;
}

export interface LayoutDefinition {
  type: LayoutType;
  category: 'layout';
  description: string;
  useCases: readonly string[];
  assetKinds: readonly AssetKind[];
  items: { min: number; max: number };
  defaults: { columns: number; gap: number; stagger: number };
}

const definitions: Record<LayoutType, LayoutDefinition> = {
  heroLayout: {
    type: 'heroLayout',
    category: 'layout',
    description: 'One focal subject with stacked supporting copy beneath it.',
    useCases: ['opening shot', 'product hero', 'brand promise'],
    assetKinds: ['logo', 'screenshot', 'ui', 'photo'],
    items: { min: 1, max: 4 },
    defaults: { columns: 1, gap: 56, stagger: 0.1 },
  },
  splitLayout: {
    type: 'splitLayout',
    category: 'layout',
    description: 'Editorial copy on one side, media on the other.',
    useCases: ['feature explanation', 'walkthrough step'],
    assetKinds: ['screenshot', 'ui', 'photo', 'illustration'],
    items: { min: 2, max: 4 },
    defaults: { columns: 2, gap: 80, stagger: 0.09 },
  },
  bentoGrid: {
    type: 'bentoGrid',
    category: 'layout',
    description: 'Asymmetric grid with one large focal tile and smaller support tiles.',
    useCases: ['feature showcase', 'capability overview', 'saas launch'],
    assetKinds: ['icon', 'ui', 'screenshot', 'chart'],
    items: { min: 3, max: 9 },
    defaults: { columns: 3, gap: 40, stagger: 0.07 },
  },
  featureGrid: {
    type: 'featureGrid',
    category: 'layout',
    description: 'Uniform grid of equal-weight feature cards.',
    useCases: ['feature list', 'icon showcase', 'benefits'],
    assetKinds: ['icon', 'illustration'],
    items: { min: 2, max: 12 },
    defaults: { columns: 3, gap: 40, stagger: 0.06 },
  },
  masonryGrid: {
    type: 'masonryGrid',
    category: 'layout',
    description: 'Column-packed grid for many screenshots of differing height.',
    useCases: ['screenshot gallery', 'portfolio', 'press collage'],
    assetKinds: ['screenshot', 'ui', 'photo'],
    items: { min: 3, max: 12 },
    defaults: { columns: 3, gap: 32, stagger: 0.05 },
  },
  deviceStack: {
    type: 'deviceStack',
    category: 'layout',
    description: 'Overlapping device fan with the center device in focus.',
    useCases: ['multi-platform reveal', 'app showcase'],
    assetKinds: ['screenshot', 'ui'],
    items: { min: 2, max: 5 },
    defaults: { columns: 1, gap: 0, stagger: 0.11 },
  },
  logoWall: {
    type: 'logoWall',
    category: 'layout',
    description: 'Dense grid of customer or integration logos.',
    useCases: ['social proof', 'integrations', 'trusted by'],
    assetKinds: ['logo', 'icon'],
    items: { min: 3, max: 20 },
    defaults: { columns: 5, gap: 56, stagger: 0.04 },
  },
  comparisonLayout: {
    type: 'comparisonLayout',
    category: 'layout',
    description: 'Two balanced halves for before/after or us/them.',
    useCases: ['before after', 'competitor comparison'],
    assetKinds: ['screenshot', 'ui', 'photo', 'chart'],
    items: { min: 2, max: 4 },
    defaults: { columns: 2, gap: 96, stagger: 0.12 },
  },
  timelineLayout: {
    type: 'timelineLayout',
    category: 'layout',
    description: 'Horizontal sequence of ordered steps along one baseline.',
    useCases: ['process', 'roadmap', 'onboarding steps'],
    assetKinds: ['icon', 'ui'],
    items: { min: 2, max: 6 },
    defaults: { columns: 1, gap: 48, stagger: 0.1 },
  },
  carousel: {
    type: 'carousel',
    category: 'layout',
    description: 'Center-weighted horizontal row that bleeds off frame.',
    useCases: ['screenshot tour', 'testimonials'],
    assetKinds: ['screenshot', 'ui', 'photo'],
    items: { min: 2, max: 7 },
    defaults: { columns: 1, gap: 56, stagger: 0.08 },
  },
  gallery: {
    type: 'gallery',
    category: 'layout',
    description: 'Two-row gallery with a wide first row.',
    useCases: ['media wall', 'case study'],
    assetKinds: ['photo', 'screenshot', 'illustration'],
    items: { min: 3, max: 10 },
    defaults: { columns: 3, gap: 36, stagger: 0.06 },
  },
  floatingCollage: {
    type: 'floatingCollage',
    category: 'layout',
    description: 'Deterministic depth collage of floating cards.',
    useCases: ['ambient background', 'brand collage'],
    assetKinds: ['screenshot', 'ui', 'photo', 'illustration'],
    items: { min: 3, max: 9 },
    defaults: { columns: 3, gap: 48, stagger: 0.09 },
  },
};

export function isLayoutType(value: string): value is LayoutType {
  return (LAYOUT_TYPES as readonly string[]).includes(value);
}

export function layoutDefinition(type: LayoutType): LayoutDefinition {
  return definitions[type];
}

export function layoutDefinitions(): readonly LayoutDefinition[] {
  return Object.values(definitions);
}

function snap(value: number): number {
  // `+ 0` normalizes -0, which would otherwise leak into serialized source.
  return Math.round(value / RHYTHM) * RHYTHM + 0;
}

/**
 * Resolve entrance delays into an accelerating cascade.
 *
 * Gaps shrink by `ARRIVAL.gapDecay` so the group gains momentum and the last
 * item snaps, and the whole window is scaled down when it would exceed
 * `ARRIVAL.maxStaggerWindow` — a group must land inside one beat regardless of
 * how many items it holds.
 */
function orderedDelays(spec: LayoutSpec, count: number): number[] {
  const definition = definitions[spec.type];
  const stagger = spec.stagger ?? definition.defaults.stagger;
  const base = spec.delay ?? 0;
  const order = spec.order ?? 'linear';
  const rank = new Array<number>(count).fill(0);
  if (order === 'center-out') {
    const center = (count - 1) / 2;
    [...Array(count).keys()]
      .sort((left, right) => Math.abs(left - center) - Math.abs(right - center) || left - right)
      .forEach((index, position) => {
        rank[index] = position;
      });
  } else if (order === 'reverse') {
    for (let index = 0; index < count; index += 1) rank[index] = count - 1 - index;
  } else {
    for (let index = 0; index < count; index += 1) rank[index] = index;
  }

  const gaps: number[] = [];
  for (let step = 0; step < Math.max(0, count - 1); step += 1) {
    gaps.push(stagger * ARRIVAL.gapDecay ** step);
  }
  const window = gaps.reduce((total, gap) => total + gap, 0);
  const scale = window > ARRIVAL.maxStaggerWindow ? ARRIVAL.maxStaggerWindow / window : 1;
  const offsets = [0];
  for (const gap of gaps) offsets.push(offsets[offsets.length - 1]! + gap * scale);

  return rank.map((position) => Number((base + offsets[position]!).toFixed(3)));
}

/** Column heights packer used by masonry. */
function shortestColumn(heights: number[]): number {
  let best = 0;
  for (let index = 1; index < heights.length; index += 1) {
    if (heights[index]! < heights[best]! - 0.5) best = index;
  }
  return best;
}

/**
 * Resolve a layout into positioned slots.
 *
 * Coordinates are offsets from the layout center, matching how Motionly
 * elements are already positioned (`center` + `x`/`y`).
 */
export function resolveLayout(spec: LayoutSpec): LayoutSlot[] {
  const definition = definitions[spec.type];
  const count = Math.max(0, Math.floor(spec.count));
  if (!count) return [];
  const frameWidth = spec.width ?? DEFAULT_FRAME.width;
  const frameHeight = spec.height ?? DEFAULT_FRAME.height;
  const gap = spec.gap ?? definition.defaults.gap;
  const columns = Math.max(1, spec.columns ?? definition.defaults.columns);
  const delays = orderedDelays(spec, count);
  const slots: LayoutSlot[] = [];
  const push = (
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    emphasis: LayoutSlot['emphasis']
  ) => {
    slots[index] = {
      index,
      x: snap(x),
      y: snap(y),
      width: Math.max(RHYTHM, snap(width)),
      height: Math.max(RHYTHM, snap(height)),
      delay: delays[index]!,
      emphasis,
      travel: ARRIVAL[emphasis].travel,
      duration: ARRIVAL[emphasis].duration,
    };
  };

  if (spec.type === 'heroLayout') {
    const itemWidth = spec.itemWidth ?? frameWidth * 0.72;
    const focalHeight = spec.itemHeight ?? frameHeight * (count > 1 ? 0.58 : 0.8);
    const restHeight =
      (frameHeight - focalHeight - gap * Math.max(0, count - 1)) / Math.max(1, count - 1);
    let cursor = -frameHeight / 2;
    for (let index = 0; index < count; index += 1) {
      const height = index === 0 ? focalHeight : Math.max(RHYTHM, restHeight);
      push(
        index,
        0,
        cursor + height / 2,
        index === 0 ? itemWidth : itemWidth * 0.78,
        height,
        index === 0 ? 'focal' : 'support'
      );
      cursor += height + gap;
    }
    return slots;
  }

  if (spec.type === 'splitLayout' || spec.type === 'comparisonLayout') {
    const half = (frameWidth - gap) / 2;
    const rows = Math.ceil(count / 2);
    const rowHeight = (frameHeight - gap * (rows - 1)) / rows;
    for (let index = 0; index < count; index += 1) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      push(
        index,
        column === 0 ? -(gap / 2 + half / 2) : gap / 2 + half / 2,
        -frameHeight / 2 + rowHeight / 2 + row * (rowHeight + gap),
        spec.itemWidth ?? half,
        spec.itemHeight ?? rowHeight,
        spec.type === 'comparisonLayout' ? 'focal' : column === 1 ? 'focal' : 'support'
      );
    }
    return slots;
  }

  if (spec.type === 'bentoGrid') {
    const rows = Math.max(2, Math.ceil((count + 3) / columns));
    const cellWidth = (frameWidth - gap * (columns - 1)) / columns;
    const cellHeight = (frameHeight - gap * (rows - 1)) / rows;
    const left = -frameWidth / 2;
    const top = -frameHeight / 2;
    const occupied = new Set<string>();
    const focalSpan = count >= 4 ? 2 : 1;
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      const span = index === 0 ? focalSpan : 1;
      let column = 0;
      let row = 0;
      // First free cell that fits the span, scanning in reading order.
      for (;;) {
        column = cursor % columns;
        row = Math.floor(cursor / columns);
        const fits =
          column + span <= columns &&
          [...Array(span).keys()].every((dx) =>
            [...Array(span).keys()].every((dy) => !occupied.has(`${column + dx}:${row + dy}`))
          );
        if (fits) break;
        cursor += 1;
      }
      for (const dx of [...Array(span).keys()])
        for (const dy of [...Array(span).keys()]) occupied.add(`${column + dx}:${row + dy}`);
      const width = cellWidth * span + gap * (span - 1);
      const height = cellHeight * span + gap * (span - 1);
      push(
        index,
        left + column * (cellWidth + gap) + width / 2,
        top + row * (cellHeight + gap) + height / 2,
        width,
        height,
        span > 1 ? 'focal' : 'support'
      );
      cursor += 1;
    }
    return slots;
  }

  if (spec.type === 'featureGrid' || spec.type === 'logoWall' || spec.type === 'gallery') {
    const perRow = spec.type === 'gallery' ? Math.min(columns, count) : columns;
    const rows = Math.ceil(count / perRow);
    const cellWidth = (frameWidth - gap * (perRow - 1)) / perRow;
    const cellHeight = (frameHeight - gap * (rows - 1)) / rows;
    for (let index = 0; index < count; index += 1) {
      const column = index % perRow;
      const row = Math.floor(index / perRow);
      const itemsInRow = Math.min(perRow, count - row * perRow);
      const rowWidth = itemsInRow * cellWidth + gap * (itemsInRow - 1);
      push(
        index,
        -rowWidth / 2 + column * (cellWidth + gap) + cellWidth / 2,
        -frameHeight / 2 + row * (cellHeight + gap) + cellHeight / 2,
        spec.itemWidth ?? cellWidth,
        spec.itemHeight ?? cellHeight * (spec.type === 'gallery' && row === 0 ? 1 : 0.9),
        spec.type === 'gallery' && row === 0 ? 'focal' : 'support'
      );
    }
    return slots;
  }

  if (spec.type === 'masonryGrid') {
    const cellWidth = (frameWidth - gap * (columns - 1)) / columns;
    const ratios = [1, 0.72, 0.86, 0.64];
    const heights = new Array(columns).fill(0);
    const baseHeight = frameHeight / Math.max(2, Math.ceil(count / columns) + 0.5);
    for (let index = 0; index < count; index += 1) {
      const column = shortestColumn(heights);
      const height = baseHeight * ratios[index % ratios.length]! * 1.6;
      push(
        index,
        -frameWidth / 2 + column * (cellWidth + gap) + cellWidth / 2,
        -frameHeight / 2 + heights[column]! + height / 2,
        spec.itemWidth ?? cellWidth,
        height,
        index === 0 ? 'focal' : 'support'
      );
      heights[column] = heights[column]! + height + gap;
    }
    return slots;
  }

  if (spec.type === 'deviceStack' || spec.type === 'carousel') {
    const center = (count - 1) / 2;
    const itemWidth =
      spec.itemWidth ?? frameWidth / (count + (spec.type === 'deviceStack' ? 1.6 : 0.6));
    const step = spec.type === 'deviceStack' ? itemWidth * 0.66 + gap * 0.25 : itemWidth + gap;
    for (let index = 0; index < count; index += 1) {
      const offset = index - center;
      const distance = Math.abs(offset);
      const scale = spec.type === 'deviceStack' ? 1 - distance * 0.12 : 1 - distance * 0.16;
      push(
        index,
        offset * step,
        spec.type === 'deviceStack' ? distance * 26 : 0,
        itemWidth * Math.max(0.55, scale),
        (spec.itemHeight ?? frameHeight * 0.86) * Math.max(0.55, scale),
        distance < 0.51 ? 'focal' : 'support'
      );
    }
    return slots;
  }

  if (spec.type === 'timelineLayout') {
    const itemWidth = spec.itemWidth ?? (frameWidth - gap * (count - 1)) / count;
    for (let index = 0; index < count; index += 1) {
      push(
        index,
        -frameWidth / 2 + index * (itemWidth + gap) + itemWidth / 2,
        0,
        itemWidth,
        spec.itemHeight ?? frameHeight * 0.42,
        index === 0 ? 'focal' : 'support'
      );
    }
    return slots;
  }

  // floatingCollage — fixed depth pattern, deterministic by design.
  const pattern: Array<[number, number, number]> = [
    [-0.3, -0.22, 1],
    [0.28, -0.12, 0.86],
    [-0.06, 0.24, 0.94],
    [0.36, 0.28, 0.72],
    [-0.38, 0.14, 0.78],
    [0.08, -0.32, 0.8],
    [-0.18, 0.36, 0.68],
    [0.42, -0.34, 0.64],
    [-0.44, -0.04, 0.7],
  ];
  const baseWidth = spec.itemWidth ?? frameWidth * 0.3;
  for (let index = 0; index < count; index += 1) {
    const [fx, fy, scale] = pattern[index % pattern.length]!;
    push(
      index,
      fx * frameWidth,
      fy * frameHeight,
      baseWidth * scale,
      (spec.itemHeight ?? baseWidth * 0.66) * scale,
      scale >= 0.94 ? 'focal' : 'support'
    );
  }
  return slots;
}

/** Index of the focal slot, used for camera framing and focus moves. */
export function focalSlot(slots: readonly LayoutSlot[]): LayoutSlot | undefined {
  return slots.find((slot) => slot.emphasis === 'focal') ?? slots[0];
}
