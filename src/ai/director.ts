/**
 * Creative director stage.
 *
 * The old pipeline was prompt → model → source, which forced the model to
 * invent composition and coordinates. This stage inserts the planning step the
 * brief asks for: classify the assets, recommend the components that present
 * them, and hand the model a beat skeleton sized to the canvas.
 *
 *   prompt → director brief → model → .motion using beats / layouts / showcases
 *
 * The brief is derived deterministically from the project, so the same assets
 * and duration always produce the same plan. It is guidance the model fills in,
 * not a lock: an explicit user request always wins.
 */

import type { Asset } from '../types/scene';
import {
  assetIntelligencePrompt,
  beatPrompt,
  classifyAssets,
  doctrinePrompt,
  metadataPrompt,
  recommendPresentations,
  scenePrompt,
  selectComponents,
  transitionPrompt,
  type AssetKind,
} from '../motion-system';
import { continuityPlan, sceneOutline, storyboardSkeleton } from './storyboard-director';
import { motionPlanPrompt, planMotion } from './motion-planner';

export interface BeatOutline {
  name: string;
  purpose: string;
  duration: number;
  /** Blocks that suit this beat, in preference order. */
  suggested: readonly string[];
}

const SKELETON: ReadonlyArray<{ name: string; purpose: string; weight: number; intent: string }> = [
  { name: 'brand', purpose: 'Brand introduction', weight: 0.14, intent: 'brand introduction logo' },
  { name: 'reveal', purpose: 'Product reveal', weight: 0.24, intent: 'product reveal hero' },
  { name: 'features', purpose: 'Feature showcase', weight: 0.24, intent: 'feature showcase' },
  { name: 'demo', purpose: 'Product demo', weight: 0.22, intent: 'product walkthrough demo' },
  { name: 'cta', purpose: 'Call to action', weight: 0.16, intent: 'ending conversion' },
];

/**
 * Size a beat skeleton to the canvas.
 *
 * Short films drop the middle beats rather than cramming five changes of focus
 * into ten seconds — pacing is a composition decision, not a division.
 */
export function beatOutline(canvasDuration: number, assets: readonly Asset[] = []): BeatOutline[] {
  const kinds = new Set(classifyAssets(assets).map((item) => item.kind));
  const wanted =
    canvasDuration < 10
      ? ['reveal', 'cta']
      : canvasDuration < 18
        ? ['brand', 'reveal', 'cta']
        : canvasDuration < 28
          ? ['brand', 'reveal', 'features', 'cta']
          : SKELETON.map((beat) => beat.name);
  const chosen = SKELETON.filter((beat) => wanted.includes(beat.name));
  const total = chosen.reduce((sum, beat) => sum + beat.weight, 0);
  return chosen.map((beat) => ({
    name: beat.name,
    purpose: beat.purpose,
    duration: Number(((canvasDuration * beat.weight) / total).toFixed(2)),
    suggested: suggestionsFor(beat.intent, kinds),
  }));
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

/**
 * Assemble the director brief.
 *
 * `request` is the user's latest message; it steers the recommendations without
 * overriding the deterministic asset analysis.
 */
export function directorBrief(
  request: string,
  assets: readonly Asset[],
  canvasDuration: number
): string {
  const motionPlan = planMotion(request, assets, canvasDuration);
  const outline = beatOutline(canvasDuration, assets);
  const intent = request.trim().slice(0, 400);
  const requested = intent
    ? selectComponents({ intent }, 5)
        .filter((result) => result.score > 0)
        .map((result) => `${result.metadata.name} (${result.metadata.kind})`)
    : [];

  const storyboard = outline
    .map(
      (beat, index) =>
        `${index + 1}. beat ${beat.name} — ${beat.purpose}, about ${beat.duration}s. Build it from: ${beat.suggested.join(', ') || 'a showcase plus a layout'}.`
    )
    .join('\n');

  const groups = recommendPresentations(assets)
    .map(
      (group) =>
        `- ${group.count}x ${group.kind}: ${group.showcases.join(' | ')}${group.layouts.length ? ` arranged with ${group.layouts.join(' | ')}` : ''}. ${group.reason}`
    )
    .join('\n');

  const scenes = sceneOutline(canvasDuration, assets);
  const sceneStoryboard = scenes
    .map(
      (scene, index) =>
        `${index + 1}. scene ${scene.name} (${scene.duration}s) — ${scene.purpose}.${
          scene.identities.length ? ` Carries identity: ${scene.identities.join(', ')}.` : ''
        }`
    )
    .join('\n');
  const continuity = [...continuityPlan(scenes)]
    .map(
      ([identity, names]) =>
        `- identity ${identity} spans ${names.join(' → ')}: tag each of those objects \`identity ${identity}\` so it transforms across the boundary.`
    )
    .join('\n');

  return [
    'Creative director brief (plan first, then compile it to source):',
    '',
    motionPlanPrompt(motionPlan),
    '',
    'Structure comes before animation. Generate in this order:',
    '1. Storyboard  2. Scenes  3. Scene contents  4. Shared identities  5. Boundaries  6. Animation inside each scene.',
    '',
    `Canvas duration: ${canvasDuration}s. Planned storyboard:`,
    sceneStoryboard,
    '',
    'Start from exactly these scene blocks:',
    storyboardSkeleton(scenes),
    ...(continuity ? ['', 'Continuity spine:', continuity] : []),
    '',
    scenePrompt(),
    '',
    'Inside a scene, beats change the focus without clearing anything:',
    storyboard,
    ...(groups ? ['', 'Presentation plan from the real assets:', groups] : []),
    ...(requested.length ? ['', `Blocks matching this request: ${requested.join(', ')}.`] : []),
    '',
    doctrinePrompt(),
    '',
    assetIntelligencePrompt(assets),
    '',
    metadataPrompt(),
    '',
    beatPrompt(),
    '',
    transitionPrompt(),
  ].join('\n');
}
