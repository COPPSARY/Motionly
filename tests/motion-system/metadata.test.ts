import { describe, expect, it } from 'vitest';
import {
  findMotionComponent,
  metadataPrompt,
  motionComponentMetadata,
  selectComponents,
} from '../../src/motion-system/metadata';
import { LAYOUT_TYPES } from '../../src/motion-system/layout';
import { SHOWCASE_TYPES } from '../../src/motion-system/showcase';
import { ASSET_KINDS } from '../../src/motion-system/asset-kinds';
import {
  archetypeRegistry,
  beatRegistry,
  layoutRegistry,
  showcaseRegistry,
} from '../../src/semantic/catalog';
import { SEMANTIC_COMPONENT_TYPES } from '../../src/semantic/vector-registry';

describe('motion component metadata', () => {
  it('describes every selectable block with complete, valid metadata', () => {
    const entries = motionComponentMetadata();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.name, JSON.stringify(entry)).toBeTruthy();
      expect(entry.description.length, entry.name).toBeGreaterThan(12);
      expect(entry.useCases.length, entry.name).toBeGreaterThan(0);
      expect(entry.inputs.length, entry.name).toBeGreaterThan(0);
      expect(entry.animations.length, entry.name).toBeGreaterThan(0);
      for (const kind of entry.assetKinds) {
        expect(ASSET_KINDS, `${entry.name} asset kind`).toContain(kind);
      }
    }
  });

  it('has no duplicate names within a kind', () => {
    const seen = new Set<string>();
    for (const entry of motionComponentMetadata()) {
      const key = `${entry.kind}:${entry.name}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('covers every layout, showcase, component, and archetype', () => {
    const names = (kind: string) =>
      motionComponentMetadata()
        .filter((entry) => entry.kind === kind)
        .map((entry) => entry.name)
        .sort();
    expect(names('layout')).toEqual([...LAYOUT_TYPES].sort());
    expect(names('showcase')).toEqual([...SHOWCASE_TYPES].sort());
    expect(names('component')).toEqual([...SEMANTIC_COMPONENT_TYPES].sort());
    expect(names('archetype')).toEqual(
      archetypeRegistry()
        .map((entry) => entry.name)
        .sort()
    );
  });

  it('keeps metadata and the runtime catalog in sync', () => {
    for (const entry of [...layoutRegistry(), ...showcaseRegistry()]) {
      expect(findMotionComponent(entry.name), entry.name).toBeDefined();
    }
  });

  it('publishes layouts, showcases, and beats as versioned catalog entries', () => {
    for (const registry of [layoutRegistry(), showcaseRegistry(), beatRegistry()]) {
      expect(registry.length).toBeGreaterThan(0);
      for (const entry of registry) {
        expect(entry.version).toBe(1);
        expect(entry.docs.length).toBeGreaterThan(16);
        expect(Object.keys(entry.schema).length).toBeGreaterThan(0);
      }
    }
  });

  it('selects a device showcase for a mobile screenshot', () => {
    const results = selectComponents({ intent: 'mobile app launch', assetKind: 'screenshot' });
    expect(results[0]!.metadata.name).toBe('phoneShowcase');
  });

  it('selects a grid for many feature icons', () => {
    const results = selectComponents({
      intent: 'feature showcase',
      kind: 'layout',
      assetKind: 'icon',
      count: 6,
    });
    expect(results.map((result) => result.metadata.name)).toContain('bentoGrid');
    for (const result of results) {
      expect(result.metadata.kind).toBe('layout');
    }
  });

  it('filters layouts by how many items they can hold', () => {
    const many = selectComponents({ intent: 'social proof', kind: 'layout', count: 18 });
    expect(many.map((result) => result.metadata.name)).toContain('logoWall');
    const few = selectComponents({ intent: 'social proof', kind: 'layout', count: 18 }).filter(
      (result) => result.metadata.name === 'deviceStack'
    );
    expect(few).toHaveLength(0);
  });

  it('does not promote unrelated blocks through the asset-kind bonus', () => {
    // Every candidate here presents logos, so only intent should separate them.
    const results = selectComponents({ intent: 'social proof', assetKind: 'logo' }, 20);
    const wall = results.find((result) => result.metadata.name === 'logoWall')!;
    const cta = results.find((result) => result.metadata.name === 'cta')!;
    expect(wall.score).toBeGreaterThan(0);
    expect(cta.score).toBe(0);
    expect(results.indexOf(wall)).toBeLessThan(results.indexOf(cta));
  });

  it('treats assetKind as a filter, not a hint', () => {
    for (const result of selectComponents({ intent: 'feature showcase', assetKind: 'icon' }, 20)) {
      expect(result.metadata.assetKinds, result.metadata.name).toContain('icon');
    }
  });

  it('is deterministic and ranks exact names first', () => {
    const query = { intent: 'bentoGrid' };
    expect(selectComponents(query)).toEqual(selectComponents(query));
    expect(selectComponents(query)[0]!.metadata.name).toBe('bentoGrid');
  });

  it('builds a prompt index the model can select from', () => {
    const prompt = metadataPrompt();
    expect(prompt).toContain('select blocks by name');
    for (const type of SHOWCASE_TYPES) expect(prompt).toContain(type);
    for (const type of LAYOUT_TYPES) expect(prompt).toContain(type);
    expect(prompt).toContain('Items: 3-9');
  });
});
