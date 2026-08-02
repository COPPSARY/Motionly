import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';

const opacityAt = (source: string, id: string, time: number) =>
  Number(
    evaluateScene(buildSceneGraph(parseMotion(source)), time).elements.find(
      (element) => element.id === id
    )?.render.opacity
  );

describe('pre-entrance visibility', () => {
  it('keeps a delayed entrance hidden before its delay even when authored visible', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Late" opacity 1 }
      animate title {
        from { opacity 0 y 80 blur 8 }
        to { opacity 1 y 0 blur 0 }
        duration 1s
        delay 2s
        easing power3.out
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const before = evaluateScene(scene, 1).elements.find((element) => element.id === 'title')!;
    expect(before.render.opacity).toBe(0);
    expect(before.render.y).toBe(80);
    expect(opacityAt(source, 'title', 2.5)).toBeGreaterThan(0);
    expect(opacityAt(source, 'title', 4)).toBe(1);
  });

  it('applies keyframe entrances the same way', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Late" opacity 1 }
      animate title {
        keyframes {
          0% { opacity 0 scale .8 }
          100% { opacity 1 scale 1 }
        }
        duration 1s
        delay 1.5s
        easing power3.out
      }
    `;
    expect(opacityAt(source, 'title', 0.5)).toBe(0);
    expect(opacityAt(source, 'title', 4)).toBe(1);
  });

  it('leaves move-only delayed animations at their authored state for compatibility', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Slide" x 0 opacity 1 }
      animate title {
        from { x -40 }
        to { x 40 }
        duration 1s
        delay 2s
        easing linear
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const before = evaluateScene(scene, 1).elements.find((element) => element.id === 'title')!;
    expect(before.render.opacity).toBe(1);
    expect(before.render.x).toBe(0);
  });

  it('does not hide elements whose first animation is an exit', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Leaves" opacity 1 }
      animate title {
        from { opacity 1 }
        to { opacity 0 }
        duration 1s
        delay 3s
        easing linear
      }
    `;
    expect(opacityAt(source, 'title', 1)).toBe(1);
    expect(opacityAt(source, 'title', 5)).toBe(0);
  });

  it('does not hide an element before a delayed retirement hold', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Shared" opacity 1 }
      animate title {
        from { opacity 0 }
        to { opacity 0 }
        duration .001s
        delay 3s
        easing linear
      }
    `;
    expect(opacityAt(source, 'title', 1)).toBe(1);
    expect(opacityAt(source, 'title', 4)).toBe(0);
  });

  it('lets the latest timeline action win regardless of source order', () => {
    const source = `
      canvas { duration 6s }
      text title { value "Ordered by time" opacity 1 }
      animate title {
        from { opacity 1 }
        to { opacity 0 }
        duration .5s
        delay 3s
        easing linear
      }
      animate title {
        from { opacity 0 }
        to { opacity 1 }
        duration .5s
        delay 1s
        easing linear
      }
    `;
    expect(opacityAt(source, 'title', 2)).toBe(1);
    expect(opacityAt(source, 'title', 4)).toBe(0);
  });

  it('keeps later idle loops from leaking their start values before the entrance', () => {
    const source = `
      canvas { duration 8s }
      text title { value "Glow" opacity 1 }
      animate title {
        from { opacity 0 }
        to { opacity 1 }
        duration 1s
        delay 1s
        easing linear
      }
      animate title {
        from { blur 0 }
        to { blur 6 }
        duration 1s
        delay 3s
        easing linear
        repeat infinite
        repeatType yoyo
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const beforeEntrance = evaluateScene(scene, 0.5).elements.find(
      (element) => element.id === 'title'
    )!;
    expect(beforeEntrance.render.opacity).toBe(0);
    expect(beforeEntrance.render.blur ?? 0).toBe(0);
    const betweenAnimations = evaluateScene(scene, 2.5).elements.find(
      (element) => element.id === 'title'
    )!;
    expect(betweenAnimations.render.opacity).toBe(1);
  });

  it('does not treat a delayed repeating loop as an entrance', () => {
    const source = `
      canvas { duration 8s }
      overlay dot { shape circle opacity 0 }
      animate dot {
        keyframes {
          0% { opacity .35 }
          50% { opacity 1 }
          100% { opacity .35 }
        }
        duration 1s
        delay 4s
        easing sine.inOut
        repeat infinite
      }
    `;
    expect(opacityAt(source, 'dot', 1)).toBe(0);
    expect(opacityAt(source, 'dot', 4.5)).toBe(1);
  });
});

describe('scene enter/exit envelope', () => {
  const source = `
    canvas { duration 12s }
    scene intro {
      start 1s
      duration 4s
      enter .5s
      exit 1s
    }
    text title {
      parent intro
      value "Scene copy"
      opacity 1
    }
    scene next {
      start 5s
      duration 4s
    }
    text nextTitle {
      parent next
      value "Next"
      opacity 1
    }
  `;
  const titleOpacity = (time: number) =>
    evaluateScene(buildSceneGraph(parseMotion(source)), time).elements.find(
      (element) => element.id === 'title'
    )?.render.opacity;

  it('fades descendants in over the enter window', () => {
    expect(Number(titleOpacity(1.05))).toBeLessThan(0.5);
    expect(Number(titleOpacity(1.6))).toBe(1);
  });

  it('fades descendants out over the exit window instead of popping', () => {
    expect(Number(titleOpacity(4.5))).toBeLessThan(1);
    expect(Number(titleOpacity(4.999))).toBeLessThan(0.01);
  });

  it('does not leak the scene outside its window and leaves plain scenes alone', () => {
    const frame = evaluateScene(buildSceneGraph(parseMotion(source)), 6);
    expect(frame.elements.find((element) => element.id === 'title')).toBeUndefined();
    expect(frame.elements.find((element) => element.id === 'nextTitle')?.render.opacity).toBe(1);
  });
});
