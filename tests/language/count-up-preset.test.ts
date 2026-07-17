import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { formatCountValue } from '../../src/animation-library/count-up';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('countUp preset', () => {
  it('counts to numeric text with deterministic separator formatting', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        text total {
          value 12345.67
          center
          animation countUp(from 0 separator comma delay 0.5s duration 2s ease linear)
        }
      `)
    );
    const animation = scene.animations.find((item) => item.target === 'total');
    const element = scene.elements.find((item) => item.id === 'total');

    expect(animation?.from.value).toBe(0);
    expect(animation?.to.value).toBe(12345.67);
    expect(animation?.delay).toBe(0.5);
    expect(animation?.duration).toBe(2);
    expect(element?.properties.countSeparator).toBe(',');
    expect(element?.properties.countDecimals).toBe(2);
    expect(element?.properties.countTo).toBe(12345.67);
    expect(evaluateScene(scene, 0.25).elements[0]?.render.value).toBe(0);

    const midpoint = evaluateScene(scene, 1.5).elements.find((item) => item.id === 'total');
    expect(formatCountValue(midpoint?.render.value, ',', 2)).toBe('6,172.84');
  });

  it('reverses the endpoints when counting down', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        text total {
          value 100
          animation countUp(from 0 direction down duration 1s)
        }
      `)
    );
    const animation = scene.animations.find((item) => item.target === 'total');

    expect(animation?.from.value).toBe(100);
    expect(animation?.to.value).toBe(0);
    expect(evaluateScene(scene, 0).elements[0]?.render.value).toBe(100);
    expect(evaluateScene(scene, 1).elements[0]?.render.value).toBe(0);
  });

  it('round-trips the semantic preset through serialization', () => {
    const ast = parseMotion(`
      text total {
        value 1000
        animation countUp(from 25 separator comma direction up duration 1s)
      }
    `);
    const serialized = serializeProgram(ast);
    const reparsed = parseMotion(serialized);
    const element = reparsed.body.find((node) => node.type === 'Element' && node.name === 'total');

    expect(element?.type === 'Element' ? element.properties['animation'] : '').toBe(
      'countUp(from 25 separator comma direction up duration 1s)'
    );
  });

  it('prefers CountUp when an older text preset is still present', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        text total {
          value 5000
          center
          textAnimation fadeUp(duration 1s)
          animation countUp(from 0 separator comma duration 1s)
        }
      `)
    );

    expect(scene.elements.find((item) => item.id === 'total')?.properties.countSeparator).toBe(',');
    expect(scene.animations.find((item) => item.target === 'total')?.to.value).toBe(5000);
    expect(scene.elements.some((item) => item.id.startsWith('total__'))).toBe(false);
  });
});

describe('count value formatting', () => {
  it('supports custom grouping and fixed decimals', () => {
    expect(formatCountValue(1234567.5, ' ', 2)).toBe('1 234 567.50');
    expect(formatCountValue(99.9, '', 0)).toBe('100');
  });
});
