import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';

function project(middleEase: string): string {
  return `
canvas { size 100x100 duration 1s }
text t {
  value "x"
  opacity 0
}
animate t {
  keyframes {
    0% {
      opacity 0
    }
    100% {
      opacity 1
      ease ${middleEase}
    }
  }
  duration 1s
  easing power3.out
}
`;
}

describe('per-keyframe easing', () => {
  it('parses ease inside a keyframe and keeps it out of animatable properties', () => {
    const ast = parseMotion(project('linear'));
    const animate = ast.body.find((node) => node.type === 'Animation');
    const frame = animate && 'keyframes' in animate ? animate.keyframes?.at(-1) : undefined;
    expect(frame?.easing).toBe('linear');
    expect(frame?.properties).not.toHaveProperty('ease');
    expect(frame?.properties).toHaveProperty('opacity');
  });

  it('round-trips per-keyframe easing through serialize/parse', () => {
    const serialized = serializeProgram(parseMotion(project('power1.in')));
    expect(serialized).toContain('ease power1.in');
    const reparsed = parseMotion(serialized);
    const animate = reparsed.body.find((node) => node.type === 'Animation');
    const frame = animate && 'keyframes' in animate ? animate.keyframes?.at(-1) : undefined;
    expect(frame?.easing).toBe('power1.in');
  });

  it('carries easing into the normalized scene graph', () => {
    const scene = buildSceneGraph(parseMotion(project('linear')));
    const animation = scene.animations.find((item) => item.target === 't');
    expect(animation?.keyframes.at(-1)?.easing).toBe('linear');
  });

  it('changes evaluated interpolation based on the keyframe easing', () => {
    const linear = evaluateScene(
      buildSceneGraph(parseMotion(project('linear'))),
      0.5
    ).elements.find((element) => element.id === 't');
    const eased = evaluateScene(
      buildSceneGraph(parseMotion(project('power3.out'))),
      0.5
    ).elements.find((element) => element.id === 't');
    const linearOpacity = Number(linear?.render.opacity);
    const easedOpacity = Number(eased?.render.opacity);
    expect(linearOpacity).toBeCloseTo(0.5, 2);
    // power3.out is well ahead of linear at the midpoint.
    expect(easedOpacity).toBeGreaterThan(linearOpacity + 0.2);
  });
});
