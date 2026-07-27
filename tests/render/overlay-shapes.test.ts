import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { CanvasRenderer } from '../../src/render/canvas-renderer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

function trackedContext(): { ctx: CanvasRenderingContext2D; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const noopMethods = new Set(['measureText', 'createLinearGradient', 'createRadialGradient']);
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      const name = String(property);
      if (name === 'measureText') return () => ({ width: 0 });
      if (name === 'createLinearGradient' || name === 'createRadialGradient')
        return () => ({ addColorStop: () => undefined });
      return (...args: unknown[]) => {
        if (!noopMethods.has(name)) {
          (calls[name] ??= []).push(args);
        }
        return undefined;
      };
    },
    set() {
      return true;
    },
  });
  return { ctx, calls };
}

function makeCanvas(context: CanvasRenderingContext2D): HTMLCanvasElement {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  return document.createElement('canvas');
}

/** jsdom does not implement Path2D; stub it so drawVectorPrimitive can run and record its calls. */
function stubPath2D(calls: Record<string, unknown[][]>): void {
  class FakePath2D {
    rect(...args: unknown[]) {
      (calls['rect'] ??= []).push(args);
    }
    arc(...args: unknown[]) {
      (calls['arc'] ??= []).push(args);
    }
    ellipse(...args: unknown[]) {
      (calls['ellipse'] ??= []).push(args);
    }
    moveTo() {}
    lineTo() {}
    closePath() {}
  }
  vi.stubGlobal('Path2D', FakePath2D);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('standalone overlay shapes', () => {
  it('positions a parentless rect overlay relative to canvas center instead of filling the whole frame', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      canvas { size 1000x600 duration 1s }
      overlay card {
        shape rect
        x 50
        y -20
        width 200
        height 100
        fill #123456
        opacity 1
      }
    `)
    );
    const frame = evaluateScene(scene, 0);
    const { ctx, calls } = trackedContext();
    stubPath2D(calls);
    const renderer = new CanvasRenderer(makeCanvas(ctx));
    renderer.render(frame);

    // Canvas is 1000x600, so center is (500, 300); overlay offset is (50, -20).
    // The old fallback rendered a parentless shape overlay as a full-canvas fillRect instead —
    // translate(550, 280) is only reachable through the new per-shape positioning path.
    expect(calls['translate']).toContainEqual([550, 280]);
  });

  it('anchors a rect to its originX/originY instead of always centering it', () => {
    const scene = buildSceneGraph(
      parseMotion(`
      canvas { size 1000x600 duration 1s }
      overlay bar {
        shape rect
        originX 0
        originY 0.5
        width 240
        height 20
        fill #7cf7c5
        opacity 1
      }
    `)
    );
    const frame = evaluateScene(scene, 0);
    const { ctx, calls } = trackedContext();
    stubPath2D(calls);
    const renderer = new CanvasRenderer(makeCanvas(ctx));
    renderer.render(frame);

    const rectCall = calls['rect']?.find((args) => args[2] === 240 && args[3] === 20);
    expect(rectCall).toBeDefined();
    expect(Number(rectCall?.[0])).toBeCloseTo(0, 5);
    expect(rectCall?.[1]).toBe(-10);
  });
});
