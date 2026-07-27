import { describe, expect, it } from 'vitest';
import { beatOutline, directorBrief } from '../../src/ai/director';
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

describe('creative director', () => {
  it('drops middle beats on a short canvas instead of cramming them in', () => {
    expect(beatOutline(8, assets).map((beat) => beat.name)).toEqual(['reveal', 'cta']);
    expect(beatOutline(14, assets).map((beat) => beat.name)).toEqual(['brand', 'reveal', 'cta']);
    expect(beatOutline(24, assets).map((beat) => beat.name)).toEqual([
      'brand',
      'reveal',
      'features',
      'cta',
    ]);
    expect(beatOutline(40, assets).map((beat) => beat.name)).toEqual([
      'brand',
      'reveal',
      'features',
      'demo',
      'cta',
    ]);
  });

  it('sizes the storyboard to fill the canvas', () => {
    for (const duration of [8, 14, 24, 40]) {
      const total = beatOutline(duration, assets).reduce((sum, beat) => sum + beat.duration, 0);
      expect(Math.abs(total - duration), `${duration}s`).toBeLessThan(0.1);
    }
  });

  it('suggests concrete blocks per beat', () => {
    for (const beat of beatOutline(40, assets)) {
      expect(beat.suggested.length, beat.name).toBeGreaterThan(0);
      expect(beat.purpose.length, beat.name).toBeGreaterThan(4);
    }
  });

  it('recommends a logo reveal to open and a phone frame for a tall capture', () => {
    const outline = beatOutline(40, assets);
    expect(outline[0]!.suggested).toContain('logoReveal');
    const brief = directorBrief('launch our mobile app', assets, 40);
    expect(brief).toContain('phoneShowcase');
  });

  it('assembles a brief with a storyboard, asset plan, and the component index', () => {
    const brief = directorBrief('saas dashboard launch video', assets, 30);
    expect(brief).toContain('Creative director brief');
    expect(brief).toContain('Canvas duration: 30s');
    expect(brief).toContain('beat reveal');
    expect(brief).toContain('Asset intelligence');
    expect(brief).toContain('Motion system index');
    expect(brief).toContain('Beats replace disconnected scenes');
    expect(brief).toContain('Beat transitions');
    expect(brief).toContain('dashboardShowcase');
  });

  it('is deterministic for the same project', () => {
    expect(directorBrief('launch video', assets, 30)).toBe(
      directorBrief('launch video', assets, 30)
    );
  });

  it('works with no assets and no request', () => {
    const brief = directorBrief('', [], 12);
    expect(brief).toContain('Canvas duration: 12s');
    expect(brief).toContain('no local assets');
  });
});
