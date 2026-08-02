/**
 * Motion component metadata.
 *
 * The AI used to receive a wall of prose and had to invent geometry. Metadata
 * replaces that with a selectable index: every layout, showcase, semantic
 * component, and archetype declares what it is for, what it consumes, what asset
 * kinds it presents, and what motion it owns. Selection becomes a lookup.
 *
 * Metadata lives next to each runtime definition and is only *aggregated* here,
 * so a new layout or showcase cannot ship without a description the AI can read.
 */

import {
  publishedSemanticVectorDefinitions,
  semanticComponentMetadata,
} from '../semantic/vector-registry';
import type { AssetKind } from './asset-kinds';
import { layoutDefinitions } from './layout';
import { showcaseDefinitions } from './showcase';

export type MotionSystemKind = 'layout' | 'showcase' | 'component' | 'archetype';

export interface MotionComponentMetadata {
  name: string;
  kind: MotionSystemKind;
  category: string;
  description: string;
  useCases: readonly string[];
  /** Content slots the block consumes. */
  inputs: readonly string[];
  /** Motion the block owns, so the AI never hand-authors these keyframes. */
  animations: readonly string[];
  /** Asset kinds this block presents well. */
  assetKinds: readonly AssetKind[];
  /** Child count range, for blocks that arrange several items. */
  items?: { min: number; max: number };
  variants?: readonly string[];
  accessibility?: string;
  responsive?: string;
  recommendedSpacing?: number;
}

/** Archetypes keep their slide-style role; described here so selection sees them. */
const ARCHETYPE_METADATA: readonly MotionComponentMetadata[] = [
  {
    name: 'hero',
    kind: 'archetype',
    category: 'scene',
    description: 'Centered promise with one real focal asset.',
    useCases: ['opening statement', 'launch title'],
    inputs: ['title', 'subtitle', 'media'],
    animations: ['keynoteText', 'maskReveal'],
    assetKinds: ['ui', 'screenshot', 'photo'],
  },
  {
    name: 'splitFeature',
    kind: 'archetype',
    category: 'scene',
    description: 'Editorial copy and media split across the frame.',
    useCases: ['feature explanation'],
    inputs: ['label', 'title', 'subtitle', 'media'],
    animations: ['fadeUp', 'maskReveal'],
    assetKinds: ['ui', 'screenshot', 'illustration'],
  },
  {
    name: 'stat',
    kind: 'archetype',
    category: 'scene',
    description: 'One large statistic with a short explanation.',
    useCases: ['traction', 'proof point'],
    inputs: ['label', 'value', 'subtitle'],
    animations: ['scaleText', 'countUp'],
    assetKinds: [],
  },
  {
    name: 'walkthrough',
    kind: 'archetype',
    category: 'scene',
    description: 'One product step with real media and a step label.',
    useCases: ['product walkthrough'],
    inputs: ['label', 'title', 'subtitle', 'media'],
    animations: ['fadeUp', 'maskReveal'],
    assetKinds: ['ui', 'screenshot'],
  },
  {
    name: 'comparison',
    kind: 'archetype',
    category: 'scene',
    description: 'Before/after media comparison.',
    useCases: ['before after', 'migration story'],
    inputs: ['title', 'media', 'secondary', 'label', 'secondaryLabel'],
    animations: ['maskReveal', 'fadeUp'],
    assetKinds: ['ui', 'screenshot', 'photo'],
  },
  {
    name: 'cta',
    kind: 'archetype',
    category: 'scene',
    description: 'Closing brand promise and call to action.',
    useCases: ['ending', 'conversion'],
    inputs: ['title', 'subtitle', 'cta', 'logo'],
    animations: ['keynoteText', 'buttonPop'],
    assetKinds: ['logo'],
  },
  {
    name: 'logoReveal',
    kind: 'archetype',
    category: 'scene',
    description: 'Protected logo reveal with an optional title.',
    useCases: ['brand introduction', 'sign off'],
    inputs: ['logo', 'title'],
    animations: ['maskReveal', 'fadeUp'],
    assetKinds: ['logo'],
  },
];

const LAYOUT_ANIMATIONS = ['staggerCards', 'cascadeIn'] as const;

function layoutMetadata(): MotionComponentMetadata[] {
  return layoutDefinitions().map((definition) => ({
    name: definition.type,
    kind: 'layout' as const,
    category: definition.category,
    description: definition.description,
    useCases: definition.useCases,
    inputs: ['children'],
    animations: [...LAYOUT_ANIMATIONS],
    assetKinds: definition.assetKinds,
    items: definition.items,
  }));
}

function showcaseMetadata(): MotionComponentMetadata[] {
  return showcaseDefinitions().map((definition) => ({
    name: definition.type,
    kind: 'showcase' as const,
    category: definition.category,
    description: definition.description,
    useCases: definition.useCases,
    inputs: ['media', 'headline', 'caption', 'label'],
    animations: ['perspectiveReveal', 'directedFocusTour', 'deviceFloat', 'uiHighlight'],
    assetKinds: definition.assetKinds,
  }));
}

function componentMetadata(): MotionComponentMetadata[] {
  return publishedSemanticVectorDefinitions().map((definition) => {
    const metadata = semanticComponentMetadata(definition.type);
    return {
      name: definition.type,
      kind: 'component' as const,
      category: metadata.category,
      description: `${metadata.purpose} ${metadata.interaction}`,
      useCases: metadata.useCases,
      inputs: metadata.inputs,
      animations: [definition.defaultBehavior, ...metadata.motionPresets],
      assetKinds: definition.type === 'logo' ? (['logo'] as const) : [],
      variants: metadata.variants,
      accessibility: metadata.accessibility,
      responsive: metadata.responsive,
      recommendedSpacing: metadata.recommendedSpacing,
    };
  });
}

/** Every selectable block in the motion system. */
export function motionComponentMetadata(): readonly MotionComponentMetadata[] {
  return [
    ...showcaseMetadata(),
    ...layoutMetadata(),
    ...componentMetadata(),
    ...ARCHETYPE_METADATA,
  ];
}

export function findMotionComponent(name: string): MotionComponentMetadata | undefined {
  return motionComponentMetadata().find((entry) => entry.name === name);
}

export interface SelectionQuery {
  /** Free text: the user request, a beat purpose, or a content description. */
  intent?: string;
  kind?: MotionSystemKind;
  /** Filters the candidate set to blocks that present this asset kind. */
  assetKind?: AssetKind;
  /** Number of items to present; filters layouts by their supported range. */
  count?: number;
}

export interface SelectionResult {
  metadata: MotionComponentMetadata;
  score: number;
}

const INTENT_STOP_WORDS = new Set([
  'add',
  'animate',
  'build',
  'create',
  'make',
  'open',
  'show',
  'use',
]);

/**
 * Score and rank blocks against a query.
 *
 * Deterministic and dependency-free: an exact name match outranks a use-case
 * match, which outranks a description match. Ties break alphabetically so the
 * same query always produces the same ordering.
 *
 * Non-matching blocks are kept at the end with a score of 0 rather than dropped,
 * so a caller always has a fallback; check `score > 0` when only real matches
 * are acceptable.
 */
export function selectComponents(query: SelectionQuery, limit = 6): SelectionResult[] {
  const words = (query.intent ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !INTENT_STOP_WORDS.has(word));

  return motionComponentMetadata()
    .filter((entry) => (query.kind ? entry.kind === query.kind : true))
    .filter((entry) => (query.assetKind ? entry.assetKinds.includes(query.assetKind) : true))
    .filter((entry) =>
      query.count !== undefined && entry.items
        ? query.count >= entry.items.min && query.count <= entry.items.max
        : true
    )
    .map((entry) => {
      const name = entry.name.toLowerCase();
      const useCases = entry.useCases.join(' ').toLowerCase();
      const description = entry.description.toLowerCase();
      let score = 0;
      for (const word of words) {
        if (name === word) score += 12;
        else if (name.includes(word)) score += 6;
        if (useCases.includes(word)) score += 4;
        if (description.includes(word)) score += 2;
      }
      // The asset-kind bonus refines ranking; it must not promote a block that
      // does not match the intent at all, or every logo would suggest a CTA.
      const relevant = !words.length || score > 0;
      if (relevant && query.assetKind && entry.assetKinds.includes(query.assetKind)) score += 3;
      return { metadata: entry, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.metadata.name.localeCompare(right.metadata.name)
    )
    .slice(0, limit);
}

/** Prompt section: the selectable index the AI chooses from. */
export function metadataPrompt(): string {
  const group = (kind: MotionSystemKind, title: string) => {
    const entries = motionComponentMetadata().filter((entry) => entry.kind === kind);
    return `${title}:\n${entries
      .map(
        (entry) =>
          `- ${entry.name}: ${entry.description} Use for: ${entry.useCases.join(', ') || 'general'}. Inputs: ${entry.inputs.join(', ')}. Owns motion: ${entry.animations.slice(0, 4).join(', ')}.${
            entry.assetKinds.length ? ` Asset kinds: ${entry.assetKinds.join(', ')}.` : ''
          }${entry.items ? ` Items: ${entry.items.min}-${entry.items.max}.` : ''}${
            entry.variants?.length ? ` Variants: ${entry.variants.join(', ')}.` : ''
          }${entry.recommendedSpacing ? ` Spacing: ${entry.recommendedSpacing}px.` : ''}`
      )
      .join('\n')}`;
  };
  return [
    'Motion system index — select blocks by name, never assemble them from primitives:',
    group('showcase', 'Showcases (one real asset becomes a product presentation)'),
    group('layout', 'Layouts (composition: spacing rhythm, alignment, stagger)'),
    group('component', 'Semantic UI components (primary vocabulary for common interfaces)'),
    'Component policy — Accessibility: preserve labels, readable contrast, focus order, and reduced motion. Responsive: scale authored width and preserve touch-sized targets.',
    group('archetype', 'Archetypes (complete slide-style shots)'),
  ].join('\n\n');
}
