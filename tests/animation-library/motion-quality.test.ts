import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('overshoot and anticipation', () => {
  it('leaves a plain preset entrance unchanged when neither option is set', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/logo.svg" as logo
      logo { animation softReveal(duration 1s) }
    `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    expect(animation?.keyframes).toHaveLength(0);
  });

  it('adds a pre-move dip and extends duration when anticipation is set', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/logo.svg" as logo
      logo { y 0 animation softReveal(duration 1s anticipation 200ms) }
    `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    expect(animation?.duration).toBeCloseTo(1.2, 5);
    expect(animation?.keyframes[0]?.offset).toBe(0);
    expect(animation?.keyframes[0]?.properties.y).toBeGreaterThan(0);
  });

  it('adds a settle-past-target peak keyframe when overshoot is set', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/logo.svg" as logo
      logo { scale 1 animation softReveal(duration 1s overshoot 1.1) }
    `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    const offsets = animation?.keyframes.map((frame) => frame.offset) ?? [];
    expect(offsets[offsets.length - 2]).toBeCloseTo(0.82, 5);
    const peak = animation?.keyframes[animation.keyframes.length - 2];
    expect(peak?.properties.scale).toBeCloseTo(1.1, 5);
    const final = animation?.keyframes[animation.keyframes.length - 1];
    expect(final?.properties.scale).toBe(1);
  });

  it('does not touch presets that already choreograph their own keyframes', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/logo.svg" as logo
      logo { animation dynamicSlide(duration 1s overshoot 1.2 anticipation 200ms) }
    `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    expect(animation?.duration).toBe(1);
    expect(animation?.keyframes).toHaveLength(3);
  });
});

describe('followThrough secondary motion', () => {
  it('lags and dampens a child element behind its parent', () => {
    const source = `
      canvas { duration 2s }
      text card { value "Card" x 0 }
      animate card {
        from { x 0 }
        to { x 100 }
        duration 1s
        easing linear
      }
      text glow {
        value "*"
        x 0
        followThrough card
        followThroughLag 0.2s
        followThroughDamping 0.5
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const frame = evaluateScene(scene, 0.6);
    const glow = frame.elements.find((element) => element.id === 'glow');
    // card at t=0.6 is at x=60; lagged parent at t=0.4 is at x=40; delta=40; damped by .5 => +20
    expect(glow?.render.x).toBeCloseTo(20, 5);
  });

  it('round-trips followThrough properties through the serializer', () => {
    const program = parseMotion(`
      text card { value "Card" }
      text glow { value "*" followThrough card followThroughLag 150ms followThroughDamping .4 }
    `);
    const serialized = serializeProgram(program);
    expect(serialized).toContain('followThrough card');
    const glow = buildSceneGraph(parseMotion(serialized)).elements.find(
      (item) => item.id === 'glow'
    );
    expect(glow?.properties).toMatchObject({
      followThrough: 'card',
      followThroughLag: 0.15,
      followThroughDamping: 0.4,
    });
  });

  it('rejects missing parents, self-reference, and chained follow-through', () => {
    expect(() =>
      buildSceneGraph(parseMotion('text a { value "A" followThrough missing }'))
    ).toThrow('does not exist');
    expect(() => buildSceneGraph(parseMotion('text a { value "A" followThrough a }'))).toThrow(
      'cannot follow through on itself'
    );
    expect(() =>
      buildSceneGraph(
        parseMotion(
          'text a { value "A" followThrough b }\ntext b { value "B" followThrough c }\ntext c { value "C" }'
        )
      )
    ).toThrow('Chained followThrough is not supported');
  });
});

describe('sequence hierarchy stagger', () => {
  it('applies a linear stagger to preset-driven elements by default', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/icon.svg" as one
      import "/icon.svg" as two
      import "/icon.svg" as three

      sequence icons {
        items one two three
        delay 1s
        gap 0.1s
      }

      one { sequence icons animation softReveal(duration 0.5s) }
      two { sequence icons animation softReveal(duration 0.5s) }
      three { sequence icons animation softReveal(duration 0.5s) }
    `)
    );
    const delays = ['one', 'two', 'three'].map(
      (id) => scene.animations.find((item) => item.target === id)?.delay
    );
    expect(delays).toEqual([1, 1.1, 1.2]);
  });

  it('distributes center-out hierarchy symmetrically around the middle member', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/icon.svg" as one
      import "/icon.svg" as two
      import "/icon.svg" as three

      sequence icons {
        items one two three
        delay 1s
        gap 0.1s
        hierarchy center-out
      }

      one { sequence icons animation softReveal(duration 0.5s) }
      two { sequence icons animation softReveal(duration 0.5s) }
      three { sequence icons animation softReveal(duration 0.5s) }
    `)
    );
    const delays = ['one', 'two', 'three'].map(
      (id) => scene.animations.find((item) => item.target === id)?.delay
    );
    expect(delays[1]).toBeCloseTo(1, 5);
    expect(delays[0]).toBeCloseTo(1.1, 5);
    expect(delays[2]).toBeCloseTo(1.1, 5);
  });

  it('does not add the stagger offset to an already-absolute exitAt time', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      canvas { duration 20s }
      import "/icon.svg" as one

      sequence icons {
        items one
        delay 5s
        gap 0.1s
      }

      one { sequence icons animation cardReveal(duration 0.5s exitAt 10s exitDuration 0.3s) }
    `)
    );
    const animations = scene.animations.filter((item) => item.target === 'one');
    expect(animations[0]?.delay).toBeCloseTo(5, 5);
    expect(animations[1]?.delay).toBeCloseTo(10, 5);
  });
});
