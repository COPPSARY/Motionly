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
} from '../types/scene';
import type { ProgramNode, AnimationNode } from '../types/parser';

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
      const asset = node.kind === 'asset' ? (imports.get(node.name) ?? null) : null;
      elements.push({
        id: node.name,
        kind: node.kind as ElementKind,
        assetName: asset ? node.name : null,
        asset,
        properties: {
          ...defaultElementProperties(node.kind as ElementKind),
          ...normalizeProperties(node.properties),
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
        volume: props['volume'] !== undefined ? Number(props['volume']) : 1.0,
        mute: Boolean(props['mute'] ?? false),
      });
    }
  }

  // Add camera animations from camera node
  if (cameraNode && 'properties' in cameraNode && cameraNode.properties['cameraAnimation']) {
    animations.push(...cameraPresetAnimations(cameraNode.properties['cameraAnimation'] as string));
  }

  const scene = applyAnimationPresets({
    canvas,
    camera,
    sequences: Array.from(sequences.values()),
    imports: Array.from(imports.values()),
    elements,
    animations,
    clips,
    audio: audioNode && 'path' in audioNode ? audioNode.path : undefined,
  });

  // Sort elements by layer
  scene.elements.sort(
    (a: Element, b: Element) =>
      layerRank(a.properties.layer as Layer) - layerRank(b.properties.layer as Layer)
  );

  return scene;
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
function assetType(path: string): AssetType {
  const lower = path.toLowerCase();
  if (lower.endsWith('.svg') || lower.startsWith('data:image/svg+xml')) return 'svg';
  return 'image';
}
