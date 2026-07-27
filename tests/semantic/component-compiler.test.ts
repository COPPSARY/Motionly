import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { semanticVectorDefinitions } from '../../src/semantic/vector-registry';

describe('semantic vector components', () => {
  const source = `
    canvas { duration 6s }
    component cloudHub {
      type cloud
      provider phosphor
      role main
      intent focus
      behavior premiumReveal float glow
      x -180
      y -40
      width 260
      color #8ab4ff
      accent #7cf7c5
      connects dataStore
      relationship dataFlow
    }
    component dataStore {
      type database
      provider lucide
      role supporting
      behavior stackReveal pulse
      x 260
      y 120
      width 160
      color #ffffff
      delay 600ms
    }
  `;

  it('round-trips semantic source and lowers it into existing scene nodes', () => {
    const program = parseMotion(source);
    const serialized = serializeProgram(program);
    const reparsed = parseMotion(serialized);
    const scene = buildSceneGraph(reparsed);

    expect(serialized).toContain('component cloudHub');
    expect(reparsed.body.some((node) => node.type === 'Element' && node.kind === 'component')).toBe(
      true
    );
    expect(scene.components).toHaveLength(2);
    expect(scene.components[0]).toMatchObject({
      id: 'cloudHub',
      type: 'cloud',
      provider: 'phosphor',
      role: 'main',
      intent: 'focus',
    });
    expect(scene.relationships).toHaveLength(1);
    expect(scene.relationships[0]).toMatchObject({ from: 'cloudHub', to: 'dataStore' });
    expect(scene.imports.every((asset) => asset.path.startsWith('data:image/svg+xml'))).toBe(true);
    expect(scene.elements.find((element) => element.id === 'cloudHub')).toMatchObject({
      kind: 'group',
    });
    expect(scene.elements.find((element) => element.id === 'cloudHub__glyph')).toMatchObject({
      kind: 'image',
      assetName: '__semantic_cloud',
    });
    expect(scene.elements.some((element) => element.id.includes('__to__'))).toBe(true);
    expect(scene.elements.some((element) => element.id.endsWith('__particle'))).toBe(true);
    expect(scene.animations.some((animation) => animation.target === 'cloudHub')).toBe(true);
    const cloud = scene.components.find((component) => component.id === 'cloudHub')!;
    expect(cloud.childElementIds).toContain('cloudHub__glyph');
  });

  it('evaluates connection drawing and repeated data travel through AnimationNode', () => {
    const scene = buildSceneGraph(parseMotion(source));
    const relationship = scene.relationships[0]!;
    const particleId = relationship.particleElementIds[0]!;
    const early = evaluateScene(scene, 1.1).elements.find((element) => element.id === particleId);
    const later = evaluateScene(scene, 2.1).elements.find((element) => element.id === particleId);

    expect(early).toBeDefined();
    expect(later).toBeDefined();
    expect(later?.render.x).not.toBe(early?.render.x);
    expect(later?.render.opacity).toBeGreaterThan(0);
  });

  it('uses imported custom SVG sources while preserving semantic metadata', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        import "/brand.svg" as brand
        component brandMark {
          type logo
          source brand
          role main
          behavior draw
        }
      `)
    );
    expect(scene.imports).toHaveLength(1);
    expect(scene.elements.find((element) => element.id === 'brandMark__glyph')).toMatchObject({
      kind: 'image',
      assetName: 'brand',
    });
    expect(scene.components[0]).toMatchObject({ provider: 'custom', source: 'brand' });
    expect(() =>
      buildSceneGraph(parseMotion('component brandMark { type logo source missing }'))
    ).toThrow('references missing imported source "missing"');
  });

  it('keeps relationship geometry attached to evaluated component motion', () => {
    const scene = buildSceneGraph(parseMotion(source));
    const frame = evaluateScene(scene, 3);
    const cloud = frame.elements.find((element) => element.id === 'cloudHub')!;
    const connector = frame.elements.find(
      (element) => element.id === scene.relationships[0]?.connectorElementId
    )!;
    const authoredConnector = scene.elements.find((element) => element.id === connector.id)!;
    const connectorRender = connector.render as unknown as Record<string, unknown>;

    expect(cloud.render.y).not.toBe(cloud.properties.y);
    expect(connector.render.y).not.toBe(authoredConnector.properties.y);
    expect(Number(connectorRender['x2'])).not.toBe(0);
    expect(Number(connectorRender['y2'])).not.toBe(0);
  });

  it('fades generated relationships with their semantic endpoints', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 4s }
        component source {
          type cloud
          behavior none
          x -200
          connects target
        }
        component target {
          type database
          behavior none
          x 200
        }
        animate source {
          from { opacity 1 }
          to { opacity 0 }
          delay 2s
          duration 1s
          easing linear
        }
      `)
    );
    const relationship = scene.relationships[0]!;
    const connectorId = relationship.connectorElementId;
    const particleId = relationship.particleElementIds[0]!;
    const opacityAt = (id: string, time: number) =>
      Number(
        evaluateScene(scene, time).elements.find((element) => element.id === id)?.render.opacity
      );

    expect(opacityAt(connectorId, 2.5)).toBeCloseTo(opacityAt(connectorId, 2) * 0.5);
    expect(opacityAt(connectorId, 3)).toBe(0);
    expect(opacityAt(particleId, 3)).toBe(0);
  });

  it('preserves explicit paint and animation precedence and deduplicates built-in vectors', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        component primary {
          type cloud
          behavior none
          fill #ff3366
        }
        component secondary {
          type cloud
          behavior none
          x 300
        }
        animate primary {
          from { x -20 }
          to { x 20 }
          duration 1s
          easing linear
        }
      `)
    );
    const glyph = scene.elements.find((element) => element.id === 'primary__glyph')!;
    expect(glyph.properties.fill).toBe('#ff3366');
    expect(scene.imports).toHaveLength(1);
    expect(scene.animations.filter((animation) => animation.target === 'primary')).toHaveLength(1);
    expect(scene.animations.find((animation) => animation.target === 'primary')).toMatchObject({
      from: { x: -20 },
      to: { x: 20 },
    });
  });

  it('rejects missing relationship targets instead of silently drawing broken scenes', () => {
    expect(() =>
      buildSceneGraph(parseMotion('component cloudHub { type cloud connects missing }'))
    ).toThrow('references missing component "missing"');
    expect(() =>
      buildSceneGraph(parseMotion('component cloudHub { type cloud connects cloudHub }'))
    ).toThrow('cannot connect to itself');
  });

  it('registers the requested vocabulary across all four upstream providers', () => {
    const definitions = semanticVectorDefinitions();
    expect(definitions.map((definition) => definition.type)).toEqual(
      expect.arrayContaining([
        'cloud',
        'database',
        'server',
        'arrow',
        'button',
        'dashboard',
        'phone',
        'browser',
        'logo',
      ])
    );
    expect(new Set(definitions.map((definition) => definition.provider))).toEqual(
      new Set(['phosphor', 'lucide', 'heroicons', 'tabler', 'motionly'])
    );
  });

  it('leaves legacy projects on the original flat scene path', () => {
    const scene = buildSceneGraph(parseMotion('text title { value "Legacy" x 20 }'));
    expect(scene.components).toEqual([]);
    expect(scene.relationships).toEqual([]);
    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0]).toMatchObject({ id: 'title', kind: 'text' });
  });
});
