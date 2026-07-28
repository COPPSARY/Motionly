import { describe, expect, it } from 'vitest';
import type { Clip } from '../../src/types/scene';
import {
  adjacentClipBoundaries,
  applyClipTransition,
  clipTransitionOpacity,
  clipTransitionTail,
  removedClipTransitionProperties,
} from '../../src/ui/clip-transitions';

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip_a_0',
    assetName: 'a',
    asset: null,
    track: 1,
    start: 0,
    duration: 2,
    trimIn: 0,
    trimOut: 0,
    transitionInDuration: 0,
    transitionOutDuration: 0,
    fadeIn: 0,
    fadeOut: 0,
    speed: 1,
    sourceOrder: 0,
    ...overrides,
  };
}

describe('paired clip transitions', () => {
  it('finds only touching same-track cuts', () => {
    const outgoing = clip();
    const incoming = clip({
      id: 'clip_b_1',
      assetName: 'b',
      start: 2,
      sourceOrder: 1,
    });
    const distant = clip({
      id: 'clip_c_2',
      assetName: 'c',
      start: 5,
      sourceOrder: 2,
    });
    expect(adjacentClipBoundaries([outgoing, incoming, distant])).toMatchObject([
      { outgoing: { id: outgoing.id }, incoming: { id: incoming.id }, at: 2, type: null },
    ]);
  });

  it('creates matching crossfade metadata and clamps duration to both clips', () => {
    const outgoing = clip({ duration: 0.4 });
    const incoming = clip({ id: 'clip_b_1', start: 0.4, duration: 2, sourceOrder: 1 });
    expect(applyClipTransition(outgoing, incoming, 1)).toEqual({
      type: 'crossfade',
      duration: 0.4,
      outgoing: { transitionOut: 'crossfade', transitionOutDuration: 0.4 },
      incoming: { transitionIn: 'crossfade', transitionInDuration: 0.4 },
    });
    expect(applyClipTransition(outgoing, { ...incoming, start: 1 }, 0.2)).toBeNull();
  });

  it('evaluates complementary fade envelopes around the cut', () => {
    const outgoing = clip({ transitionOut: 'crossfade', transitionOutDuration: 0.5 });
    const incoming = clip({
      id: 'clip_b_1',
      start: 2,
      sourceOrder: 1,
      transitionIn: 'crossfade',
      transitionInDuration: 0.5,
    });
    expect(clipTransitionTail(outgoing)).toBe(0.5);
    expect(clipTransitionOpacity(outgoing, 2.25)).toBe(0.5);
    expect(clipTransitionOpacity(incoming, 2.25)).toBe(0.5);
    expect(clipTransitionOpacity(incoming, 2.5)).toBe(1);
    expect(removedClipTransitionProperties()).toEqual({
      outgoing: ['transitionOut', 'transitionOutDuration'],
      incoming: ['transitionIn', 'transitionInDuration'],
    });
  });
});
