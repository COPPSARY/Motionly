import { describe, expect, it } from 'vitest';
import {
  animatedProperties,
  hasKeyframeProperties,
  keyframeOffsetAtTime,
  mergeCoincidentKeyframes,
  moveKeyframe,
  removeKeyframeProperties,
  removeKeyframe,
  seedKeyframes,
  upsertKeyframe,
} from '../../src/ui/keyframe-editing';

describe('AST keyframe editing', () => {
  it('seeds explicit keyframes from an existing from/to animation', () => {
    expect(seedKeyframes([], { opacity: 0 }, { opacity: 1 })).toEqual([
      { offset: 0, properties: { opacity: 0 } },
      { offset: 1, properties: { opacity: 1 } },
    ]);
  });

  it('inserts and sorts a composite keyframe', () => {
    const frames = upsertKeyframe(seedKeyframes([], { x: 0 }, { x: 100 }), 0.5, {
      x: 40,
      rotation: 15,
    });
    expect(frames.map((frame) => frame.offset)).toEqual([0, 0.5, 1]);
    expect(frames[1]?.properties).toEqual({ x: 40, rotation: 15 });
  });

  it('updates an existing frame at the same time instead of duplicating it', () => {
    const frames = upsertKeyframe([{ offset: 0.5, properties: { x: 10 } }], 0.5, {
      y: 20,
    });
    expect(frames).toEqual([{ offset: 0.5, properties: { x: 10, y: 20 } }]);
  });

  it('stores property values as independent snapshots', () => {
    const value = { point: [100, 200] };
    const first = upsertKeyframe([], 0, { value });
    const second = upsertKeyframe(first, 0.5, { value });

    value.point[0] = 999;
    (second[1]?.properties['value'] as typeof value).point[1] = 888;

    expect(first[0]?.properties['value']).toEqual({ point: [100, 200] });
    expect(second[0]?.properties['value']).toEqual({ point: [100, 200] });
  });

  it('moves frame offsets with clamping and stable sorting', () => {
    const frames = [
      { offset: 0, properties: { x: 0 } },
      { offset: 0.5, properties: { x: 50 } },
      { offset: 1, properties: { x: 100 } },
    ];
    expect(moveKeyframe(frames, 0.5, 0.8).map((frame) => frame.offset)).toEqual([0, 0.8, 1]);
    expect(moveKeyframe(frames, 0.5, 2)).toEqual([
      { offset: 0, properties: { x: 0 } },
      { offset: 1, properties: { x: 50 } },
    ]);
  });

  it('removes only the selected offset', () => {
    const frames = seedKeyframes([], { opacity: 0 }, { opacity: 1 });
    expect(removeKeyframe(frames, 0).map((frame) => frame.offset)).toEqual([1]);
  });

  it('tracks properties independently within composite frames', () => {
    const frames = [
      { offset: 0, properties: { x: 0, opacity: 0 } },
      { offset: 0.5, properties: { opacity: 1 } },
      { offset: 1, properties: { x: 100 } },
    ];
    expect(animatedProperties(frames)).toEqual(['x', 'opacity']);
    expect(hasKeyframeProperties(frames, 0, ['x', 'opacity'])).toBe(true);
    expect(hasKeyframeProperties(frames, 0.5, ['x'])).toBe(false);
    expect(removeKeyframeProperties(frames, 0, ['opacity'])[0]?.properties).toEqual({ x: 0 });
  });

  it('maps playhead time and merges frames moved onto the same timestamp', () => {
    expect(keyframeOffsetAtTime(3, 1, 4)).toBe(0.5);
    expect(
      mergeCoincidentKeyframes([
        { offset: 0.5, properties: { x: 10 } },
        { offset: 0.5, properties: { opacity: 0.5 } },
      ])
    ).toEqual([{ offset: 0.5, properties: { x: 10, opacity: 0.5 } }]);
  });
});
