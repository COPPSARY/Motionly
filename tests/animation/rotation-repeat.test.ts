import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';

function evalRotation(source: string, time: number): number {
  const scene = buildSceneGraph(parseMotion(source));
  const frame = evaluateScene(scene, time);
  return Number((frame.elements[0]?.render as unknown as Record<string, unknown>)['rotation']);
}

describe('rotation direction + repeat/yoyo', () => {
  it('preserves a literal multi-turn sweep by default (auto)', () => {
    const source = `
      canvas { duration 5s }
      image logo { source "logo.svg" }
      animate logo {
        from { rotation 0 }
        to { rotation 720 }
        duration 2s
        easing linear
      }
    `;
    expect(evalRotation(source, 1)).toBeCloseTo(360, 5);
    expect(evalRotation(source, 2)).toBeCloseTo(720, 5);
  });

  it('forces a positive delta when rotationDirection is cw', () => {
    const source = `
      canvas { duration 5s }
      image logo { source "logo.svg" rotation 350 rotationDirection cw }
      animate logo {
        from { rotation 350 }
        to { rotation 10 }
        duration 2s
        easing linear
      }
    `;
    // literal delta would be -340; forced cw nudges it to +20, so the midpoint
    // overshoots past 360 instead of sliding straight down to 10.
    expect(evalRotation(source, 1)).toBeCloseTo(360, 5);
    expect(evalRotation(source, 2)).toBeCloseTo(10, 5);
  });

  it('loops a repeated animation back to its start each cycle', () => {
    const source = `
      canvas { duration 5s }
      image logo { source "logo.svg" }
      animate logo {
        from { rotation 0 }
        to { rotation 90 }
        duration 1s
        easing linear
        repeat infinite
        repeatType loop
      }
    `;
    expect(evalRotation(source, 0.5)).toBeCloseTo(45, 5);
    expect(evalRotation(source, 1.5)).toBeCloseTo(45, 5);
    expect(evalRotation(source, 2.25)).toBeCloseTo(22.5, 5);
  });

  it('alternates direction each cycle for yoyo repeat', () => {
    const source = `
      canvas { duration 5s }
      image logo { source "logo.svg" }
      animate logo {
        from { rotation 0 }
        to { rotation 90 }
        duration 1s
        easing linear
        repeat infinite
        repeatType yoyo
      }
    `;
    expect(evalRotation(source, 0.5)).toBeCloseTo(45, 5);
    expect(evalRotation(source, 1)).toBeCloseTo(90, 5);
    expect(evalRotation(source, 1.25)).toBeCloseTo(67.5, 5);
    expect(evalRotation(source, 1.5)).toBeCloseTo(45, 5);
  });

  it('holds at the end of a finite repeat count', () => {
    const source = `
      canvas { duration 5s }
      image logo { source "logo.svg" }
      animate logo {
        from { rotation 0 }
        to { rotation 90 }
        duration 1s
        easing linear
        repeat 2
        repeatType loop
      }
    `;
    expect(evalRotation(source, 2)).toBeCloseTo(90, 5);
    expect(evalRotation(source, 3)).toBeCloseTo(90, 5);
  });
});
