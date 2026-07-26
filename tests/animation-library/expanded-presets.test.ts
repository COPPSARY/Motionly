import { describe, expect, it } from 'vitest';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';

function animationFor(source: string, target: string) {
  return buildSceneGraph(parseMotion(source)).animations.find((item) => item.target === target);
}

describe('icon animation presets', () => {
  it('gives springIn a real overlapping-easing keyframe curve, not the generic fallback', () => {
    const animation = animationFor(
      `import "/icon.svg" as icon\nicon { y 0 animation springIn(duration 1s) }`,
      'icon'
    );
    expect(animation?.keyframes.length).toBeGreaterThan(1);
    expect(animation?.keyframes.at(-1)?.easing).toContain('elastic');
  });

  it('drops bounceIn from above with a bounce easing curve', () => {
    const animation = animationFor(
      `import "/icon.svg" as icon\nicon { y 0 animation bounceIn(duration 1s distance 100) }`,
      'icon'
    );
    expect(animation?.from.y).toBe(-100);
    expect(animation?.to.y).toBe(0);
    expect(animation?.easing).toBe('bounceOut');
  });

  it('gives scaleReveal a real elastic scale-in instead of the generic fallback', () => {
    const animation = animationFor(
      `import "/icon.svg" as icon\nicon { scale 1 animation scaleReveal(duration 1s) }`,
      'icon'
    );
    expect(animation?.from.scale).toBeCloseTo(0.2, 5);
    expect(animation?.to.scale).toBe(1);
  });

  it('spins a full rotation entrance for spinIn with overshoot and settle', () => {
    const animation = animationFor(
      `import "/icon.svg" as icon\nicon { rotation 0 scale 1 animation spinIn(duration 1s) }`,
      'icon'
    );
    const offsets = animation?.keyframes.map((frame) => frame.offset) ?? [];
    expect(offsets).toEqual([0, 0.55, 1]);
    expect(animation?.keyframes[0]?.properties.rotation).toBeLessThan(-100);
    expect(animation?.keyframes.at(-1)?.properties.rotation).toBe(0);
  });
});

describe('image/media animation presets', () => {
  it('drifts position and scale continuously for kenBurns, independent of the camera', () => {
    const animation = animationFor(
      `import "/photo.png" as photo\nphoto { x 0 y 0 scale 1 animation kenBurns(duration 4s) }`,
      'photo'
    );
    expect(animation?.keyframes).toHaveLength(0);
    expect(animation?.to.scale).toBeCloseTo(1.08, 5);
    expect(animation?.to.x).toBe(40);
  });

  it('approximates perspective with skew/rotation for tiltReveal', () => {
    const animation = animationFor(
      `import "/card.png" as card\ncard { rotation 0 scale 1 animation tiltReveal(duration 1s) }`,
      'card'
    );
    expect(animation?.from.skewX).toBe(-8);
    expect(animation?.to.skewX).toBe(0);
    expect(animation?.from.rotation).toBe(-6);
  });
});

describe('UI-component animation presets', () => {
  it('lifts a card with rising shadow elevation for cardReveal', () => {
    const animation = animationFor(
      `overlay card { shape rect width 200 height 100 shadow 24 animation cardReveal(duration 1s) }`,
      'card'
    );
    expect(animation?.from.shadow).toBe(0);
    expect(animation?.to.shadow).toBe(24);
  });

  it('uses a short snappy default duration for buttonPop', () => {
    const animation = animationFor(
      `overlay button { shape rect width 120 height 40 animation buttonPop() }`,
      'button'
    );
    expect(animation?.duration).toBe(0.45);
    expect(animation?.easing).toBe('spring');
  });

  it('animates width from 0 for progressFill instead of relying on pathProgress', () => {
    const animation = animationFor(
      `overlay bar { shape rect originX 0 width 240 height 8 animation progressFill(duration 1s) }`,
      'bar'
    );
    expect(animation?.from.width).toBe(0);
    expect(animation?.to.width).toBe(240);
  });
});

describe('SVG trim path and motion path properties', () => {
  it('round-trips trimStart alongside pathProgress-driven drawSVG', () => {
    const program = parseMotion(`
      import "/logo.svg" as logo
      logo { trimStart .2 animation drawSVG(duration 1s) }
    `);
    const serialized = serializeProgram(program);
    expect(serialized).toContain('trimStart .2');
    const scene = buildSceneGraph(parseMotion(serialized));
    const logo = scene.elements.find((item) => item.id === 'logo');
    expect((logo?.properties as unknown as Record<string, unknown>).trimStart).toBe(0.2);
  });

  it('round-trips motionPath, motionPathProgress, and motionPathRotate', () => {
    const program = parseMotion(`
      import "/guide.svg" as guide
      import "/icon.svg" as icon
      icon {
        motionPath guide
        motionPathProgress 0.4
        motionPathRotate
      }
    `);
    const serialized = serializeProgram(program);
    expect(serialized).toContain('motionPath guide');
    expect(serialized).toContain('motionPathRotate');
    const scene = buildSceneGraph(parseMotion(serialized));
    const icon = scene.elements.find((item) => item.id === 'icon');
    expect(icon?.properties).toMatchObject({
      motionPath: 'guide',
      motionPathProgress: 0.4,
      motionPathRotate: true,
    });
  });
});
