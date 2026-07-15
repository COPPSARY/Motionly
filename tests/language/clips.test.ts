import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('timeline clips', () => {
  it('normalizes time units and renders visual tracks back-to-front', () => {
    const ast = parseMotion(`
      canvas {
        duration 8s
      }
      import "/back.svg" as back
      import "/front.svg" as front
      back {
        center
        width 200
      }
      front {
        center
        width 200
      }
      clip front {
        track 2
        start 1.25s
        duration 3s
        trimIn 250ms
        trimOut 0s
      }
      clip back {
        track 1
        start 1s
        duration 4s
        trimIn 0s
        trimOut 500ms
      }
    `);
    const scene = buildSceneGraph(ast);

    expect(
      scene.clips.map(({ start, duration, trimIn, trimOut }) => ({
        start,
        duration,
        trimIn,
        trimOut,
      }))
    ).toEqual([
      { start: 1.25, duration: 3, trimIn: 0.25, trimOut: 0 },
      { start: 1, duration: 4, trimIn: 0, trimOut: 0.5 },
    ]);
    expect(evaluateScene(scene, 2).elements.map((element) => element.assetName)).toEqual([
      'back',
      'front',
    ]);
    expect(evaluateScene(scene, 0).elements).toHaveLength(0);
    expect(buildSceneGraph(parseMotion(serializeProgram(ast))).clips).toHaveLength(2);
  });
});
