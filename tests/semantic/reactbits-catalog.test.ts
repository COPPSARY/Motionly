import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  canonicalEffectName,
  REACTBITS_EFFECT_ALIASES,
  REACTBITS_MOVE_ALIASES,
  componentRegistry,
  effectRegistry,
  moveRegistry,
} from '../../src/semantic/catalog';
import {
  PUBLISHED_SEMANTIC_COMPONENT_TYPES,
  REACTBITS_COMPONENT_ALIASES,
  SPECIALIZED_SEMANTIC_COMPONENT_TYPES,
} from '../../src/semantic/vector-registry';

describe('ReactBits catalog adapters', () => {
  it('publishes only component names with dedicated visual builders', () => {
    const moves = new Set(moveRegistry().map((entry) => entry.name));
    const effects = new Set(effectRegistry().map((entry) => entry.name));
    const components = new Set(componentRegistry().map((entry) => entry.name));

    for (const name of Object.keys(REACTBITS_MOVE_ALIASES)) expect(moves).toContain(name);
    for (const name of Object.keys(REACTBITS_EFFECT_ALIASES)) expect(effects).toContain(name);
    expect([...components].sort()).toEqual([...PUBLISHED_SEMANTIC_COMPONENT_TYPES].sort());
    for (const name of SPECIALIZED_SEMANTIC_COMPONENT_TYPES) expect(components).toContain(name);
    const specialized = new Set<string>(SPECIALIZED_SEMANTIC_COMPONENT_TYPES);
    for (const name of Object.keys(REACTBITS_COMPONENT_ALIASES).filter(
      (name) => !specialized.has(name)
    )) {
      expect(components).not.toContain(name);
    }
    expect(canonicalEffectName('beams')).toBe('prism');
  });

  it('lowers ReactBits text, background, card, and loader names into editable layers', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 4s }
        text title {
          value "Decrypt"
          center
          size 72
          textAnimation "decrypted-text(duration 600ms)"
        }
        overlay atmosphere {
          width 1920
          height 1080
          backgroundEffect "beams(duration 4s)"
        }
        component feature {
          type spotlight-card
          headline "Fast"
        }
        component progress {
          type loader-3
          label "Loading"
          countTo 68
        }
      `)
    );

    expect(scene.elements.some((element) => element.id.startsWith('title__chars_'))).toBe(true);
    expect(scene.elements.find((element) => element.id === 'atmosphere__beams')).toMatchObject({
      kind: 'effect',
    });
    expect(scene.elements.some((element) => element.id === 'feature__surface')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'progress__progress')).toBe(true);
  });

  it('keeps ReactBits text moves visually distinct', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 2s }
        text split { value "Split" center size 64 textAnimation "split-text(duration 500ms)" }
        text scramble { value "Scramble" center size 64 textAnimation "scrambled-text(duration 500ms)" }
        text rotate { value "Rotate" center size 64 textAnimation "rotating-text(duration 500ms)" }
        text decrypt { value "Decrypt" center size 64 textAnimation "decrypted-text(duration 500ms)" }
      `)
    );
    const first = (id: string) =>
      scene.animations.find((animation) => animation.target.startsWith(`${id}__chars_`))!;

    expect(first('split').keyframes[0]!.properties['rotation']).not.toBe(0);
    expect(first('scramble').keyframes).toHaveLength(4);
    expect(first('rotate').keyframes[0]!.properties['scale']).toBeLessThan(1);
    expect(first('decrypt').keyframes[0]!.properties['blur']).toBe(14);
  });
});
