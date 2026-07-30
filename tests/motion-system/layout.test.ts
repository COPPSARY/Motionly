import { describe, expect, it } from 'vitest';
import {
  ARRIVAL,
  DEFAULT_FRAME,
  LAYOUT_TYPES,
  RHYTHM,
  focalSlot,
  isLayoutType,
  layoutDefinition,
  layoutDefinitions,
  resolveLayout,
} from '../../src/motion-system/layout';

describe('composition engine', () => {
  it('places exactly one slot per child for every layout type', () => {
    for (const type of LAYOUT_TYPES) {
      const definition = layoutDefinition(type);
      const count = definition.items.min;
      const slots = resolveLayout({ type, count });
      expect(slots, type).toHaveLength(count);
      for (const slot of slots) {
        expect(Number.isFinite(slot.x), `${type} x`).toBe(true);
        expect(Number.isFinite(slot.y), `${type} y`).toBe(true);
        expect(Number.isFinite(slot.rotation), `${type} rotation`).toBe(true);
        expect(slot.width, `${type} width`).toBeGreaterThan(0);
        expect(slot.height, `${type} height`).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic: the same spec always resolves to the same frame', () => {
    for (const type of LAYOUT_TYPES) {
      const spec = { type, count: layoutDefinition(type).items.max };
      expect(resolveLayout(spec)).toEqual(resolveLayout(spec));
    }
  });

  it('snaps every coordinate and size to the visual rhythm', () => {
    for (const type of LAYOUT_TYPES) {
      for (const slot of resolveLayout({ type, count: 5, columns: 3 })) {
        expect(Math.abs(slot.x % RHYTHM), `${type} x=${slot.x}`).toBe(0);
        expect(Math.abs(slot.y % RHYTHM), `${type} y=${slot.y}`).toBe(0);
        expect(Math.abs(slot.width % RHYTHM), `${type} width=${slot.width}`).toBe(0);
        expect(Math.abs(slot.height % RHYTHM), `${type} height=${slot.height}`).toBe(0);
        expect(Object.is(slot.x, -0), `${type} negative zero`).toBe(false);
      }
    }
  });

  it('keeps slots inside the composition frame', () => {
    const width = 1600;
    const height = 800;
    for (const type of LAYOUT_TYPES) {
      if (type === 'carousel' || type === 'floatingCollage') continue; // Bleed off frame by design.
      for (const slot of resolveLayout({ type, count: 4, width, height, columns: 2 })) {
        expect(Math.abs(slot.x) + slot.width / 2, `${type} horizontal`).toBeLessThanOrEqual(
          width / 2 + RHYTHM
        );
      }
    }
  });

  it('staggers entrances instead of firing them together', () => {
    const slots = resolveLayout({ type: 'featureGrid', count: 6 });
    const delays = slots.map((slot) => slot.delay);
    expect(new Set(delays).size).toBe(delays.length);
    expect(delays).toEqual([...delays].sort((left, right) => left - right));
    expect(delays[0]).toBe(0);
  });

  it('supports center-out and reverse reading order', () => {
    const centerOut = resolveLayout({ type: 'featureGrid', count: 5, order: 'center-out' });
    expect(centerOut[2]!.delay).toBeLessThan(centerOut[0]!.delay);
    const reverse = resolveLayout({ type: 'featureGrid', count: 4, order: 'reverse' });
    expect(reverse[3]!.delay).toBeLessThan(reverse[0]!.delay);
  });

  it('accelerates the cascade by shrinking each successive gap', () => {
    const slots = resolveLayout({ type: 'featureGrid', count: 4, delay: 2, stagger: 0.1 });
    const delays = slots.map((slot) => slot.delay);
    expect(delays[0]).toBe(2);
    const gaps = delays.slice(1).map((delay, index) => delay - delays[index]!);
    for (const [index, gap] of gaps.slice(1).entries()) {
      expect(gap, `gap ${index + 1}`).toBeLessThan(gaps[index]!);
    }
    // The last item snaps: its gap is the smallest of the cascade.
    expect(gaps.at(-1)).toBeLessThan(gaps[0]!);
  });

  it('lands any group inside one beat, however many items it holds', () => {
    for (const type of LAYOUT_TYPES) {
      const count = layoutDefinition(type).items.max;
      const delays = resolveLayout({ type, count }).map((slot) => slot.delay);
      const window = Math.max(...delays) - Math.min(...delays);
      expect(window, `${type} window with ${count} items`).toBeLessThanOrEqual(
        ARRIVAL.maxStaggerWindow + 0.001
      );
    }
  });

  it('scales arrival travel and duration by composition weight', () => {
    const slots = resolveLayout({ type: 'bentoGrid', count: 5, columns: 3 });
    const focal = slots.find((slot) => slot.emphasis === 'focal')!;
    const support = slots.find((slot) => slot.emphasis === 'support')!;
    expect(focal.travel).toBeGreaterThan(support.travel);
    expect(focal.duration).toBeGreaterThan(support.duration);
    expect(focal.travel).toBe(ARRIVAL.focal.travel);
    expect(support.duration).toBe(ARRIVAL.support.duration);
  });

  it('keeps every arrival inside the single-entry budget', () => {
    for (const type of LAYOUT_TYPES) {
      for (const slot of resolveLayout({ type, count: 4 })) {
        expect(slot.duration, `${type} duration`).toBeLessThanOrEqual(0.8);
        expect(slot.duration, `${type} duration`).toBeGreaterThan(0.2);
      }
    }
  });

  it('gives a bento grid one larger focal tile', () => {
    const slots = resolveLayout({ type: 'bentoGrid', count: 5, columns: 3 });
    const focal = focalSlot(slots)!;
    expect(focal.index).toBe(0);
    expect(focal.emphasis).toBe('focal');
    for (const slot of slots.slice(1)) {
      expect(slot.width).toBeLessThan(focal.width);
    }
  });

  it('never overlaps uniform grid slots', () => {
    const slots = resolveLayout({ type: 'featureGrid', count: 6, columns: 3 });
    for (const [index, slot] of slots.entries()) {
      for (const other of slots.slice(index + 1)) {
        const apart =
          Math.abs(slot.x - other.x) >= (slot.width + other.width) / 2 - 1 ||
          Math.abs(slot.y - other.y) >= (slot.height + other.height) / 2 - 1;
        expect(apart, `${slot.index} overlaps ${other.index}`).toBe(true);
      }
    }
  });

  it('packs masonry into the shortest column', () => {
    const slots = resolveLayout({ type: 'masonryGrid', count: 6, columns: 3 });
    const columns = new Set(slots.map((slot) => slot.x));
    expect(columns.size).toBe(3);
  });

  it('centers the focal device in a stack and pushes siblings outward', () => {
    const slots = resolveLayout({ type: 'deviceStack', count: 3 });
    expect(slots[1]!.x).toBe(0);
    expect(slots[1]!.emphasis).toBe('focal');
    expect(slots[0]!.x).toBeLessThan(0);
    expect(slots[2]!.x).toBeGreaterThan(0);
    expect(slots[0]!.width).toBeLessThan(slots[1]!.width);
    expect(slots[0]!.rotation).toBeLessThan(0);
    expect(slots[2]!.rotation).toBeGreaterThan(0);
  });

  it('gives floating collages a deterministic card fan', () => {
    const slots = resolveLayout({ type: 'floatingCollage', count: 5 });
    expect(slots.some((slot) => slot.rotation < 0)).toBe(true);
    expect(slots.some((slot) => slot.rotation > 0)).toBe(true);
  });

  it('splits a comparison layout into balanced halves', () => {
    const slots = resolveLayout({ type: 'comparisonLayout', count: 2, width: 1600, gap: 96 });
    expect(slots[0]!.x).toBe(-slots[1]!.x);
    expect(slots[0]!.width).toBe(slots[1]!.width);
  });

  it('returns nothing for an empty layout', () => {
    expect(resolveLayout({ type: 'bentoGrid', count: 0 })).toEqual([]);
  });

  it('describes every layout for selection', () => {
    expect(layoutDefinitions()).toHaveLength(LAYOUT_TYPES.length);
    for (const definition of layoutDefinitions()) {
      expect(definition.description.length).toBeGreaterThan(16);
      expect(definition.useCases.length).toBeGreaterThan(0);
      expect(definition.items.max).toBeGreaterThanOrEqual(definition.items.min);
      expect(isLayoutType(definition.type)).toBe(true);
    }
    expect(isLayoutType('notALayout')).toBe(false);
  });

  it('defaults to the safe composition frame', () => {
    const slots = resolveLayout({ type: 'heroLayout', count: 1 });
    expect(slots[0]!.width).toBeLessThanOrEqual(DEFAULT_FRAME.width);
    expect(slots[0]!.height).toBeLessThanOrEqual(DEFAULT_FRAME.height);
  });
});
