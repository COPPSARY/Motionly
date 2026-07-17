import { describe, expect, it } from 'vitest';
import { inspectMotionProject } from '../../src/inspection/project-inspector';

describe('headless project inspection', () => {
  it('evaluates every declared frame and survives a round trip', () => {
    const result = inspectMotionProject(`
canvas {
  size 320x180
  fps 10
  duration 1s
  background #000000
}

text title {
  value "Hello"
  opacity 1
}

animate title {
  keyframes {
    0% { x 0 }
    100% { x 100 }
  }
  duration 1s
  easing linear
}`);

    expect(result.ok).toBe(true);
    expect(result.frameCount).toBe(10);
    expect(result.roundTripStable).toBe(true);
    expect(result.invalidFrames).toEqual([]);
    expect(result.emptyFrameRanges).toEqual([]);
    expect(result.representativeFrames).toHaveLength(3);
    expect(result.renderSignature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('reports visually empty frame ranges without treating them as parse failures', () => {
    const result = inspectMotionProject(`
canvas {
  size 320x180
  fps 4
  duration 1s
  background #000000
}`);

    expect(result.ok).toBe(true);
    expect(result.emptyFrameRanges).toEqual([{ start: 0, end: 3 }]);
  });
});
