/**
 * Scene graph builder
 * Converts AST into normalized scene structure
 */

import {
  normalizeCamera,
  normalizeCanvas,
  normalizeProperties,
  normalizeProperty,
  defaultElementProperties,
} from './properties';
import { applyAnimationPresets, cameraPresetAnimations } from '../animation-library/presets.js';
import { distributeSequenceDelay, normalizeHierarchy } from '../core/stagger';
import type {
  Scene,
  Animation,
  Sequence,
  Asset,
  Element,
  AssetType,
  Layer,
  Keyframe,
  ElementKind,
  Track,
  TrackContent,
  TrackRole,
  SharedTransition,
} from '../types/scene';
import type { ProgramNode, AnimationNode } from '../types/parser';
import { assetFilename } from '../assets/asset-resolution';
import { compileSemanticProgram } from '../semantic/compiler';

const LAYER_ORDER: Record<Layer, number> = {
  background: 0,
  hero: 10,
  supporting: 20,
  content: 30,
  details: 40,
  text: 50,
  effects: 60,
};

/**
 * Build scene graph from parsed AST
 */
export function buildSceneGraph(sourceAst: ProgramNode): Scene {
  const semantic = compileSemanticProgram(sourceAst);
  const ast = semantic.program;
  const canvasNode = ast.body.find((node) => node.type === 'Canvas');
  const cameraNode = ast.body.find((node) => node.type === 'Camera');
  const audioNode = ast.body.find((node) => node.type === 'Audio');

  const canvas = normalizeCanvas(
    canvasNode && 'properties' in canvasNode ? canvasNode.properties : {}
  );
  const camera = normalizeCamera(
    cameraNode && 'properties' in cameraNode ? cameraNode.properties : {}
  );
  const sequences = buildSequences(ast);

  const imports = new Map<string, Asset>();
  const elements: Element[] = [];
  const animations: Animation[] = [];
  const clips: import('../types/scene').Clip[] = [];
  const transitions: SharedTransition[] = [];
  const authoredLayers = new Set<string>();

  for (const node of ast.body) {
    if (node.type === 'Import') {
      imports.set(node.name, {
        name: node.name,
        path: node.path,
        type: assetType(node.path),
      });
    }

    if (node.type === 'Element') {
      if (node.kind === 'transition') {
        transitions.push({
          id: node.name,
          from: String(node.properties['from'] ?? ''),
          to: String(node.properties['to'] ?? ''),
          at: normalizeProperty('at', node.properties['at'] ?? 0) as number,
          duration: normalizeProperty('duration', node.properties['duration'] ?? 0.8) as number,
          easing: String(node.properties['easing'] ?? 'power3.inOut'),
        });
        continue;
      }
      const assetName =
        node.kind === 'asset'
          ? node.name
          : node.kind === 'image' || node.kind === 'svgpart'
            ? String(node.properties['source'] ?? '')
            : null;
      const asset = assetName ? (imports.get(assetName) ?? null) : null;
      const normalized = normalizeProperties(node.properties);
      if (node.properties['layer'] !== undefined) authoredLayers.add(node.name);
      if (node.kind === 'path' && normalized['d'] !== undefined) {
        normalized['path'] = normalized['d'];
      }
      elements.push({
        id: node.name,
        kind: node.kind as ElementKind,
        assetName: asset ? assetName : null,
        asset,
        properties: {
          ...defaultElementProperties(node.kind as ElementKind),
          ...normalized,
        },
      });
    }

    if (node.type === 'Animation') {
      animations.push(normalizeAnimation(node, sequences));
    }

    if (node.type === 'Clip') {
      const asset = imports.get(node.assetName) ?? null;
      const props = normalizeProperties(node.properties);
      clips.push({
        id: `clip_${node.assetName}_${clips.length}`,
        assetName: node.assetName,
        asset,
        track: props['track'] ?? 1,
        start: normalizeProperty('start', props['start'] ?? 0) as number,
        duration: normalizeProperty('duration', props['duration'] ?? 5) as number,
        trimIn: normalizeProperty('trimIn', props['trimIn'] ?? 0) as number,
        trimOut: normalizeProperty('trimOut', props['trimOut'] ?? 0) as number,
        transitionIn: props['transitionIn'] === 'crossfade' ? 'crossfade' : undefined,
        transitionInDuration: normalizeProperty(
          'transitionInDuration',
          props['transitionInDuration'] ?? 0
        ) as number,
        transitionOut: props['transitionOut'] === 'crossfade' ? 'crossfade' : undefined,
        transitionOutDuration: normalizeProperty(
          'transitionOutDuration',
          props['transitionOutDuration'] ?? 0
        ) as number,
        volume: props['volume'] !== undefined ? Number(props['volume']) : 1.0,
        mute: Boolean(props['mute'] ?? false),
        sourceOrder: clips.length,
      });
    }
  }

  const elementsById = new Map(elements.map((element) => [element.id, element]));
  for (let pass = 0; pass < 64; pass += 1) {
    let changed = false;
    for (const element of elements) {
      if (authoredLayers.has(element.id)) continue;
      const parent = elementsById.get(String(element.properties.parent ?? ''));
      if (!parent) continue;
      const nextLayer =
        parent.kind === 'scene' || parent.kind === 'group'
          ? parent.properties.layer
          : element.kind === 'overlay'
            ? 'details'
            : element.properties.layer;
      if (element.properties.layer !== nextLayer) {
        element.properties.layer = nextLayer;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Add camera animations from camera node
  if (cameraNode && 'properties' in cameraNode && cameraNode.properties['cameraAnimation']) {
    animations.push(...cameraPresetAnimations(cameraNode.properties['cameraAnimation'] as string));
  }

  const tracks = buildTracks(ast, clips, elements, Boolean(audioNode));

  const scene = applyAnimationPresets({
    canvas,
    camera,
    theme: semantic.theme,
    sequences: Array.from(sequences.values()),
    imports: Array.from(imports.values()),
    elements,
    animations,
    components: semantic.components,
    relationships: semantic.relationships,
    tracks,
    clips,
    transitions,
    beats: semantic.beats,
    audio: audioNode && 'path' in audioNode ? audioNode.path : undefined,
    audioStart: audioNode
      ? (normalizeProperty('start', audioNode.properties['start'] ?? 0) as number)
      : 0,
  });

  validateElementMasks(scene.elements);
  validateElementFollowThrough(scene.elements);
  validateElementMorphTargets(scene.elements, scene.imports);
  validateHierarchy(scene.elements, scene.transitions);

  // Sort elements by layer
  scene.elements.sort(
    (a: Element, b: Element) =>
      layerRank(a.properties.layer as Layer) - layerRank(b.properties.layer as Layer)
  );

  return scene;
}

function validateHierarchy(elements: Element[], transitions: SharedTransition[]): void {
  const byId = new Map(elements.map((element) => [element.id, element]));
  if (byId.size !== elements.length) throw new Error('Element IDs must be unique.');
  for (const element of elements) {
    const parent = String(element.properties.parent ?? '');
    if (!parent) continue;
    if (!byId.has(parent))
      throw new Error(`Element "${element.id}" references missing parent "${parent}".`);
    const seen = new Set([element.id]);
    let cursor = parent;
    while (cursor) {
      if (seen.has(cursor)) throw new Error(`Hierarchy cycle involving "${element.id}".`);
      seen.add(cursor);
      cursor = String(byId.get(cursor)?.properties.parent ?? '');
      if (seen.size > 64) throw new Error(`Hierarchy for "${element.id}" exceeds 64 levels.`);
    }
  }
  for (const transition of transitions) {
    if (!transition.from || !byId.has(transition.from)) {
      throw new Error(
        `Transition "${transition.id}" references missing source "${transition.from}".`
      );
    }
    if (!transition.to || !byId.has(transition.to)) {
      throw new Error(
        `Transition "${transition.id}" references missing destination "${transition.to}".`
      );
    }
    if (!(transition.duration > 0))
      throw new Error(`Transition "${transition.id}" needs a positive duration.`);
  }
}

const TRACK_ROLES = new Set<TrackRole>(['main', 'overlay', 'audio']);
const TRACK_CONTENT = new Set<TrackContent>([
  'primary',
  'video',
  'image',
  'text',
  'effect',
  'audio',
  'mixed',
]);

function buildTracks(
  ast: ProgramNode,
  clips: import('../types/scene').Clip[],
  elements: Element[],
  hasLegacyAudio: boolean
): Track[] {
  const tracks: Track[] = [];
  const ids = new Set<string>();
  let declaredMain = '';

  for (const node of ast.body.filter((item) => item.type === 'Track')) {
    if (node.type !== 'Track') continue;
    if (ids.has(node.name)) throw new Error(`Duplicate track declaration "${node.name}".`);
    const role = String(node.properties['role'] ?? 'overlay') as TrackRole;
    if (!TRACK_ROLES.has(role)) {
      throw new Error(`Track "${node.name}" has unsupported role "${role}".`);
    }
    if (role === 'main' && declaredMain) {
      throw new Error(`Only one main track is allowed ("${declaredMain}" and "${node.name}").`);
    }
    if (role === 'main') declaredMain = node.name;
    const fallbackContent: TrackContent =
      role === 'main' ? 'primary' : role === 'audio' ? 'audio' : 'mixed';
    const content = String(node.properties['content'] ?? fallbackContent) as TrackContent;
    if (!TRACK_CONTENT.has(content)) {
      throw new Error(`Track "${node.name}" has unsupported content "${content}".`);
    }
    if (role === 'audio' && content !== 'audio') {
      throw new Error(`Audio track "${node.name}" must use content audio.`);
    }
    ids.add(node.name);
    tracks.push({
      id: node.name,
      label: String(node.properties['label'] ?? defaultTrackLabel(role, tracks.length)),
      role,
      content,
      hidden: Boolean(normalizeProperty('hidden', node.properties['hidden'] ?? false)),
      muted: Boolean(normalizeProperty('muted', node.properties['muted'] ?? false)),
      order: Number(node.properties['order'] ?? tracks.length),
      declared: true,
    });
  }

  const ensureSynthetic = (id: string, role: TrackRole, content: TrackContent, label: string) => {
    const existing = tracks.find((track) => track.id === id);
    if (existing) return existing;
    const track: Track = {
      id,
      label,
      role,
      content,
      hidden: false,
      muted: false,
      order: tracks.length,
      declared: false,
    };
    tracks.push(track);
    ids.add(id);
    return track;
  };

  for (const clip of clips) {
    const id = String(clip.track);
    const content: TrackContent = clip.asset?.type === 'video' ? 'video' : 'image';
    const hasMain = tracks.some((track) => track.role === 'main');
    const role: TrackRole = !hasMain && (id === '1' || id === 'main') ? 'main' : 'overlay';
    ensureSynthetic(
      id,
      role,
      role === 'main' ? 'primary' : content,
      role === 'main' ? 'Main Track' : `${content === 'video' ? 'Video' : 'Image'} Overlay`
    );
  }

  for (const element of elements) {
    const trackId = (element.properties as unknown as Record<string, unknown>)['track'];
    if (trackId === undefined || trackId === null || trackId === '') continue;
    const content: TrackContent =
      element.kind === 'text'
        ? 'text'
        : element.kind === 'effect' || element.kind === 'overlay'
          ? 'effect'
          : element.asset?.type === 'video'
            ? 'video'
            : 'image';
    ensureSynthetic(String(trackId), 'overlay', content, defaultContentLabel(content));
  }

  if (!tracks.some((track) => track.role === 'main')) {
    tracks.unshift({
      id: 'main',
      label: 'Main Track',
      role: 'main',
      content: 'primary',
      hidden: false,
      muted: false,
      order: -1,
      declared: false,
    });
  }
  if (hasLegacyAudio && !tracks.some((track) => track.role === 'audio')) {
    ensureSynthetic('legacy-audio', 'audio', 'audio', 'Audio');
  }

  return tracks.sort((left, right) => left.order - right.order);
}

function defaultTrackLabel(role: TrackRole, index: number): string {
  if (role === 'main') return 'Main Track';
  if (role === 'audio') return index > 0 ? `Audio ${index + 1}` : 'Audio';
  return `Overlay ${index + 1}`;
}

function defaultContentLabel(content: TrackContent): string {
  if (content === 'text') return 'Text Overlay';
  if (content === 'video') return 'Video Overlay';
  if (content === 'image') return 'Image Overlay';
  if (content === 'effect') return 'Effects Overlay';
  if (content === 'audio') return 'Audio';
  return 'Overlay';
}

/**
 * Normalize animation node from AST
 */
function normalizeAnimation(node: AnimationNode, sequences: Map<string, Sequence>): Animation {
  const sequenceDelay = sequenceOffset(node, sequences);

  return {
    target: node.target,
    from: normalizeProperties(node.from ?? {}),
    to: normalizeProperties(node.to ?? {}),
    keyframes: (node.keyframes ?? []).map((frame): Keyframe => ({
      offset: frame.offset,
      properties: normalizeProperties(frame.properties),
      ...(frame.easing ? { easing: String(frame.easing) } : {}),
    })),
    delay: (normalizeProperty('delay', node.delay ?? 0) as number) + sequenceDelay,
    duration: normalizeProperty('duration', node.duration ?? 1) as number,
    easing: String(node.easing ?? 'soft'),
    sequence: node.sequence,
    ...(node.repeat !== undefined ? { repeat: normalizeRepeat(node.repeat) } : {}),
    ...(node.repeatType === 'yoyo' || node.repeatType === 'loop'
      ? { repeatType: node.repeatType }
      : {}),
  };
}

/**
 * Normalize a `repeat` value from source ("infinite" or a count) into
 * the Animation.repeat shape.
 */
function normalizeRepeat(value: number | string): number | 'infinite' {
  if (typeof value === 'number') return value;
  if (String(value).trim() === 'infinite') return 'infinite';
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 1;
}

/**
 * Build sequence definitions from AST
 */
function buildSequences(ast: ProgramNode): Map<string, Sequence> {
  const sequences = new Map<string, Sequence>();

  for (const node of ast.body.filter((item) => item.type === 'Sequence')) {
    if (node.type !== 'Sequence') continue;

    const delay = normalizeProperty('delay', node.properties['delay'] ?? 0) as number;
    const gap = normalizeProperty('delay', node.properties['gap'] ?? 0) as number;
    const items = String(node.properties['items'] ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const hierarchy = normalizeHierarchy(node.properties['hierarchy']);

    sequences.set(node.name, { name: node.name, delay, gap, items, hierarchy });
  }

  return sequences;
}

/**
 * Calculate sequence offset for an animation
 */
function sequenceOffset(node: AnimationNode, sequences: Map<string, Sequence>): number {
  if (!node.sequence) return 0;

  const sequence = sequences.get(String(node.sequence));
  if (!sequence) return 0;

  const index = sequence.items.indexOf(node.target);
  return distributeSequenceDelay(
    sequence.delay,
    sequence.gap,
    Math.max(0, index),
    sequence.items.length,
    sequence.hierarchy
  );
}

/**
 * Get numeric rank for a layer (for sorting)
 */
function layerRank(layer: Layer): number {
  return LAYER_ORDER[layer] ?? LAYER_ORDER.content;
}

/**
 * Determine asset type from file path
 */
export function assetType(path: string): AssetType {
  const lower = path.toLowerCase();
  const filename = assetFilename(path).toLowerCase();
  const pathname = lower.split(/[?#]/, 1)[0] ?? lower;
  if (lower.startsWith('data:video/') || /\.(mp4|webm|mov|m4v)$/.test(filename || pathname))
    return 'video';
  if (
    lower.startsWith('data:application/zip+dotlottie') ||
    (filename || pathname).endsWith('.lottie')
  )
    return 'lottie';
  if (lower.startsWith('data:image/svg+xml') || (filename || pathname).endsWith('.svg'))
    return 'svg';
  return 'image';
}

/** Validate serializable layer-mask references before rendering. */
export function validateElementMasks(elements: Element[]): void {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const element of elements) {
    const mask = String((element.properties as unknown as Record<string, unknown>)['mask'] ?? '');
    if (!mask || mask === 'none') continue;
    if (mask === element.id) throw new Error(`Layer "${element.id}" cannot mask itself`);
    const source = byId.get(mask);
    if (!source)
      throw new Error(`Mask layer "${mask}" referenced by "${element.id}" does not exist`);
    const sourceMask = String(
      (source.properties as unknown as Record<string, unknown>)['mask'] ?? ''
    );
    if (sourceMask && sourceMask !== 'none') {
      throw new Error(`Nested layer masks are not supported: "${element.id}" -> "${mask}"`);
    }
  }
}

/** Validate serializable followThrough (secondary motion) references before rendering. */
export function validateElementFollowThrough(elements: Element[]): void {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const element of elements) {
    const parentId = String(
      (element.properties as unknown as Record<string, unknown>)['followThrough'] ?? ''
    );
    if (!parentId || parentId === 'none') continue;
    if (parentId === element.id) {
      throw new Error(`Layer "${element.id}" cannot follow through on itself`);
    }
    const parent = byId.get(parentId);
    if (!parent) {
      throw new Error(
        `followThrough parent "${parentId}" referenced by "${element.id}" does not exist`
      );
    }
    const parentFollowThrough = String(
      (parent.properties as unknown as Record<string, unknown>)['followThrough'] ?? ''
    );
    if (parentFollowThrough && parentFollowThrough !== 'none') {
      throw new Error(
        `Chained followThrough is not supported: "${element.id}" -> "${parentId}" -> "${parentFollowThrough}"`
      );
    }
  }
}

/** Validate deterministic SVG morph targets against imported asset aliases. */
export function validateElementMorphTargets(elements: Element[], imports: Asset[]): void {
  const imported = new Set(imports.map((asset) => asset.name));
  for (const element of elements) {
    const morphTo = String(
      (element.properties as unknown as Record<string, unknown>)['morphTo'] ?? ''
    );
    if (!morphTo || morphTo === 'none') continue;
    if (!imported.has(morphTo)) {
      throw new Error(`Morph target "${morphTo}" referenced by "${element.id}" is not imported`);
    }
    if (morphTo === element.assetName) {
      throw new Error(`Layer "${element.id}" cannot morph to its own asset`);
    }
  }
}
