import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../../src/semantic/catalog';
import {
  SHOWCASE_TYPES,
  buildShowcase,
  isShowcaseType,
  showcaseDefinition,
  showcaseDefinitions,
  type ShowcaseContext,
  type ShowcaseType,
} from '../../src/motion-system/showcase';

const context = (
  type: ShowcaseType,
  overrides: Partial<ShowcaseContext> = {}
): ShowcaseContext => ({
  name: 'shot',
  type,
  theme: DEFAULT_THEME,
  x: 0,
  y: 0,
  width: showcaseDefinition(type).defaults.width,
  accent: DEFAULT_THEME.accent,
  surface: DEFAULT_THEME.surface,
  delay: 0,
  duration: 1,
  layer: 'hero',
  behaviors: [],
  focusX: 0.5,
  focusY: 0.45,
  ...overrides,
});

const ALLOWED_KINDS = new Set(['group', 'overlay', 'image', 'text']);

describe('product showcases', () => {
  it('emits only existing element kinds, so the renderer needs no changes', () => {
    for (const type of SHOWCASE_TYPES) {
      const composition = buildShowcase(context(type, { media: 'shotAsset' }));
      expect(composition.root.kind).toBe('group');
      for (const child of composition.children) {
        expect(ALLOWED_KINDS.has(child.kind), `${type} -> ${child.kind}`).toBe(true);
      }
    }
  });

  it('names every part under its root and parents it inside the composition', () => {
    for (const type of SHOWCASE_TYPES) {
      const composition = buildShowcase(context(type, { media: 'shotAsset' }));
      const ids = new Set([composition.root.name, ...composition.childIds]);
      for (const child of composition.children) {
        expect(child.name.startsWith('shot__'), child.name).toBe(true);
        expect(ids.has(String(child.properties['parent'])), `${child.name} parent`).toBe(true);
      }
    }
  });

  it('crops real media to a clipping screen instead of stretching it', () => {
    for (const type of SHOWCASE_TYPES) {
      const composition = buildShowcase(context(type, { media: 'shotAsset' }));
      const screen = composition.children.find((child) => child.name === 'shot__screen')!;
      expect(screen.properties['clip'], type).toBe(true);
      expect(Number(screen.properties['width']), type).toBeGreaterThan(0);
      expect(Number(screen.properties['height']), type).toBeGreaterThan(0);

      const media = composition.children.find((child) => child.name === 'shot__media')!;
      expect(media.kind).toBe('image');
      expect(media.properties['source']).toBe('shotAsset');
      expect(media.properties['parent']).toBe('shot__screen');
      // Width only: height stays derived so the asset keeps its aspect ratio.
      expect(media.properties['height']).toBeUndefined();
      expect(media.properties['center']).toBe(true);
    }
  });

  it('never uses canvas-relative cover inside a device screen', () => {
    for (const type of SHOWCASE_TYPES) {
      for (const child of buildShowcase(context(type, { media: 'shot' })).children) {
        expect(child.properties['cover'], `${type} ${child.name}`).toBeUndefined();
      }
    }
  });

  it('shows an honest empty state when no media is supplied', () => {
    const composition = buildShowcase(context('phoneShowcase'));
    const placeholder = composition.children.find((child) => child.name === 'shot__placeholder')!;
    expect(placeholder.kind).toBe('text');
    expect(String(placeholder.properties['value'])).toContain('Add product media');
    expect(composition.children.some((child) => child.name === 'shot__media')).toBe(false);
  });

  it('gives a phone a portrait screen and a browser a landscape one', () => {
    const phone = buildShowcase(context('phoneShowcase', { media: 'a' }));
    expect(phone.screen.height).toBeGreaterThan(phone.screen.width);
    const browser = buildShowcase(context('browserShowcase', { media: 'a' }));
    expect(browser.screen.width).toBeGreaterThan(browser.screen.height);
  });

  it('builds browser chrome with traffic lights and a URL pill', () => {
    const composition = buildShowcase(context('browserShowcase', { media: 'a' }));
    const names = composition.childIds;
    expect(names).toContain('shot__chrome');
    expect(names).toContain('shot__dot0');
    expect(names).toContain('shot__dot2');
    expect(names).toContain('shot__address');
  });

  it('grounds a laptop on a base', () => {
    const names = buildShowcase(context('laptopShowcase', { media: 'a' })).childIds;
    expect(names).toContain('shot__base');
    expect(names).toContain('shot__foot');
  });

  it('gives a dashboard a sidebar rail', () => {
    const composition = buildShowcase(context('dashboardShowcase', { media: 'a' }));
    const rail = composition.children.find((child) => child.name === 'shot__rail')!;
    expect(rail.properties['parent']).toBe('shot__screen');
  });

  it('owns one entrance for the whole composition', () => {
    const composition = buildShowcase(context('browserShowcase', { media: 'a', delay: 2 }));
    const entrance = composition.animations.find(
      (animation) => animation.target === 'shot' && animation.keyframes?.length === 0
    )!;
    expect(entrance.delay).toBe(2);
    expect(entrance.from!['opacity']).toBe(0);
    expect(entrance.to!['opacity']).toBe(1);
  });

  it('never makes idle drift a default — it is opt-in only', () => {
    for (const definition of showcaseDefinitions()) {
      expect(definition.defaults.behavior, definition.type).not.toContain('float');
    }
    // Default behavior produces no infinite idle loop.
    for (const type of SHOWCASE_TYPES) {
      const composition = buildShowcase(
        context(type, { media: 'a', behaviors: [showcaseDefinition(type).defaults.behavior] })
      );
      expect(
        composition.animations.some((animation) => animation.repeat === 'infinite'),
        type
      ).toBe(false);
    }
  });

  it('adds an idle float only when asked, and never when still', () => {
    const floating = buildShowcase(context('phoneShowcase', { behaviors: ['float'] }));
    expect(floating.animations.some((animation) => animation.repeat === 'infinite')).toBe(true);
    const still = buildShowcase(context('phoneShowcase', { behaviors: ['float', 'still'] }));
    expect(still.animations.some((animation) => animation.repeat === 'infinite')).toBe(false);
  });

  it('expresses a camera push on the subject, not the global camera', () => {
    const composition = buildShowcase(context('browserShowcase', { behaviors: ['push'] }));
    const push = composition.animations.find((animation) => animation.to?.['scale'] === 1.06)!;
    expect(push.target).toBe('shot');
    expect(composition.animations.every((animation) => animation.target !== 'camera')).toBe(true);
  });

  it('draws a focus ring at the requested point and reports it as the focus target', () => {
    const composition = buildShowcase(
      context('uiWalkthrough', { media: 'a', behaviors: ['highlight'], focusX: 0.25, focusY: 0.75 })
    );
    const ring = composition.children.find((child) => child.name === 'shot__focusRing')!;
    expect(Number(ring.properties['x'])).toBeLessThan(0);
    expect(Number(ring.properties['y'])).toBeGreaterThan(0);
    expect(composition.focusId).toBe('shot__focusRing');
  });

  it('places copy outside the device body', () => {
    const composition = buildShowcase(
      context('phoneShowcase', {
        headline: 'Ship faster',
        caption: 'Every metric, live.',
        label: 'Step 1',
      })
    );
    const headline = composition.children.find((child) => child.name === 'shot__headline')!;
    const step = composition.children.find((child) => child.name === 'shot__step')!;
    const body = composition.children.find((child) => child.name === 'shot__body')!;
    const halfBody = Number(body.properties['height']) / 2;
    expect(Number(headline.properties['y'])).toBeGreaterThan(halfBody);
    expect(Number(step.properties['y'])).toBeLessThan(-halfBody);
  });

  it('is deterministic', () => {
    const spec = context('dashboardShowcase', { media: 'a', headline: 'One' });
    expect(buildShowcase(spec)).toEqual(buildShowcase(spec));
  });

  it('describes every showcase for selection', () => {
    expect(showcaseDefinitions()).toHaveLength(SHOWCASE_TYPES.length);
    for (const definition of showcaseDefinitions()) {
      expect(definition.description.length).toBeGreaterThan(16);
      expect(definition.useCases.length).toBeGreaterThan(0);
      expect(definition.screenRatio).toBeGreaterThan(0);
      expect(definition.defaults.width).toBeGreaterThan(0);
      expect(isShowcaseType(definition.type)).toBe(true);
    }
    expect(isShowcaseType('notAShowcase')).toBe(false);
  });
});
