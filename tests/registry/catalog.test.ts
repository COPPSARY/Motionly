import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESET_CATALOG } from '../../src/presets/catalog';
import {
  archetypeRegistry,
  beatRegistry,
  componentRegistry,
  effectRegistry,
  layoutRegistry,
  moveRegistry,
  showcaseRegistry,
} from '../../src/semantic/catalog';

const registry = JSON.parse(readFileSync(resolve('registry/registry.json'), 'utf8'));

describe('Motionly registry catalog', () => {
  it('publishes every engine entry and standalone preset exactly once', () => {
    const expected =
      moveRegistry().length +
      effectRegistry().length +
      componentRegistry().length +
      showcaseRegistry().length +
      layoutRegistry().length +
      beatRegistry().length +
      archetypeRegistry().length +
      PRESET_CATALOG.length;

    expect(registry.items).toHaveLength(expected);
    expect(new Set(registry.items.map((item: { manifest: string }) => item.manifest)).size).toBe(
      expected
    );
    for (const item of registry.items) {
      expect(existsSync(resolve('registry', item.manifest)), item.manifest).toBe(true);
    }
  });

  it('publishes the motion system as installable registry types', () => {
    const types = new Set(registry.items.map((item: { type: string }) => item.type));
    expect(types).toContain('motionly:showcase');
    expect(types).toContain('motionly:layout');
    expect(types).toContain('motionly:beat');
  });

  it('keeps every preset in its own source folder', () => {
    for (const preset of PRESET_CATALOG) {
      expect(preset.projectPath.startsWith(`preset/${preset.name}/`)).toBe(true);
      expect(existsSync(resolve(preset.projectPath))).toBe(true);
    }
  });

  /**
   * The editor loads presets over HTTP from `preset/`, served by the
   * `preset-assets` Vite plugin. A second copy under `public/preset/` used to
   * shadow it, so edits to the packaged preset were invisible in the editor.
   */
  it('serves presets from one place, with no shadow copy in public', () => {
    expect(existsSync(resolve('public/preset'))).toBe(false);
    for (const preset of PRESET_CATALOG) {
      expect(existsSync(resolve('public', preset.projectPath)), preset.name).toBe(false);
    }
  });
});
