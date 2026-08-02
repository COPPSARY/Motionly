import { describe, expect, it } from 'vitest';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { moveRegistry } from '../../src/semantic/catalog';

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

  it('gives scaleReveal a restrained premium scale-in', () => {
    const animation = animationFor(
      `import "/icon.svg" as icon\nicon { scale 1 animation scaleReveal(duration 1s) }`,
      'icon'
    );
    expect(animation?.from.scale).toBeCloseTo(0.9, 5);
    expect(animation?.to.scale).toBe(1);
    expect(animation?.easing).toBe('power4.out');
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

describe('whole-scene transition presets', () => {
  it('publishes distinct whip, focus, and pivot handoffs', () => {
    const signatures = ['sceneWhip', 'sceneFocus', 'scenePivot'].map((name) => {
      const scene = buildSceneGraph(
        parseMotion(`
          scene shot {
            duration 2s
            clear
            transitionIn "${name}(duration .6s)"
          }
          text title { scene shot value "Motionly" }
        `)
      );
      const animation = scene.animations.find((item) => item.target === 'shot')!;
      expect(animation.duration, name).toBeCloseTo(0.6);
      expect(animation.to, name).toMatchObject({ x: 0, y: 0, scale: 1 });
      return JSON.stringify([animation.from, animation.to]);
    });
    expect(new Set(signatures).size).toBe(3);
  });

  it('keeps depth transitions covered and restrained', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        scene shot {
          duration 2s
          clear
          transitionIn "sceneZoom(duration .5s)"
        }
        text title { scene shot value "Motionly" }
      `)
    );
    const animation = scene.animations.find((item) => item.target === 'shot')!;
    expect(animation.duration).toBe(0.5);
    expect(animation.from).toMatchObject({ opacity: 1, scale: 0.96, blur: 3 });
    expect(animation.to).toMatchObject({ opacity: 1, scale: 1, blur: 0 });
  });
});

describe('UI-component animation presets', () => {
  it('uses compact transition travel and scale defaults', () => {
    const slide = animationFor(
      `overlay panel { shape rect x 0 y 0 scale 1 animation dynamicSlide() }`,
      'panel'
    )!;
    const popover = animationFor(
      `overlay panel { shape rect x 0 y 0 scale 1 animation popover() }`,
      'panel'
    )!;
    expect(slide.keyframes[0]?.properties).toMatchObject({ x: 30, scale: 0.96 });
    expect(popover.keyframes[0]?.properties).toMatchObject({ y: 12, scale: 0.96 });
  });

  it('lifts a card with rising shadow elevation for cardReveal', () => {
    const animation = animationFor(
      `overlay card { shape rect width 200 height 100 shadow 24 animation cardReveal(duration 1s) }`,
      'card'
    );
    expect(animation?.from.shadow).toBe(0);
    expect(animation?.to.shadow).toBe(24);
  });

  it('uses a short restrained default motion for buttonPop', () => {
    const animation = animationFor(
      `overlay button { shape rect width 120 height 40 animation buttonPop() }`,
      'button'
    );
    expect(animation?.duration).toBe(0.45);
    expect(animation?.easing).toBe('power4.out');
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

describe('text motion vocabulary', () => {
  const entrances = [
    'typewriter',
    'fadeIn',
    'bounceIn',
    'slideLeft',
    'slideRight',
    'slideUp',
    'slideDown',
    'zoomIn',
    'spinIn',
    'fallDown',
    'riseUp',
    'driftUp',
    'expand',
    'concentrate',
    'roll',
  ];
  const exits = ['fadeOut', 'bounceOut', 'zoomOut', 'spinOut', 'blackSmoke', 'pullOut'];
  const loops = [
    'flicker',
    'wave',
    'jitter',
    'pulse',
    'jigglyWobble',
    'rainbow',
    'fontShift',
    'pendulumSwing',
  ];
  const transitions = [
    'glitchTransition',
    'blurPass',
    'whiteFlash',
    'pullIn',
    'slideTransition',
    'splitMaskWipe',
    'revolvingChecker',
    'fanOut',
    'clockWipe',
    'zoomLens',
    'pageCurl',
    'mosaicPixelate',
    'neonGlowWipe',
    'verticalBlinds',
    'horizontalBlinds',
    'smoothScale',
    'doubleCrossShift',
    'waveWarp',
  ];

  it('publishes every requested text move and lowers each one to editable animations', () => {
    const catalog = new Set(
      moveRegistry()
        .filter((entry) => entry.category.includes('text'))
        .map((entry) => entry.name)
    );
    for (const name of [...entrances, ...exits, ...loops, ...transitions]) {
      expect(catalog.has(name), name).toBe(true);
      const scene = buildSceneGraph(
        parseMotion(`text title { value "Motionly" size 96 animation "${name}(duration .8s)" }`)
      );
      expect(
        scene.elements.some((element) => element.id.startsWith('title__')),
        name
      ).toBe(true);
      expect(
        scene.animations.some((animation) => animation.target.startsWith('title__')),
        name
      ).toBe(true);
    }
  });

  it('gives exit moves a visible start and a hidden final keyframe', () => {
    for (const name of exits) {
      const scene = buildSceneGraph(
        parseMotion(`text title { value "Exit" animation "${name}(duration .5s)" }`)
      );
      const animation = scene.animations.find((item) => item.target.startsWith('title__'))!;
      expect(animation.keyframes[0]?.properties.opacity, name).toBe(1);
      expect(animation.keyframes.at(-1)?.properties.opacity, name).toBe(0);
    }
  });

  it('moves transition text fully out in its authored direction', () => {
    const scene = buildSceneGraph(
      parseMotion(
        `text title { value "Next" animation "slideTransition(split none direction up duration .5s exitAt 2s exitDirection left exitDistance 900)" }`
      )
    );
    const exit = scene.animations.find((animation) => animation.delay === 2)!;
    expect(exit.to.opacity).toBe(1);
    expect(exit.to.x).toBe(-900);
    expect(exit.to.y).toBe(0);
  });

  it('keeps loop recipes cyclical and transition recipes visually distinct', () => {
    for (const name of loops) {
      const scene = buildSceneGraph(
        parseMotion(`text title { value "Loop" animation "${name}(duration 2s repeat 2)" }`)
      );
      const animation = scene.animations.find((item) => item.target.startsWith('title__'))!;
      expect(animation.keyframes.length, name).toBeGreaterThan(3);
      expect(animation.keyframes[0]?.properties.opacity, name).toBe(1);
      expect(animation.keyframes.at(-1)?.properties.opacity, name).toBe(1);
    }

    const signatures = transitions.map((name) => {
      const scene = buildSceneGraph(
        parseMotion(`text title { value "Transition" animation "${name}(duration .7s)" }`)
      );
      const animation = scene.animations.find((item) => item.target.startsWith('title__'))!;
      return JSON.stringify(animation.keyframes);
    });
    expect(new Set(signatures).size).toBe(transitions.length);
  });
});
