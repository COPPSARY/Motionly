import { describe, expect, it } from 'vitest';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { parseMotion } from '../../src/language/parser';

function animationsFor(source: string, target: string) {
  return buildSceneGraph(parseMotion(source)).animations.filter((item) => item.target === target);
}

describe('rotation presets', () => {
  it('spinIn carries rotationX/rotationY tilt targets through its keyframes when set', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 rotationX 20 scale 1 animation spinIn(duration 1s) }`,
      'icon'
    );
    expect(animation?.keyframes[0]?.properties.rotationX).toBe(20);
    expect(animation?.keyframes.at(-1)?.properties.rotationX).toBe(20);
  });

  it('rotateOut spins the element out and fades it while shrinking', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 scale 1 opacity 1 animation rotateOut(duration 0.5s turns 0.5) }`,
      'icon'
    );
    expect(animation?.from.opacity).toBe(1);
    expect(animation?.to.opacity).toBe(0);
    expect(animation?.to.rotation).toBe(180);
  });

  it('swing produces an oscillating keyframe curve around the resting rotation', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 animation swing(amplitude 10) }`,
      'icon'
    );
    const rotations = animation?.keyframes.map((frame) => frame.properties.rotation) ?? [];
    expect(rotations[0]).toBe(0);
    expect(rotations.at(-1)).toBe(0);
    expect(Math.max(...(rotations as number[]))).toBeGreaterThan(0);
  });

  it('pendulum swings between +/- amplitude and loops forever by default', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 animation pendulum(amplitude 20 duration 1s) }`,
      'icon'
    );
    expect(animation?.from.rotation).toBe(-20);
    expect(animation?.to.rotation).toBe(20);
    expect(animation?.repeat).toBe('infinite');
    expect(animation?.repeatType).toBe('yoyo');
  });

  it('rollIn sweeps in with a full-turn rotation tied to its travel distance', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { x 0 rotation 0 opacity 1 animation rollIn(distance 100 turns 1) }`,
      'icon'
    );
    expect(animation?.from.x).toBe(-100);
    expect(animation?.from.rotation).toBe(-360);
    expect(animation?.to.rotation).toBe(0);
  });

  it('rotateScale combines a scale-up with a rotation settle', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 scale 1 opacity 1 animation rotateScale }`,
      'icon'
    );
    expect(animation?.from.scale).toBeCloseTo(0.6, 5);
    expect(animation?.from.rotation).toBe(-45);
    expect(animation?.to.scale).toBe(1);
  });

  it('logoSpinReveal ties an SVG path draw-on to the settling spin', () => {
    const [animation] = animationsFor(
      `import "/logo.svg" as logo\nlogo { rotation 0 scale 1 opacity 1 animation logoSpinReveal }`,
      'logo'
    );
    expect(animation?.keyframes[0]?.properties.pathProgress).toBe(0);
    expect(
      animation?.keyframes.find((frame) => frame.offset === 0.7)?.properties.pathProgress
    ).toBe(1);
  });

  it('spin loops a continuous full rotation forever, honoring direction', () => {
    const [animation] = animationsFor(
      `import "/icon.svg" as icon\nicon { rotation 0 animation spin(direction ccw duration 2s) }`,
      'icon'
    );
    expect(animation?.from.rotation).toBe(0);
    expect(animation?.to.rotation).toBe(-360);
    expect(animation?.repeat).toBe('infinite');
    expect(animation?.easing).toBe('linear');
  });
});
