import { describe, expect, it } from 'vitest';
import { motionPlanPrompt, planMotion } from '../../src/ai/motion-planner';
import type { Asset } from '../../src/types/scene';

const asset = (path: string, overrides: Partial<Asset> = {}): Asset => ({
  name: path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''),
  path,
  type: 'image',
  ...overrides,
});

const assets = [
  asset('/assets/logo.svg', { type: 'svg', width: 240, height: 80 }),
  asset('/assets/dashboard-ui.png', { width: 2400, height: 1500 }),
  asset('/assets/feature-1.png', { width: 1600, height: 1000 }),
];

describe('AI motion planner', () => {
  it('plans the design pipeline before source generation', () => {
    const plan = planMotion('premium SaaS launch', assets, 32);
    expect(plan.scenes.map((scene) => scene.name)).toEqual([
      'intro',
      'reveal',
      'features',
      'demo',
      'outro',
    ]);
    expect(plan.scenes[0]?.composition).toBe('logoLockup');
    expect(plan.scenes[1]?.composition).toBe('productFocus');
    expect(
      plan.scenes[1]?.blocks.some((block) =>
        ['productHero', 'browserShowcase', 'dashboardShowcase', 'laptopShowcase'].includes(
          block.name
        )
      )
    ).toBe(true);
    expect(plan.scenes.at(-1)?.composition).toBe('ctaLockup');
  });

  it('keeps a dominant direction and continuity decisions explicit', () => {
    const plan = planMotion('launch', assets, 32);
    expect(new Set(plan.scenes.map((scene) => scene.dominantAxis)).size).toBeGreaterThan(1);
    expect(plan.scenes.slice(0, -1).every((scene) => scene.transitionToNext)).toBe(true);
    expect(plan.scenes[0]?.identities).toContain('brand');
  });

  it('renders a stage-gated prompt with reusable editorial blocks', () => {
    const prompt = motionPlanPrompt(planMotion('launch', assets, 32));
    expect(prompt).toContain('Stage 1 — Story planner');
    expect(prompt).toContain('Stage 3 — Component resolver');
    expect(prompt).toContain('Stage 4 — Transition planner');
    expect(prompt).toContain('Stage 6 — .motion generator');
    expect(prompt).toContain('media-card');
    expect(prompt).toContain('Text is sometimes the focal subject');
  });
});
