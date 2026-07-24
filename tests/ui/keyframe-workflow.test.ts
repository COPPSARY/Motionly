import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import type { AnimationNode } from '../../src/types/parser';
import { moveKeyframe, removeKeyframe, upsertKeyframe } from '../../src/ui/keyframe-editing';

const source = `
canvas { size 100x100 fps 10 duration 4s background #000000 }
text title { value "Title" x 0 y 0 scale 1 rotation 0 opacity 1 color #000000 }
animate title {
  keyframes {
    0% { x 0 y 0 opacity 0 color #000000 }
    50% { x 100 y 50 }
    100% { x 200 y 100 opacity 1 color #ffffff }
  }
  duration 4s
  easing linear
}`;

function animationFrom(project: ReturnType<typeof parseMotion>): AnimationNode {
  const animation = project.body.find(
    (node): node is AnimationNode => node.type === 'Animation' && node.target === 'title'
  );
  if (!animation) throw new Error('title animation missing');
  return animation;
}

function titleAt(serialized: string, time: number) {
  return evaluateScene(buildSceneGraph(parseMotion(serialized)), time).elements.find(
    (element) => element.id === 'title'
  )?.render;
}

describe('visual keyframe workflow', () => {
  it('plays three position keyframes and independent opacity/color tracks', () => {
    const middle = titleAt(source, 1);
    const late = titleAt(source, 3);

    expect(middle?.x).toBeCloseTo(50);
    expect(middle?.y).toBeCloseTo(25);
    expect(middle?.opacity).toBeCloseTo(0.25);
    expect(String(middle?.color)).toContain('rgba(64, 64, 64');
    expect(late?.x).toBeCloseTo(150);
    expect(late?.opacity).toBeCloseTo(0.75);
  });

  it('adds an interpolated keyframe, edits its value, and moves its timing', () => {
    const project = parseMotion(source);
    const animation = animationFrom(project);
    const beforeInsert = titleAt(serializeProgram(project), 1)?.x;

    animation.keyframes = upsertKeyframe(animation.keyframes ?? [], 0.25, {
      x: beforeInsert,
      y: titleAt(serializeProgram(project), 1)?.y,
    });
    expect(titleAt(serializeProgram(project), 1)?.x).toBeCloseTo(Number(beforeInsert));

    animation.keyframes = upsertKeyframe(animation.keyframes, 0.25, { x: 80 });
    expect(titleAt(serializeProgram(project), 1)?.x).toBeCloseTo(80);

    animation.keyframes = moveKeyframe(animation.keyframes, 0.25, 0.375);
    const moved = serializeProgram(project);
    expect(moved).toContain('37.5%');
    expect(titleAt(moved, 1.5)?.x).toBeCloseTo(80);
  });

  it('deletes safely and persists all remaining keyframes through save/reload', () => {
    const project = parseMotion(source);
    const animation = animationFrom(project);
    animation.keyframes = removeKeyframe(animation.keyframes ?? [], 0.5);

    const saved = serializeProgram(project);
    const reloaded = parseMotion(saved);
    const frames = animationFrom(reloaded).keyframes ?? [];

    expect(frames.map((frame) => frame.offset)).toEqual([0, 1]);
    expect(titleAt(serializeProgram(reloaded), 2)?.x).toBeCloseTo(100);
    expect(titleAt(serializeProgram(reloaded), 2)?.opacity).toBeCloseTo(0.5);
  });

  it('edits only the third of five keyframes and persists every value', () => {
    const project = parseMotion(source);
    const animation = animationFrom(project);
    animation.keyframes = [0, 0.25, 0.5, 0.75, 1].map((offset, index) => ({
      offset,
      properties: { x: index * 100 },
    }));

    animation.keyframes = upsertKeyframe(animation.keyframes, 0.5, { x: 275 });

    expect(animation.keyframes.map((frame) => frame.properties['x'])).toEqual([
      0, 100, 275, 300, 400,
    ]);
    expect(titleAt(serializeProgram(project), 1)?.x).toBeCloseTo(100);
    expect(titleAt(serializeProgram(project), 1.5)?.x).toBeCloseTo(187.5);

    const reloaded = animationFrom(parseMotion(serializeProgram(project))).keyframes ?? [];
    expect(reloaded.map((frame) => Number(frame.properties['x']))).toEqual([0, 100, 275, 300, 400]);
  });
});
