import { describe, expect, it } from 'vitest';
import { analyzeAssets, assetMappingPrompt } from '../../src/ai/asset-roles';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  archetypeRegistry,
  componentRegistry,
  effectRegistry,
  moveRegistry,
} from '../../src/semantic/catalog';

describe('motion catalog and archetypes', () => {
  it('keeps every runtime registry entry self-describing and versioned', () => {
    for (const registry of [
      effectRegistry(),
      moveRegistry(),
      componentRegistry(),
      archetypeRegistry(),
    ]) {
      expect(registry.length).toBeGreaterThan(0);
      for (const entry of registry) {
        expect(entry.version).toBe(1);
        expect(entry.docs.length).toBeGreaterThan(8);
        expect(Object.keys(entry.schema).length).toBeGreaterThan(0);
        expect(entry.defaults).toBeTypeOf('object');
      }
    }
  });

  it('round-trips theme and archetype source, then lowers it into themed editable layers', () => {
    const source = `
      canvas { duration 5s }
      theme {
        background #101820
        surface #182630
        text #F4F8FA
        muted #9BB0BA
        accent #4FE0B5
        secondary #7AA8FF
        displayFont "Inter, sans-serif"
        duration 800ms
        stagger 70ms
      }
      import "/hero.png" as hero
      archetype launch {
        type hero
        title "Build the real thing."
        subtitle "Archetypes own layout. Assets stay real."
        media hero
        duration 5s
        effects "meshGradient > grain > vignette"
      }
    `;
    const ast = parseMotion(source);
    const serialized = serializeProgram(ast);
    const scene = buildSceneGraph(parseMotion(serialized));

    expect(serialized).toContain('theme {');
    expect(serialized).toContain('archetype launch');
    expect(scene.theme.accent).toBe('#4FE0B5');
    expect(scene.theme.duration).toBe(0.8);
    expect(scene.theme.stagger).toBe(0.07);
    expect(scene.canvas.background).toBe('#101820');
    expect(scene.elements.some((element) => element.id === 'launch')).toBe(true);
    expect(
      scene.elements.find((element) => element.id === 'launch__title')?.properties
    ).toMatchObject({
      color: '#F4F8FA',
      font: 'Inter, sans-serif',
    });
    expect(scene.elements.find((element) => element.id === 'launch__media')).toMatchObject({
      kind: 'image',
      assetName: 'hero',
    });
    expect(scene.elements.filter((element) => element.kind === 'effect')).toHaveLength(3);
  });

  it('uses a semantic device stub instead of fake geometry when hero media is absent', () => {
    const scene = buildSceneGraph(
      parseMotion('archetype launch { type hero title "Add the product" }')
    );
    expect(scene.components.some((component) => component.id === 'launch__mediaFrame')).toBe(true);
    expect(scene.elements.find((element) => element.id === 'launch__mediaFrame')).toMatchObject({
      kind: 'group',
    });
  });

  it('maps filename roles, numeric order, device frames, and ambiguity deterministically', () => {
    const analyzed = analyzeAssets([
      { name: 'second', path: '/assets/feature-2.png', type: 'image', width: 1440, height: 900 },
      { name: 'first', path: '/assets/01-feature-1.jpg', type: 'image', width: 390, height: 844 },
      { name: 'logo', path: '/assets/logo.svg', type: 'svg', width: 400, height: 100 },
      { name: 'mystery', path: '/assets/photo.jpg', type: 'image', width: 1000, height: 1000 },
    ]);

    expect(analyzed.map((item) => item.asset.name)).toEqual(['first', 'second', 'logo', 'mystery']);
    expect(analyzed[0]).toMatchObject({ role: 'feature', order: 1, frame: 'phone' });
    expect(analyzed[1]).toMatchObject({ role: 'feature', order: 2, frame: 'browser' });
    expect(analyzed[2]).toMatchObject({ role: 'logo', frame: 'laptop' });
    expect(analyzed[3]?.ambiguous).toBe(true);
    expect(assetMappingPrompt(analyzed.map((item) => item.asset))).toContain(
      'Ask one concise mapping question'
    );
  });

  it('rejects unknown catalog names at the lowering boundary', () => {
    expect(() => buildSceneGraph(parseMotion('archetype nope { type invented }'))).toThrow(
      'unsupported type'
    );
    expect(() =>
      buildSceneGraph(
        parseMotion('overlay atmosphere { backgroundEffect "invented(duration 2s)" }')
      )
    ).toThrow('Unknown background effect');
  });
});
