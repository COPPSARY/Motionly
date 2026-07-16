import { describe, expect, it } from 'vitest';
import {
  keyframeOffsetAtTime,
  moveKeyframe,
  snapClipStart,
  snapTimelineTime,
  upsertKeyframe,
} from '../../src/ui/timeline-model';
import type { AnimationNode } from '../../src/types/parser';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('timeline keyframe state', () => {
  it('clamps, moves, and sorts keyframes', () => {
    const animation: AnimationNode = {
      type: 'Animation',
      target: 'title',
      delay: 2,
      duration: 4,
      keyframes: [{ offset: 0, properties: { x: 0 } }],
    };
    animation.keyframes = upsertKeyframe(animation, keyframeOffsetAtTime(4, animation), { x: 50 });
    animation.keyframes = upsertKeyframe(animation, 1, { x: 100 });

    expect(animation.keyframes.map((frame) => frame.offset)).toEqual([0, 0.5, 1]);
    expect(moveKeyframe(animation.keyframes, 0.5, 0.75).map((frame) => frame.offset)).toEqual([
      0, 0.75, 1,
    ]);
  });

  it('persists a moved keyframe and evaluates it at its new timing', () => {
    const ast = parseMotion(`
canvas { size 100x100 fps 10 duration 2s background #000000 }
text title { value "Title" x 0 opacity 1 }
animate title {
  keyframes {
    0% { x 0 }
    50% { x 50 }
    100% { x 100 }
  }
  duration 2s
  easing linear
}`);
    const animation = ast.body.find(
      (node): node is AnimationNode => node.type === 'Animation' && node.target === 'title'
    );
    expect(animation).toBeDefined();
    animation!.keyframes = moveKeyframe(animation!.keyframes ?? [], 0.5, 0.75);

    const serialized = serializeProgram(ast);
    const scene = buildSceneGraph(parseMotion(serialized));
    const title = evaluateScene(scene, 1.5).elements.find((element) => element.id === 'title');

    expect(serialized).toContain('75%');
    expect(title?.render.x).toBe(50);
  });
});

describe('timeline snapping', () => {
  it('snaps trims only to deliberate targets within six pixels', () => {
    expect(
      snapTimelineTime({
        time: 4.03,
        totalDuration: 10,
        laneWidth: 1000,
        playhead: 4,
        ownTargets: [8],
      })
    ).toBe(4);
    expect(
      snapTimelineTime({
        time: 6.4,
        totalDuration: 10,
        laneWidth: 1000,
        playhead: 4,
        ownTargets: [8],
      })
    ).toBe(6.4);
  });

  it('snaps a clip edge without considering unrelated layer edges', () => {
    expect(
      snapClipStart({ start: 4.03, duration: 2, totalDuration: 10, laneWidth: 1000, playhead: 4 })
    ).toBe(4);
    expect(
      snapClipStart({ start: 6.4, duration: 2, totalDuration: 10, laneWidth: 1000, playhead: 4 })
    ).toBe(6.4);
  });
});
