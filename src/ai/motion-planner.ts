/**
 * Deterministic planning layer for AI-authored motion.
 *
 * The model should choose copy and intent. This layer chooses the shape of the
 * film first, then exposes a small, concrete plan for the model to translate
 * into .motion source.
 */

import type { Asset } from '../types/scene';
import {
  classifyAssets,
  planBeatTransition,
  selectComponents,
  type AssetKind,
  type BeatTransitionKind,
  type MotionSystemKind,
  type SelectionResult,
} from '../motion-system';
import { sceneOutline } from './storyboard-director';

export type EditorialComposition =
  'logoLockup' | 'editorialSplit' | 'productFocus' | 'uiWalkthrough' | 'proofGrid' | 'ctaLockup';

export type MotionAxis = 'x' | 'y' | 'scale';

export interface PlannedBlock {
  name: string;
  kind: MotionSystemKind;
  reason: string;
}

export interface PlannedAnimation {
  target: 'focal' | 'support' | 'copy' | 'camera';
  preset: string;
  purpose: string;
  delay: number;
  duration: number;
}

export interface PlannedTransition {
  kind: BeatTransitionKind;
  duration: number;
  easing: string;
  axis: MotionAxis;
  from?: string;
  to?: string;
}

export interface PlannedScene {
  name: string;
  label: string;
  purpose: string;
  duration: number;
  focalSubject: string;
  composition: EditorialComposition;
  dominantAxis: MotionAxis;
  blocks: readonly PlannedBlock[];
  identities: readonly string[];
  animation: readonly PlannedAnimation[];
  transitionToNext?: PlannedTransition;
}

export interface MotionPlan {
  request: string;
  duration: number;
  assetKinds: readonly AssetKind[];
  scenes: readonly PlannedScene[];
}

const FALLBACKS: Record<string, readonly PlannedBlock[]> = {
  intro: [
    { name: 'logoReveal', kind: 'archetype', reason: 'Protect the opening brand lockup.' },
    { name: 'hero', kind: 'archetype', reason: 'Give the promise one readable focal frame.' },
  ],
  reveal: [
    {
      name: 'browserShowcase',
      kind: 'showcase',
      reason: 'Frame the real product and keep the UI readable.',
    },
    {
      name: 'splitFeature',
      kind: 'archetype',
      reason: 'Keep copy and product in an editorial split.',
    },
  ],
  features: [
    {
      name: 'media-card',
      kind: 'component',
      reason: 'Present one feature with a real asset and short copy.',
    },
    {
      name: 'featureGrid',
      kind: 'layout',
      reason: 'Arrange related feature moments on one rhythm.',
    },
  ],
  demo: [
    { name: 'uiWalkthrough', kind: 'showcase', reason: 'Focus the viewer on one product action.' },
    {
      name: 'walkthrough',
      kind: 'archetype',
      reason: 'Give the action a clear label and outcome.',
    },
  ],
  outro: [
    { name: 'cta', kind: 'archetype', reason: 'Resolve the film with one action.' },
    { name: 'logoReveal', kind: 'archetype', reason: 'Close on a stable brand lockup.' },
  ],
};

const SCENE_DIRECTION: Record<string, { composition: EditorialComposition; axis: MotionAxis }> = {
  intro: { composition: 'logoLockup', axis: 'y' },
  reveal: { composition: 'productFocus', axis: 'x' },
  features: { composition: 'editorialSplit', axis: 'x' },
  demo: { composition: 'uiWalkthrough', axis: 'scale' },
  outro: { composition: 'ctaLockup', axis: 'scale' },
};

const ANIMATION_BY_SCENE: Record<string, readonly PlannedAnimation[]> = {
  intro: [
    {
      target: 'focal',
      preset: 'heroLogo',
      purpose: 'Reveal the mark with authority.',
      delay: 0.15,
      duration: 0.76,
    },
    {
      target: 'copy',
      preset: 'keynoteText',
      purpose: 'Set the promise after the mark lands.',
      delay: 0.42,
      duration: 0.76,
    },
  ],
  reveal: [
    {
      target: 'focal',
      preset: 'tiltReveal',
      purpose: 'Establish the real product surface in perspective.',
      delay: 0.2,
      duration: 0.72,
    },
    {
      target: 'camera',
      preset: 'focusZoom',
      purpose: 'Move from the whole product to one useful region.',
      delay: 1.2,
      duration: 1.05,
    },
  ],
  features: [
    {
      target: 'copy',
      preset: 'keynoteText',
      purpose: 'Let one large editorial statement carry the beat.',
      delay: 0.18,
      duration: 0.68,
    },
    {
      target: 'support',
      preset: 'cascadeIn',
      purpose: 'Reveal one resolved component group only when proof is needed.',
      delay: 0.36,
      duration: 0.5,
    },
  ],
  demo: [
    {
      target: 'focal',
      preset: 'tiltReveal',
      purpose: 'Show the untouched product state before focusing it.',
      delay: 0.12,
      duration: 0.7,
    },
    {
      target: 'camera',
      preset: 'focusZoom',
      purpose: 'Pan between authored regions of the same screenshot.',
      delay: 1.05,
      duration: 1.05,
    },
  ],
  outro: [
    {
      target: 'copy',
      preset: 'keynoteText',
      purpose: 'Land one memorable closing line.',
      delay: 0.2,
      duration: 0.72,
    },
    {
      target: 'focal',
      preset: 'buttonPop',
      purpose: 'Give the CTA a tactile finish.',
      delay: 0.7,
      duration: 0.42,
    },
  ],
};

/**
 * Build the full intermediate representation consumed by the AI prompt.
 */
export function planMotion(
  request: string,
  assets: readonly Asset[],
  duration: number
): MotionPlan {
  const outline = sceneOutline(duration, assets);
  const assetKinds = [...new Set(classifyAssets(assets).map((item) => item.kind))];
  const scenes = outline.map((scene, index) => {
    const direction = SCENE_DIRECTION[scene.name] ?? { composition: 'editorialSplit', axis: 'x' };
    const blocks = resolveBlocks(scene.name, scene.purpose, assetKinds, scene.suggested);
    const next = outline[index + 1];
    const transitionToNext = next
      ? planTransition(scene.name, next.name, scene.identities, direction.axis)
      : undefined;
    return {
      name: scene.name,
      label: scene.label,
      purpose: scene.purpose,
      duration: scene.duration,
      focalSubject: focalSubject(scene.name, blocks),
      composition: direction.composition,
      dominantAxis: direction.axis,
      blocks,
      identities: scene.identities,
      animation: ANIMATION_BY_SCENE[scene.name] ?? ANIMATION_BY_SCENE['features']!,
      ...(transitionToNext ? { transitionToNext } : {}),
    };
  });
  return {
    request: request.trim().slice(0, 400),
    duration,
    assetKinds,
    scenes,
  };
}

function resolveBlocks(
  sceneName: string,
  intent: string,
  assetKinds: readonly AssetKind[],
  suggested: readonly string[]
): readonly PlannedBlock[] {
  const candidates = new Map<string, PlannedBlock>();
  for (const suggestion of suggested) {
    candidates.set(suggestion, {
      name: suggestion,
      kind: kindForName(suggestion),
      reason: `Suggested by the ${sceneName} story beat.`,
    });
  }
  for (const assetKind of assetKinds) {
    for (const result of selectComponents({ intent, assetKind }, 3)) {
      if (result.score <= 0) continue;
      candidates.set(result.metadata.name, blockFromSelection(result));
    }
  }
  for (const fallback of FALLBACKS[sceneName] ?? FALLBACKS['features']!) {
    if (!candidates.has(fallback.name)) candidates.set(fallback.name, fallback);
  }
  return [...candidates.values()].slice(0, 4);
}

function blockFromSelection(result: SelectionResult): PlannedBlock {
  return {
    name: result.metadata.name,
    kind: result.metadata.kind,
    reason: `${result.metadata.description} Use for: ${result.metadata.useCases.slice(0, 2).join(', ')}.`,
  };
}

function kindForName(name: string): MotionSystemKind {
  if (name.endsWith('Showcase') || name === 'productHero' || name === 'uiWalkthrough') {
    return 'showcase';
  }
  if (
    name.endsWith('Grid') ||
    name.endsWith('Layout') ||
    ['logoWall', 'carousel', 'gallery', 'floatingCollage'].includes(name)
  ) {
    return 'layout';
  }
  if (
    ['hero', 'splitFeature', 'stat', 'walkthrough', 'comparison', 'cta', 'logoReveal'].includes(
      name
    )
  ) {
    return 'archetype';
  }
  return 'component';
}

function focalSubject(sceneName: string, blocks: readonly PlannedBlock[]): string {
  const preferred =
    sceneName === 'intro'
      ? 'brand lockup'
      : sceneName === 'outro'
        ? 'CTA and logo'
        : sceneName === 'demo'
          ? 'one product action'
          : sceneName === 'features'
            ? 'one editorial feature'
            : 'real product UI';
  return `${preferred}; use ${blocks[0]?.name ?? 'one focal block'} as the primary subject`;
}

function planTransition(
  fromScene: string,
  toScene: string,
  identities: readonly string[],
  axis: MotionAxis
): PlannedTransition {
  const shared = identities.length > 0;
  const kind = shared ? 'sharedElement' : toScene === 'demo' ? 'cameraMove' : 'continuous';
  const plan = planBeatTransition({
    kind,
    at: 0,
    duration: kind === 'continuous' ? 0.45 : 0.72,
    easing: kind === 'sharedElement' ? 'power3.inOut' : 'power3.out',
    focusChanged: fromScene !== toScene,
  });
  return {
    kind: plan.kind,
    duration: plan.duration,
    easing: plan.easing,
    axis,
    ...(shared ? { from: `${fromScene}__focus`, to: `${toScene}__focus` } : {}),
  };
}

/** Render the intermediate plan as a compact, stage-gated AI brief. */
export function motionPlanPrompt(plan: MotionPlan): string {
  const scenes = plan.scenes
    .map((scene, index) => {
      const blocks = scene.blocks.map((block) => `${block.name} [${block.kind}]`).join(', ');
      const animation = scene.animation
        .map((move) => `${move.target}:${move.preset}@${move.delay}s/${move.duration}s`)
        .join(', ');
      const transition = scene.transitionToNext
        ? ` then ${scene.transitionToNext.kind} on ${scene.transitionToNext.axis}-axis (${scene.transitionToNext.duration}s)`
        : ' then hold the final lockup';
      return `${index + 1}. ${scene.name} ${scene.duration}s — ${scene.purpose}. Focal: ${scene.focalSubject}. Composition: ${scene.composition}. Blocks: ${blocks}. Identity: ${scene.identities.join(', ') || 'none'}. Motion: ${animation}.${transition}.`;
    })
    .join('\n');

  return [
    'PLANNING PIPELINE — this plan is the source of design decisions.',
    'The .motion generator is the final translation step. Do not invent a new layout, component, transition, or motion language while emitting source.',
    '',
    'Stage 1 — Story planner: choose the narrative purpose and one focal subject per scene.',
    'Stage 2 — Layout planner: lock the composition before animation. Use a named layout, clear margins, one reading direction, and deliberate whitespace. Reject overlaps and arbitrary coordinates.',
    'Stage 3 — Component resolver: search the registry and choose named blocks before raw text, rectangles, or hand-built UI. Reuse one component identity instead of rebuilding the same interface.',
    'Stage 4 — Transition planner: preserve identities, match the dominant axis, and choose pan, push, pull, tilt, shared-element, or hard cut from the relationship between shots. Never repeat one boundary treatment through the whole film.',
    'Stage 5 — Animation planner: apply the listed presets, keep entrances under 800ms, use a shrinking stagger wave, and leave 0.3–0.75s before a result.',
    'Stage 6 — .motion generator: emit valid editable source using the plan exactly.',
    '',
    `Request: ${plan.request || 'premium SaaS launch'}`,
    `Canvas duration: ${plan.duration}s`,
    `Asset kinds: ${plan.assetKinds.join(', ') || 'none'}`,
    'Scene plan:',
    scenes,
    '',
    'Editorial quality bar:',
    '- Text is sometimes the focal subject. Use one large editorial statement when it carries the beat; do not automatically add an eyebrow, subtitle, caption, or footer.',
    '- A product screenshot is already a designed interface. Present, crop, tilt, or focus it; never cover it with redundant labels or rebuild it from components.',
    '- Direct screenshot motion in three phases only when the asset has multiple meaningful regions: establish the untouched full surface, focus one region, then pan or push to the next. Otherwise use a single mask or perspective reveal and hold the image. Do not apply mediaTour to every picture.',
    '- Match treatment to the asset: mediaTour for a planned multi-region UI walkthrough, tiltReveal for a product surface entering with depth, maskReveal for a document or code reveal, and kenBurns for a photo or illustration that needs a slow editorial drift.',
    '- For full-frame screenshot tours use one image plus mediaTour(aspect, focusX, focusY, focusScale, focus2X, focus2Y, focus2Scale, and optional focus3X/focus3Y/focus3Scale). Use a showcase only when the shot genuinely needs a device frame.',
    '- Reusable blocks include browser/mac-window, dashboard/table, sidebar/navbar, command-palette/search-bar, terminal/codeeditor, phone/laptop mockups, pricingcard, feature-card, metric-card, media-card, glass-card, notifications/modals, buttons, progress, timeline, logo grids, testimonials, and FAQ.',
    '- Keep on-screen copy concise and readable without audio.',
    '- Use real UI or screenshots as the focal proof, cropped close enough to inspect.',
    '- Use cards for information and hierarchy, never as empty decoration.',
    '- Do not scatter small text around a screenshot. One headline plus one focal product surface is usually enough.',
    '- Use one accent, one surface system, and one dominant direction across the film.',
    '- Reserve the strongest transition for the product reveal or CTA.',
    '- Preserve the final frame as a useful, readable lockup.',
  ].join('\n');
}
