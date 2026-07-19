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
} from '../types/scene';
import type { ProgramNode, AnimationNode } from '../types/parser';
import { assetFilename } from '../assets/asset-resolution';

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
export function buildSceneGraph(ast: ProgramNode): Scene {
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

  for (const node of ast.body) {
    if (node.type === 'Import') {
      imports.set(node.name, {
        name: node.name,
        path: node.path,
        type: assetType(node.path),
      });
    }

    if (node.type === 'Element') {
      const assetName =
        node.kind === 'asset'
          ? node.name
          : node.kind === 'image'
            ? String(node.properties['source'] ?? '')
            : null;
      const asset = assetName ? (imports.get(assetName) ?? null) : null;
      const normalized = normalizeProperties(node.properties);
      elements.push({
        id: node.name,
        kind: node.kind as ElementKind,
        assetName: asset ? assetName : null,
        asset,
        properties: {
          ...defaultElementProperties(node.kind as ElementKind),
          ...normalized,
          ...(node.kind === 'overlay' && normalized['parent'] && !node.properties['layer']
            ? { layer: 'details' }
            : {}),
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

  // Add camera animations from camera node
  if (cameraNode && 'properties' in cameraNode && cameraNode.properties['cameraAnimation']) {
    animations.push(...cameraPresetAnimations(cameraNode.properties['cameraAnimation'] as string));
  }

  const tracks = buildTracks(ast, clips, elements, Boolean(audioNode));

  const scene = applyAnimationPresets({
    canvas,
    camera,
    sequences: Array.from(sequences.values()),
    imports: Array.from(imports.values()),
    elements,
    animations,
    tracks,
    clips,
    audio: audioNode && 'path' in audioNode ? audioNode.path : undefined,
    audioStart: audioNode
      ? (normalizeProperty('start', audioNode.properties['start'] ?? 0) as number)
      : 0,
  });

  validateElementMasks(scene.elements);

  // Sort elements by layer
  scene.elements.sort(
    (a: Element, b: Element) =>
      layerRank(a.properties.layer as Layer) - layerRank(b.properties.layer as Layer)
  );

  return scene;
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
  };
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

    sequences.set(node.name, { name: node.name, delay, gap, items });
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
  return sequence.delay + Math.max(0, index) * sequence.gap;
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
