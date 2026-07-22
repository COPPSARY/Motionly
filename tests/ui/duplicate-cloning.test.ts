import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { cloneClipInProgram, cloneElementInProgram } from '../../src/ui/duplicate-cloning';

describe('editor duplication helpers', () => {
  it('duplicates an asset with a same-path import alias and independent animation data', () => {
    const program = parseMotion(`
      canvas { duration 5s }
      import "./assets/card.png" as card
      card { x 10 y 20 }
      animate card {
        keyframes {
          0% { opacity 0 }
          100% { opacity 1 }
        }
        duration 1s
      }
    `);

    const result = cloneElementInProgram(program, 'card')!;
    const source = serializeProgram(result.program);
    const reparsed = parseMotion(source);
    const alias = reparsed.body.find((node) => node.type === 'Import' && node.name === result.id);
    const animation = reparsed.body.find(
      (node) => node.type === 'Animation' && node.target === result.id
    );

    expect(result.id).toBe('card_copy');
    expect(alias).toMatchObject({ path: './assets/card.png', name: 'card_copy' });
    expect(animation).toMatchObject({
      target: 'card_copy',
      keyframes: [
        { offset: 0, properties: { opacity: '0' } },
        { offset: 1, properties: { opacity: '1' } },
      ],
    });
    const scene = buildSceneGraph(reparsed);
    expect(scene.elements.find((element) => element.id === result.id)?.asset).toMatchObject({
      name: 'card_copy',
      path: './assets/card.png',
    });
    expect(scene.animations.find((item) => item.target === result.id)?.keyframes).toMatchObject([
      { offset: 0, properties: { opacity: 0 } },
      { offset: 1, properties: { opacity: 1 } },
    ]);
  });

  it('duplicates a full clip inside the timeline, drops transitions, and returns its runtime ID', () => {
    const program = parseMotion(`
      canvas { duration 5s }
      import "./assets/card.png" as card
      clip card {
        track main
        start 3s
        duration 2s
        trimIn 0s
        trimOut 0s
        transitionIn crossfade
        transitionInDuration 400ms
        transitionOut crossfade
        transitionOutDuration 400ms
      }
    `);
    const sourceClip = buildSceneGraph(program).clips[0]!;
    const result = cloneClipInProgram(program, 0, sourceClip, 5, 1 / 60)!;
    const source = serializeProgram(result.program);
    const scene = buildSceneGraph(parseMotion(source));
    const clone = scene.clips.find((clip) => clip.id === result.id);

    expect(result.id).toBe('clip_card_1');
    expect(clone).toMatchObject({ start: 3, duration: 2, trimIn: 0, trimOut: 0 });
    expect(clone?.transitionIn).toBeUndefined();
    expect(clone?.transitionOut).toBeUndefined();
    expect(clone?.transitionInDuration).toBe(0);
    expect(clone?.transitionOutDuration).toBe(0);
  });
});
