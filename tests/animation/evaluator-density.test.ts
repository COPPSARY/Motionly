import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('dense scene evaluation', () => {
  it('reuses prepared scene data without changing frame results', () => {
    const layers = Array.from(
      { length: 120 },
      (_, index) => `
        text layer${index} {
          value "Layer ${index}"
          x ${index}
          y 0
        }

        animate layer${index} {
          from { y 0 }
          to { y 100 }
          duration 1s
          easing linear
        }
      `
    ).join('\n');
    const scene = buildSceneGraph(parseMotion(`canvas { duration 10s }\n${layers}`));

    const middle = evaluateScene(scene, 0.5);
    const end = evaluateScene(scene, 1);

    expect(middle.elements).toHaveLength(120);
    expect(middle.elements[80]?.render).toMatchObject({ x: 80, y: 50 });
    expect(end.elements[80]?.render).toMatchObject({ x: 80, y: 100 });
  });
});
