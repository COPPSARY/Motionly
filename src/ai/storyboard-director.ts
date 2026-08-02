/**
 * Hierarchical storyboard direction.
 *
 * The failure mode of prompt → source is that the model animates objects. It
 * reaches for a fade on a title because a fade is a thing you can do to a title,
 * and the result is a stack of unrelated slides. Nothing in the prompt ever asked
 * it to decide what the film is *about* first.
 *
 * This stage forces the order of operations:
 *
 *   1. storyboard      — how many scenes, what each is for, how long
 *   2. scenes          — one `scene` block per beat of the story
 *   3. contents        — the components that live in each scene
 *   4. shared identity — which components recur, tagged so they persist
 *   5. boundaries      — how each cut is crossed, derived from step 4
 *   6. animation       — only now, and only inside a scene
 *
 * Steps 1-5 are structure; step 6 is craft. Structure is also the only part the
 * model reliably gets wrong, so it is the part we hand it, deterministically, as a
 * skeleton it fills in.
 */

import type { Asset } from '../types/scene';
import {
  assetIntelligencePrompt,
  classifyAssets,
  doctrinePrompt,
  metadataPrompt,
  recommendPresentations,
  scenePrompt,
  selectComponents,
  type AssetKind,
} from '../motion-system';

export interface SceneOutline {
  name: string;
  label: string;
  purpose: string;
  duration: number;
  /** Blocks that suit this scene, in preference order. */
  suggested: readonly string[];
  /** Persistent identities this scene should carry, for continuity. */
  identities: readonly string[];
}

/**
 * The narrative skeleton.
 *
 * `carries` is the continuity spine: an identity listed on more than one scene is
 * a component that must survive the boundary between them. That is how the plan
 * itself, before a single animation exists, guarantees the film holds together.
 */
const SKELETON: ReadonlyArray<{
  name: string;
  label: string;
  purpose: string;
  weight: number;
  intent: string;
  carries: readonly string[];
}> = [
  {
    name: 'intro',
    label: 'Intro',
    purpose: 'Establish the brand and the promise',
    weight: 0.14,
    intent: 'brand introduction logo',
    carries: ['brand'],
  },
  {
    name: 'reveal',
    label: 'Reveal',
    purpose: 'Show the product for the first time',
    weight: 0.24,
    intent: 'product reveal hero',
    carries: ['brand', 'product'],
  },
  {
    name: 'features',
    label: 'Features',
    purpose: 'Break the product into what it does',
    weight: 0.24,
    intent: 'feature showcase',
    carries: ['product'],
  },
  {
    name: 'demo',
    label: 'Demo',
    purpose: 'Let the product perform in context',
    weight: 0.22,
    intent: 'product walkthrough demo',
    carries: ['product'],
  },
  {
    name: 'outro',
    label: 'Outro',
    purpose: 'Land the call to action',
    weight: 0.16,
    intent: 'ending conversion',
    carries: ['brand'],
  },
];

/**
 * Size a storyboard to the canvas.
 *
 * A short film drops middle scenes rather than cramming five story turns into ten
 * seconds. Pacing is a composition decision, not a division.
 */
export function sceneOutline(
  canvasDuration: number,
  assets: readonly Asset[] = []
): SceneOutline[] {
  const kinds = new Set(classifyAssets(assets).map((item) => item.kind));
  const wanted =
    canvasDuration < 10
      ? ['reveal', 'outro']
      : canvasDuration < 18
        ? ['intro', 'reveal', 'outro']
        : canvasDuration < 28
          ? ['intro', 'reveal', 'features', 'outro']
          : SKELETON.map((scene) => scene.name);
  const chosen = SKELETON.filter((scene) => wanted.includes(scene.name));
  const total = chosen.reduce((sum, scene) => sum + scene.weight, 0);

  // An identity is only worth declaring if it actually recurs; a one-scene
  // identity is noise that teaches the model the wrong lesson.
  const counts = new Map<string, number>();
  for (const scene of chosen) {
    for (const identity of scene.carries) {
      counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }
  }

  return chosen.map((scene) => ({
    name: scene.name,
    label: scene.label,
    purpose: scene.purpose,
    duration: Number(((canvasDuration * scene.weight) / total).toFixed(2)),
    suggested: suggestionsFor(scene.intent, kinds),
    identities: scene.carries.filter((identity) => (counts.get(identity) ?? 0) > 1),
  }));
}

/**
 * The storyboard as compilable source.
 *
 * Handing the model real `scene` blocks removes the two things it gets wrong most
 * often — absolute timing and membership — and leaves it the part it is good at:
 * choosing and choreographing what goes inside.
 */
export function storyboardSkeleton(outline: readonly SceneOutline[]): string {
  return outline
    .map((scene) => {
      const lines = [`scene ${scene.name} {`, `  duration ${scene.duration}s`];
      lines.push(`  label "${scene.label}"`);
      lines.push('}');
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Identities that appear in more than one scene, with the scenes that carry them. */
export function continuityPlan(outline: readonly SceneOutline[]): Map<string, string[]> {
  const plan = new Map<string, string[]>();
  for (const scene of outline) {
    for (const identity of scene.identities) {
      plan.set(identity, [...(plan.get(identity) ?? []), scene.name]);
    }
  }
  return plan;
}

/**
 * Assemble the hierarchical brief.
 *
 * `request` steers the block recommendations without overriding the deterministic
 * asset analysis, so the same project always produces the same plan.
 */
export function storyboardBrief(
  request: string,
  assets: readonly Asset[],
  canvasDuration: number
): string {
  const outline = sceneOutline(canvasDuration, assets);
  const intent = request.trim().slice(0, 400);
  const requested = intent
    ? selectComponents({ intent }, 5)
        .filter((result) => result.score > 0)
        .map((result) => `${result.metadata.name} (${result.metadata.kind})`)
    : [];

  const storyboard = outline
    .map(
      (scene, index) =>
        `${index + 1}. scene ${scene.name} (${scene.duration}s) — ${scene.purpose}. Build it from: ${
          scene.suggested.join(', ') || 'a showcase plus a layout'
        }.${scene.identities.length ? ` Carries identity: ${scene.identities.join(', ')}.` : ''}`
    )
    .join('\n');

  const continuity = [...continuityPlan(outline)]
    .map(
      ([identity, scenes]) =>
        `- identity ${identity} appears in ${scenes.join(' → ')}. Give every one of those objects \`identity ${identity}\` so it transforms across the boundary instead of disappearing.`
    )
    .join('\n');

  const groups = recommendPresentations(assets)
    .map(
      (group) =>
        `- ${group.count}x ${group.kind}: ${group.showcases.join(' | ')}${
          group.layouts.length ? ` arranged with ${group.layouts.join(' | ')}` : ''
        }. ${group.reason}`
    )
    .join('\n');

  return [
    'Storyboard brief. Build the structure first, then animate inside it.',
    '',
    'Generation order (do not skip a step):',
    '1. Storyboard: decide the scenes and their purpose.',
    '2. Scenes: write one scene block per storyboard entry.',
    '3. Contents: put objects in scenes with `scene NAME`.',
    '4. Continuity: tag recurring components with `identity NAME`.',
    '5. Boundaries: only override a scene transition when inference is wrong.',
    '6. Animation: choreograph inside each scene, using scene-local delays.',
    '',
    `Canvas duration: ${canvasDuration}s. Planned storyboard:`,
    storyboard,
    '',
    'Start from exactly these scene blocks:',
    storyboardSkeleton(outline),
    ...(continuity ? ['', 'Continuity spine:', continuity] : []),
    ...(groups ? ['', 'Presentation plan from the real assets:', groups] : []),
    ...(requested.length ? ['', `Blocks matching this request: ${requested.join(', ')}.`] : []),
    '',
    scenePrompt(),
    '',
    doctrinePrompt(),
    '',
    assetIntelligencePrompt(assets),
    '',
    metadataPrompt(),
  ].join('\n');
}

function suggestionsFor(intent: string, kinds: ReadonlySet<AssetKind>): readonly string[] {
  // One query per asset kind, merged on the best score, so the ranking reflects
  // fit rather than the order the kinds happened to appear in.
  const best = new Map<string, number>();
  for (const kind of kinds.size ? [...kinds] : [undefined]) {
    for (const result of selectComponents({ intent, ...(kind ? { assetKind: kind } : {}) }, 4)) {
      if (result.score <= 0) continue;
      best.set(result.metadata.name, Math.max(best.get(result.metadata.name) ?? 0, result.score));
    }
  }
  if (!best.size) {
    for (const result of selectComponents({ intent }, 2)) best.set(result.metadata.name, 0);
  }
  return [...best.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([name]) => name);
}
