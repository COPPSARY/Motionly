/**
 * Motion-system lowering.
 *
 * Runs before archetypes and components and rewrites the three new block kinds
 * into ordinary AST nodes:
 *
 * - `beat`     → camera moves and planned transitions; no scene root, so the
 *                composition persists and evolves instead of being cleared.
 * - `layout`   → a `group` root plus resolved position, size, and stagger on
 *                every child that names it as `parent`.
 * - `showcase` → a `group` root plus device geometry, screen, real media, copy,
 *                and its own entrance / idle / push motion.
 *
 * The pass is a pure AST → AST transform. Nothing new reaches the scene graph,
 * the evaluator, or the renderer: only `group`, `overlay`, `image`, `text`,
 * `transition`, and `Animation` nodes come out the other side.
 */

import { parseTime } from '../core/units';
import type { ASTNode, AnimationNode, ElementNode, ProgramNode } from '../types/parser';
import {
  ARRIVAL,
  BEAT_ROUTES,
  beatStarts,
  isBeatRoute,
  isBeatTransitionKind,
  isLayoutType,
  isShowcaseType,
  layoutDefinition,
  lowerBeats,
  planBeats,
  resolveLayout,
  buildShowcase,
  showcaseDefinition,
  type BeatPlan,
  type BeatSpec,
  type CameraFraming,
  type LayoutSlot,
  type LayoutSpec,
} from '../motion-system';
import {
  beatRegistry,
  layoutRegistry,
  showcaseRegistry,
  validateCatalogProperties,
  type MotionTheme,
} from './catalog';
import { isSemanticComponentType, vectorDefinition } from './vector-registry';

export interface MotionSystemLowering {
  program: ProgramNode;
  beats: BeatPlan[];
}

/** Kinds whose own compiler already builds an entrance from a `delay`. */
const SELF_TIMED = new Set(['component', 'showcase', 'archetype']);

export function lowerMotionSystem(program: ProgramNode, theme: MotionTheme): MotionSystemLowering {
  const beatNodes = elementsOfKind(program, 'beat');
  const layoutNodes = elementsOfKind(program, 'layout');
  const showcaseNodes = elementsOfKind(program, 'showcase');
  if (!beatNodes.length && !layoutNodes.length && !showcaseNodes.length) {
    return { program, beats: [] };
  }

  const camera = resolveCameraFraming(program);
  const options = { canvasDuration: canvasDuration(program), camera };
  // A beat's route depends on how much content it carries, so count attachments
  // before planning.
  const attachments = new Map<string, number>();
  for (const node of [...layoutNodes, ...showcaseNodes, ...otherElements(program)]) {
    const beat = String(node.properties['beat'] ?? '');
    if (beat) attachments.set(beat, (attachments.get(beat) ?? 0) + 1);
  }
  const beats = planBeats(
    beatNodes.map((node) => beatSpec(node, attachments.get(node.name) ?? 0)),
    options
  );
  const starts = beatStarts(beats);
  for (const node of [...layoutNodes, ...showcaseNodes, ...otherElements(program)]) {
    const beat = String(node.properties['beat'] ?? '');
    if (beat && !starts.has(beat)) {
      throw new Error(`Block "${node.name}" references missing beat "${beat}".`);
    }
  }

  const slotsByLayout = resolveLayoutSlots(program, layoutNodes, starts);
  const body: ASTNode[] = [];

  for (const node of program.body) {
    if (node.type !== 'Element') {
      body.push(node);
      continue;
    }
    if (node.kind === 'beat') continue;

    if (node.kind === 'layout') {
      body.push(layoutRoot(node, starts));
      continue;
    }

    if (node.kind === 'showcase') {
      const composition = lowerShowcase(node, theme, starts, slotsByLayout);
      body.push(composition.root, ...composition.children, ...composition.animations);
      continue;
    }

    const slot = takeSlot(node, slotsByLayout);
    const beatStart = beatDelay(node, starts);
    if (!slot && beatStart === undefined) {
      body.push(node);
      continue;
    }
    body.push(...applyComposition(node, slot, beatStart));
  }

  body.push(...lowerBeats(beats, options));
  return { program: { ...program, body }, beats };
}

function elementsOfKind(program: ProgramNode, kind: string): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode => node.type === 'Element' && node.kind === kind
  );
}

function otherElements(program: ProgramNode): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode =>
      node.type === 'Element' && !['beat', 'layout', 'showcase', 'theme'].includes(node.kind)
  );
}

function canvasDuration(program: ProgramNode): number {
  const canvas = program.body.find((node) => node.type === 'Canvas');
  if (!canvas || !('properties' in canvas)) return 10;
  return timeValue(canvas.properties['duration'], 10);
}

function resolveCameraFraming(program: ProgramNode): CameraFraming {
  const camera = program.body.find((node) => node.type === 'Camera');
  const properties = camera && 'properties' in camera ? camera.properties : {};
  return {
    x: numberValue(properties['x'], 0),
    y: numberValue(properties['y'], 0),
    zoom: numberValue(properties['zoom'], 1),
  };
}

function beatSpec(node: ElementNode, attachments: number): BeatSpec {
  validateCatalogProperties(beatRegistry()[0]!, node.properties);
  const transition = String(node.properties['transition'] ?? '');
  if (transition && !isBeatTransitionKind(transition)) {
    throw new Error(
      `Beat "${node.name}" has unsupported transition "${transition}". Available: sharedElement, objectMorph, layoutMorph, cameraMove, continuous, cut.`
    );
  }
  const route = String(node.properties['route'] ?? '');
  if (route && !isBeatRoute(route)) {
    throw new Error(
      `Beat "${node.name}" has unsupported route "${route}". Available: ${BEAT_ROUTES.join(', ')}.`
    );
  }
  return {
    name: node.name,
    attachments,
    ...(route ? { route } : {}),
    ...(node.properties['start'] !== undefined
      ? { start: timeValue(node.properties['start'], 0) }
      : {}),
    ...(node.properties['duration'] !== undefined
      ? { duration: timeValue(node.properties['duration'], 0) }
      : {}),
    ...(node.properties['focus'] !== undefined ? { focus: String(node.properties['focus']) } : {}),
    ...(node.properties['zoom'] !== undefined
      ? { zoom: numberValue(node.properties['zoom'], 1) }
      : {}),
    ...(node.properties['cameraX'] !== undefined
      ? { cameraX: numberValue(node.properties['cameraX'], 0) }
      : {}),
    ...(node.properties['cameraY'] !== undefined
      ? { cameraY: numberValue(node.properties['cameraY'], 0) }
      : {}),
    ...(transition ? { transition } : {}),
    ...(node.properties['from'] !== undefined ? { from: String(node.properties['from']) } : {}),
    ...(node.properties['to'] !== undefined ? { to: String(node.properties['to']) } : {}),
    ...(node.properties['transitionDuration'] !== undefined
      ? { transitionDuration: timeValue(node.properties['transitionDuration'], 0.8) }
      : {}),
    ...(node.properties['easing'] !== undefined
      ? { easing: String(node.properties['easing']) }
      : {}),
    ...(node.properties['label'] !== undefined ? { label: String(node.properties['label']) } : {}),
  } as BeatSpec;
}

/**
 * Resolve every layout into a queue of slots, consumed in source order by the
 * children that name the layout as their parent.
 */
function resolveLayoutSlots(
  program: ProgramNode,
  layouts: readonly ElementNode[],
  starts: Map<string, number>
): Map<string, LayoutSlot[]> {
  const slots = new Map<string, LayoutSlot[]>();
  for (const node of layouts) {
    const type = String(node.properties['type'] ?? '');
    if (!isLayoutType(type)) {
      throw new Error(
        `Layout "${node.name}" has unsupported type "${type || 'missing'}". Available: ${layoutRegistry()
          .map((entry) => entry.name)
          .join(', ')}.`
      );
    }
    const entry = layoutRegistry().find((candidate) => candidate.name === type)!;
    validateCatalogProperties(entry, node.properties);
    const children = program.body.filter(
      (candidate): candidate is ElementNode =>
        candidate.type === 'Element' &&
        String(candidate.properties['parent'] ?? '') === node.name &&
        candidate.kind !== 'beat'
    );
    const definition = layoutDefinition(type);
    if (children.length && children.length < definition.items.min) {
      throw new Error(
        `Layout "${node.name}" (${type}) needs at least ${definition.items.min} children, found ${children.length}.`
      );
    }
    if (children.length > definition.items.max) {
      throw new Error(
        `Layout "${node.name}" (${type}) supports at most ${definition.items.max} children, found ${children.length}.`
      );
    }
    const base = (beatDelay(node, starts) ?? 0) + timeValue(node.properties['delay'], 0);
    const spec: LayoutSpec = {
      type,
      count: children.length,
      delay: base,
      ...optionalNumber('width', node.properties['width']),
      ...optionalNumber('height', node.properties['height']),
      ...optionalNumber('columns', node.properties['columns']),
      ...optionalNumber('gap', node.properties['gap']),
      ...optionalNumber('itemWidth', node.properties['itemWidth']),
      ...optionalNumber('itemHeight', node.properties['itemHeight']),
      ...(node.properties['stagger'] !== undefined
        ? { stagger: timeValue(node.properties['stagger'], 0.07) }
        : {}),
      ...(node.properties['order'] !== undefined
        ? { order: String(node.properties['order']) as LayoutSpec['order'] }
        : {}),
    };
    slots.set(node.name, resolveLayout(spec));
  }
  return slots;
}

function optionalNumber(key: string, value: unknown): Record<string, number> {
  if (value === undefined || value === null || value === '') return {};
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? { [key]: number } : {};
}

/** The layout block itself becomes a plain group, so parenting still resolves. */
function layoutRoot(node: ElementNode, starts: Map<string, number>): ElementNode {
  const properties = Object.fromEntries(
    Object.entries(node.properties).filter(
      ([key]) =>
        ![
          'type',
          'columns',
          'gap',
          'itemWidth',
          'itemHeight',
          'order',
          'stagger',
          'delay',
        ].includes(key)
    )
  );
  return {
    type: 'Element',
    kind: 'group',
    name: node.name,
    properties: {
      ...properties,
      center: node.properties['center'] ?? true,
      layer: node.properties['layer'] ?? 'content',
      x: numberValue(node.properties['x'], 0),
      y: numberValue(node.properties['y'], 0),
      layoutType: String(node.properties['type'] ?? ''),
      ...(starts.has(String(node.properties['beat'] ?? ''))
        ? { beat: String(node.properties['beat']) }
        : {}),
    },
  };
}

function takeSlot(
  node: ElementNode,
  slotsByLayout: Map<string, LayoutSlot[]>
): LayoutSlot | undefined {
  const parent = String(node.properties['parent'] ?? '');
  const queue = parent ? slotsByLayout.get(parent) : undefined;
  return queue?.shift();
}

function beatDelay(node: ElementNode, starts: Map<string, number>): number | undefined {
  const beat = String(node.properties['beat'] ?? '');
  return beat ? starts.get(beat) : undefined;
}

/**
 * Merge resolved composition onto one child.
 *
 * Authored values always win — a layout fills the gaps, it never overrides an
 * explicit decision. Blocks with their own entrance choreography receive a
 * `delay`; everything else gets a generated staggered entrance, which is the
 * motion the layout owns.
 */
function applyComposition(
  node: ElementNode,
  slot: LayoutSlot | undefined,
  beatStart: number | undefined
): ASTNode[] {
  const properties = { ...node.properties };
  const authoredDelay = timeValue(properties['delay'], 0);
  const delay = (beatStart ?? 0) + (slot?.delay ?? 0) + authoredDelay;

  if (slot) {
    if (properties['x'] === undefined) properties['x'] = slot.x;
    if (properties['y'] === undefined) properties['y'] = slot.y;
    if (properties['rotation'] === undefined && slot.rotation) {
      properties['rotation'] = slot.rotation;
    }
    if (properties['width'] === undefined) properties['width'] = fitWidth(node, slot);
    if (properties['height'] === undefined && acceptsHeight(node.kind)) {
      properties['height'] = slot.height;
    }
    if (properties['center'] === undefined && node.kind !== 'overlay') properties['center'] = true;
    properties['layoutEmphasis'] = slot.emphasis;
  }

  if (SELF_TIMED.has(node.kind)) {
    properties['delay'] = `${round(delay)}s`;
    const lowered = { ...node, properties };
    return slot && node.kind === 'component'
      ? [lowered, arrival(node.name, properties, slot, round(delay))]
      : [lowered];
  }

  const authored = Boolean(
    properties['animation'] || properties['textAnimation'] || properties['backgroundEffect']
  );
  if (authored) {
    for (const key of ['animation', 'textAnimation', 'backgroundEffect']) {
      if (properties[key] !== undefined) {
        properties[key] = offsetPresetDelay(properties[key], delay);
      }
    }
    return [{ ...node, properties }];
  }
  if (!slot && beatStart === undefined) {
    return [{ ...node, properties }];
  }

  return [{ ...node, properties }, arrival(node.name, properties, slot, round(delay))];
}

function offsetPresetDelay(value: unknown, offset: number): string {
  const source = String(value ?? '').trim();
  if (!source || offset === 0) return source;
  const open = source.indexOf('(');
  if (open < 0 || !source.endsWith(')')) return `${source}(delay ${round(offset)}s)`;
  const body = source.slice(open + 1, -1).trim();
  const delay = /\bdelay\s+([^\s,)]+)/.exec(body);
  if (delay) {
    const resolved = timeValue(delay[1], 0) + offset;
    return `${source.slice(0, open + 1)}${body.replace(delay[0], `delay ${round(resolved)}s`)})`;
  }
  return `${source.slice(0, open + 1)}delay ${round(offset)}s${body ? ` ${body}` : ''})`;
}

/**
 * Build one arrival.
 *
 * Two doctrine rules are expressed here. Opacity is **binary**: it snaps on
 * inside the first frame instead of fading, because a fade fights the snap of
 * the motion carrying it. And travel and duration are **weight-scaled** from the
 * slot, so a focal tile arrives with more presence than its support.
 *
 * The reveal is a keyframe step rather than a `from`/`to` tween because the
 * evaluator needs a zero-opacity start value to keep the element hidden before
 * its delay.
 */
function arrival(
  target: string,
  properties: Record<string, unknown>,
  slot: LayoutSlot | undefined,
  delay: number
): AnimationNode {
  const y = numberValue(properties['y'], 0);
  const rotation = numberValue(properties['rotation'], 0);
  const travel = slot?.travel ?? ARRIVAL.support.travel;
  const duration = slot?.duration ?? ARRIVAL.support.duration;
  properties['opacity'] = properties['opacity'] ?? 0;
  // One frame at 60fps, expressed as a fraction of this arrival's duration.
  const reveal = Math.min(0.08, 1 / 60 / duration);
  return {
    type: 'Animation',
    target,
    from: {},
    to: {},
    keyframes: [
      {
        offset: 0,
        properties: {
          opacity: 0,
          y: round(y + travel),
          rotation: round(rotation * 1.8),
        },
      },
      {
        offset: Number(reveal.toFixed(4)),
        properties: { opacity: 1, y: round(y + travel), rotation: round(rotation * 1.8) },
      },
      { offset: 1, properties: { opacity: 1, y: round(y), rotation: round(rotation) } },
    ],
    delay,
    duration,
    easing: ARRIVAL.easing,
  };
}

function acceptsHeight(kind: string): boolean {
  return kind === 'overlay' || kind === 'group' || kind === 'text' || kind === 'scene';
}

/**
 * Fit a child to its slot.
 *
 * Semantic components and showcases have a fixed aspect ratio, so filling the
 * slot width would push them out the bottom of the tile. They are fitted inside
 * the slot instead; everything else takes the slot width.
 */
function fitWidth(node: ElementNode, slot: LayoutSlot): number {
  const aspect = intrinsicAspect(node);
  if (!aspect) return slot.width;
  return Math.round(Math.min(slot.width, slot.height * aspect));
}

function intrinsicAspect(node: ElementNode): number | undefined {
  if (node.kind === 'component') {
    const type = String(node.properties['type'] ?? '').toLowerCase();
    if (!isSemanticComponentType(type)) return undefined;
    const definition = vectorDefinition(type);
    return definition.height ? definition.width / definition.height : undefined;
  }
  if (node.kind === 'showcase') {
    const type = String(node.properties['type'] ?? '');
    return isShowcaseType(type) ? showcaseDefinition(type).screenRatio : undefined;
  }
  return undefined;
}

/** Lower one `showcase` block into its complete composition. */
function lowerShowcase(
  node: ElementNode,
  theme: MotionTheme,
  starts: Map<string, number>,
  slotsByLayout: Map<string, LayoutSlot[]>
) {
  const type = String(node.properties['type'] ?? '');
  if (!isShowcaseType(type)) {
    throw new Error(
      `Showcase "${node.name}" has unsupported type "${type || 'missing'}". Available: ${showcaseRegistry()
        .map((entry) => entry.name)
        .join(', ')}.`
    );
  }
  const entry = showcaseRegistry().find((candidate) => candidate.name === type)!;
  validateCatalogProperties(entry, node.properties);
  const definition = showcaseDefinition(type);
  const slot = takeSlot(node, slotsByLayout);
  const delay =
    (beatDelay(node, starts) ?? 0) + (slot?.delay ?? 0) + timeValue(node.properties['delay'], 0);

  return buildShowcase({
    name: node.name,
    type,
    theme,
    x: numberValue(node.properties['x'], slot?.x ?? 0),
    y: numberValue(node.properties['y'], slot?.y ?? 0),
    width: numberValue(node.properties['width'], slot?.width ?? definition.defaults.width),
    ...(node.properties['media'] !== undefined ? { media: String(node.properties['media']) } : {}),
    ...(node.properties['headline'] !== undefined
      ? { headline: String(node.properties['headline']) }
      : {}),
    ...(node.properties['caption'] !== undefined
      ? { caption: String(node.properties['caption']) }
      : {}),
    ...(node.properties['label'] !== undefined ? { label: String(node.properties['label']) } : {}),
    accent: String(node.properties['accent'] ?? theme.accent),
    surface: String(node.properties['surface'] ?? theme.surface),
    delay: round(delay),
    duration: timeValue(node.properties['duration'], definition.defaults.duration),
    layer: String(node.properties['layer'] ?? 'hero'),
    ...(node.properties['parent'] !== undefined
      ? { parent: String(node.properties['parent']) }
      : {}),
    behaviors: String(node.properties['behavior'] ?? definition.defaults.behavior)
      .split(/[\s,]+/)
      .filter(Boolean),
    focusX: numberValue(node.properties['focusX'], 0.5),
    focusY: numberValue(node.properties['focusY'], 0.45),
  });
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number.parseFloat(String(value ?? fallback));
  return Number.isFinite(number) ? number : fallback;
}

function timeValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return parseTime(value as string | number);
  } catch {
    return fallback;
  }
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
