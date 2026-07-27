import { describe, expect, it } from 'vitest';
import {
  assetIntelligencePrompt,
  classifyAsset,
  classifyAssets,
  recommendPresentation,
  recommendPresentations,
} from '../../src/motion-system/asset-intelligence';
import { ASSET_KINDS } from '../../src/motion-system/asset-kinds';
import type { Asset } from '../../src/types/scene';

const asset = (path: string, overrides: Partial<Asset> = {}): Asset => ({
  name: path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''),
  path,
  type: 'image',
  ...overrides,
});

describe('asset intelligence', () => {
  it('classifies assets from explicit filename intent', () => {
    expect(classifyAsset(asset('/a/company-logo.svg', { type: 'svg' })).kind).toBe('logo');
    expect(classifyAsset(asset('/a/icon-bolt.svg', { type: 'svg' })).kind).toBe('icon');
    expect(classifyAsset(asset('/a/team-avatar.png')).kind).toBe('avatar');
    expect(classifyAsset(asset('/a/revenue-chart.png')).kind).toBe('chart');
    expect(classifyAsset(asset('/a/product-illustration.png')).kind).toBe('illustration');
  });

  it('lets shape decide between a phone capture and a desktop interface', () => {
    const portrait = classifyAsset(asset('/a/app-screenshot.png', { width: 430, height: 932 }));
    expect(portrait.kind).toBe('screenshot');
    const landscape = classifyAsset(asset('/a/app-screenshot.png', { width: 2400, height: 1500 }));
    expect(landscape.kind).toBe('ui');
  });

  it('falls back to geometry when the filename says nothing', () => {
    expect(classifyAsset(asset('/a/img_4821.png', { width: 96, height: 96 })).kind).toBe('icon');
    expect(classifyAsset(asset('/a/img_4822.png', { width: 400, height: 900 })).kind).toBe(
      'screenshot'
    );
    expect(classifyAsset(asset('/a/img_4823.png', { width: 1920, height: 1080 })).kind).toBe('ui');
    expect(classifyAsset(asset('/a/img_4824.png', { width: 1200, height: 1000 })).kind).toBe(
      'photo'
    );
    expect(classifyAsset(asset('/a/img_4821.png', { width: 96, height: 96 })).inferred).toBe(true);
  });

  it('keeps real photo intent from the filename', () => {
    const photo = classifyAsset(asset('/a/office-photo.png', { width: 1200, height: 1200 }));
    expect(photo.kind).toBe('photo');
    expect(photo.inferred).toBe(false);
  });

  it('treats declared video as motion media regardless of name', () => {
    expect(classifyAsset(asset('/a/company-logo.mp4', { type: 'video' })).kind).toBe('video');
  });

  it('is deterministic', () => {
    const subject = asset('/a/dashboard.png', { width: 2000, height: 1200 });
    expect(classifyAsset(subject)).toEqual(classifyAsset(subject));
  });

  it('recommends a showcase for every kind and a layout only for groups', () => {
    for (const kind of ASSET_KINDS) {
      const single = recommendPresentation(kind, 1);
      expect(single.showcases.length, kind).toBeGreaterThan(0);
      expect(single.layouts, kind).toHaveLength(0);
      expect(single.reason.length, kind).toBeGreaterThan(16);
      expect(recommendPresentation(kind, 4).layouts.length, kind).toBeGreaterThan(0);
    }
  });

  it('frames tall app captures in a phone and wide UI on a desktop', () => {
    expect(recommendPresentation('screenshot').showcases).toContain('phoneShowcase');
    expect(recommendPresentation('ui').showcases).toContain('dashboardShowcase');
    expect(recommendPresentation('logo', 6).layouts).toContain('logoWall');
    expect(recommendPresentation('icon', 5).layouts).toContain('bentoGrid');
  });

  it('groups a mixed asset set into presentation plans', () => {
    const assets = [
      asset('/a/logo.svg', { type: 'svg', width: 200, height: 200 }),
      asset('/a/feature-1.svg', { type: 'svg', width: 64, height: 64 }),
      asset('/a/feature-2.svg', { type: 'svg', width: 64, height: 64 }),
      asset('/a/feature-3.svg', { type: 'svg', width: 64, height: 64 }),
    ];
    const plans = recommendPresentations(assets);
    expect(plans[0]!.kind).toBe('icon');
    expect(plans[0]!.count).toBe(3);
    expect(plans[0]!.layouts).toContain('featureGrid');
    expect(plans.map((plan) => plan.kind)).toContain('logo');
  });

  it('builds a prompt that names each asset, its kind, and its presentation', () => {
    const prompt = assetIntelligencePrompt([
      asset('/a/dashboard.png', { width: 2400, height: 1500 }),
      asset('/a/shot-a.png', { width: 430, height: 932 }),
      asset('/a/shot-b.png', { width: 430, height: 932 }),
    ]);
    expect(prompt).toContain('kind=ui');
    expect(prompt).toContain('dashboardShowcase');
    expect(prompt).toContain('Multi-asset arrangements');
    expect(prompt).toContain('deviceStack');
  });

  it('asks for real media when the project has no assets', () => {
    expect(assetIntelligencePrompt([])).toContain('no local assets');
  });

  it('classifies a whole list in order', () => {
    const assets = [asset('/a/logo.svg', { type: 'svg' }), asset('/a/shot.png')];
    expect(classifyAssets(assets).map((item) => item.asset.name)).toEqual(['logo', 'shot']);
  });
});
