import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('drawSVG preset', () => {
  it('animates vector path progress', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      import "/logo.svg" as logo
      logo { animation drawSVG(duration 1s) }
    `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');

    expect(animation?.from.pathProgress).toBe(0);
    expect(animation?.to.pathProgress).toBe(1);
    expect(
      (
        scene.elements.find((item) => item.id === 'logo')?.properties as unknown as Record<
          string,
          unknown
        >
      ).pathProgress
    ).toBe(0);
  });
});

describe('transition presets', () => {
  it('builds wipes, masked media, dynamic slides, and a speed zoom', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      camera { cameraAnimation speedZoom(delay 2s duration 1s peak 1.15) }
      import "/panel.svg" as panel
      overlay wipe { animation shapeWipe(delay 1s direction left) }
      panel { animation maskReveal(delay 2s direction right) }
      text label { value "Move" animation dynamicSlide(direction up) }
    `)
    );

    const wipe = scene.elements.find((item) => item.id === 'wipe');
    const slide = scene.animations.find((item) => item.target === 'label');
    const camera = scene.animations.find((item) => item.target === 'camera');
    expect((wipe?.properties as unknown as Record<string, unknown>).revealProgress).toBe(0);
    expect((wipe?.properties as unknown as Record<string, unknown>).revealDirection).toBe('left');
    expect(slide?.keyframes.some((frame) => 'skewX' in frame.properties)).toBe(true);
    expect(camera?.keyframes).toHaveLength(3);
  });
});

describe('split text positioning', () => {
  it('preserves the text block x position', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      text title {
        value "Right column"
        center
        x 420
        textAnimation keynoteText(split words)
      }
    `)
    );

    expect(
      (
        scene.elements.find((item) => item.id === 'title__words_0')
          ?.properties as unknown as Record<string, unknown>
      ).textGroupX
    ).toBe(420);
  });
});
