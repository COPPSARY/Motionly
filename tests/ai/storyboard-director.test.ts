import { describe, expect, it } from 'vitest';
import {
  continuityPlan,
  sceneOutline,
  storyboardBrief,
  storyboardSkeleton,
} from '../../src/ai/storyboard-director';
import { directorBrief } from '../../src/ai/director';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import type { Asset } from '../../src/types/scene';

const asset = (path: string, overrides: Partial<Asset> = {}): Asset => ({
  name: path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''),
  path,
  type: 'image',
  ...overrides,
});

const assets = [
  asset('/a/logo.svg', { type: 'svg', width: 200, height: 200 }),
  asset('/a/dashboard-ui.png', { width: 2400, height: 1500 }),
  asset('/a/app-screenshot.png', { width: 430, height: 932 }),
];

describe('scene outline', () => {
  it('drops middle scenes on a short canvas instead of cramming them in', () => {
    expect(sceneOutline(8, assets).map((scene) => scene.name)).toEqual(['reveal', 'outro']);
    expect(sceneOutline(14, assets).map((scene) => scene.name)).toEqual([
      'intro',
      'reveal',
      'outro',
    ]);
    expect(sceneOutline(40, assets).map((scene) => scene.name)).toEqual([
      'intro',
      'reveal',
      'features',
      'demo',
      'outro',
    ]);
  });

  it('sizes the storyboard to fill the canvas', () => {
    for (const duration of [8, 14, 24, 40]) {
      const total = sceneOutline(duration, assets).reduce((sum, scene) => sum + scene.duration, 0);
      expect(Math.abs(total - duration), `${duration}s`).toBeLessThan(0.1);
    }
  });

  it('plans a continuity spine that actually recurs', () => {
    const plan = continuityPlan(sceneOutline(40, assets));
    expect(plan.get('brand')).toEqual(['intro', 'reveal', 'outro']);
    expect(plan.get('product')).toEqual(['reveal', 'features', 'demo']);
    for (const [, scenes] of plan) expect(scenes.length).toBeGreaterThan(1);
  });

  it('drops an identity that would only appear once', () => {
    // On a two-scene film `product` only lands in `reveal`, so it is not a spine.
    const plan = continuityPlan(sceneOutline(8, assets));
    expect(plan.has('product')).toBe(false);
    expect(plan.get('brand')).toEqual(['reveal', 'outro']);
  });

  it('suggests concrete blocks and a purpose per scene', () => {
    for (const scene of sceneOutline(40, assets)) {
      expect(scene.suggested.length, scene.name).toBeGreaterThan(0);
      expect(scene.purpose.length, scene.name).toBeGreaterThan(4);
      expect(scene.label.length, scene.name).toBeGreaterThan(0);
    }
  });
});

describe('storyboard skeleton', () => {
  it('emits scene blocks that compile', () => {
    const skeleton = storyboardSkeleton(sceneOutline(30, assets));
    const source = `canvas { size 1920x1080 duration 30s }\n\n${skeleton}\n\ntext t { scene intro value "x" size 40 color #ffffff }`;
    const graph = buildSceneGraph(parseMotion(source));
    expect(graph.storyboard!.map((plan) => plan.name)).toEqual([
      'intro',
      'reveal',
      'features',
      'demo',
      'outro',
    ]);
    expect(graph.storyboard![0]!.start).toBe(0);
    // Scenes run back to back with no absolute time authored anywhere.
    expect(skeleton).not.toMatch(/start /);
  });
});

describe('storyboard brief', () => {
  const brief = storyboardBrief('saas dashboard launch video', assets, 30);

  it('puts structure before animation and spells out the order', () => {
    expect(brief).toContain('Build the structure first');
    expect(brief.indexOf('1. Storyboard')).toBeLessThan(brief.indexOf('6. Animation'));
  });

  it('hands the model real scene blocks', () => {
    expect(brief).toContain('scene intro {');
    expect(brief).toContain('Start from exactly these scene blocks');
  });

  it('states the continuity spine explicitly', () => {
    expect(brief).toContain('Continuity spine');
    expect(brief).toMatch(/identity brand/);
  });

  it('carries the scene contract and forbids fades', () => {
    expect(brief).toContain('organizational boundaries, NOT animation boundaries');
    expect(brief).toContain('There is no fade');
  });

  it('is deterministic for the same project', () => {
    expect(storyboardBrief('launch video', assets, 30)).toBe(
      storyboardBrief('launch video', assets, 30)
    );
  });

  it('works with no assets and no request', () => {
    const empty = storyboardBrief('', [], 12);
    expect(empty).toContain('Canvas duration: 12s');
    expect(empty).toContain('no local assets');
  });
});

describe('the chat director now directs a storyboard', () => {
  const brief = directorBrief('saas dashboard launch video', assets, 30);

  it('leads with the storyboard and the generation order', () => {
    expect(brief).toContain('Structure comes before animation');
    expect(brief).toContain('scene intro {');
    expect(brief).toContain('Continuity spine');
  });

  it('keeps beats as the intra-scene focus tool', () => {
    expect(brief).toContain('Inside a scene, beats change the focus');
    expect(brief).toContain('Beats replace disconnected scenes');
  });
});
