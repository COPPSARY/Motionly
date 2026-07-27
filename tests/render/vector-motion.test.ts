import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseSvg } from '../../src/assets/asset-loader';
import { parseMotion } from '../../src/language/parser';
import { CanvasRenderer, interpolateCompatiblePathData } from '../../src/render/canvas-renderer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

function trackedContext(): {
  ctx: CanvasRenderingContext2D;
  calls: Record<string, unknown[][]>;
  order: string[];
} {
  const calls: Record<string, unknown[][]> = {};
  const order: string[] = [];
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const gradient = { addColorStop: vi.fn() };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      const name = String(property);
      if (name in state) return state[name];
      if (name === 'measureText') return () => ({ width: 0 });
      if (name === 'getTransform') return () => new DOMMatrix();
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        return (...args: unknown[]) => {
          (calls[name] ??= []).push(args);
          return gradient;
        };
      }
      return (...args: unknown[]) => {
        order.push(name);
        (calls[name] ??= []).push(args);
        return undefined;
      };
    },
    set(_target, property, value) {
      state[String(property)] = value;
      return true;
    },
  });
  return { ctx, calls, order };
}

function makeCanvas(context: CanvasRenderingContext2D): HTMLCanvasElement {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  return document.createElement('canvas');
}

class FakePath2D {
  constructor(_path?: string | Path2D) {}
  rect() {}
  arc() {}
  ellipse() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('professional vector motion primitives', () => {
  it('normalizes SVG primitives and inherited presentation attributes into drawable paths', () => {
    const svg = parseSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <rect x="2" y="12" width="20" height="8" rx="2" />
        <line x1="6" y1="16" x2="18" y2="16" />
      </svg>
    `);

    expect(svg.paths).toHaveLength(3);
    expect(svg.vectorSafe).toBe(true);
    expect(svg.paths.every((path) => path.d.startsWith('M'))).toBe(true);
    expect(svg.paths.every((path) => path.stroke !== 'none')).toBe(true);
    expect(svg.paths.every((path) => path.strokeWidth === 2)).toBe(true);
  });

  it('keeps transformed or class-styled SVGs on the browser-native rendering path', () => {
    expect(
      parseSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <g transform="translate(3 4)"><rect width="10" height="10" /></g>
        </svg>
      `).vectorSafe
    ).toBe(false);
    expect(
      parseSvg(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <style>.mark { stroke: red; }</style><path class="mark" d="M0 0L10 10" />
        </svg>
      `).vectorSafe
    ).toBe(false);
  });

  it('performs deterministic morphing for compatible path topology', () => {
    expect(interpolateCompatiblePathData('M0 0 L10 10 Z', 'M10 20 L30 40 Z', 0.5)).toBe(
      'M 5 10 L 20 25 Z'
    );
    expect(interpolateCompatiblePathData('M0 0 L10 10', 'M0 0 C3 3 6 6 10 10', 0.5)).toBeNull();
    expect(
      interpolateCompatiblePathData('M0 0 A10 10 0 0 0 20 20', 'M0 0 A10 10 0 1 0 20 20', 0.5)
    ).toBeNull();

    const scene = buildSceneGraph(
      parseMotion(`
        import "/from.svg" as fromShape
        import "/to.svg" as toShape
        fromShape {
          morphTo toShape
          animation "morph(duration 1s ease power3.out)"
        }
      `)
    );
    expect(scene.animations.find((animation) => animation.target === 'fromShape')).toMatchObject({
      from: { opacity: 1, morphProgress: 0 },
      to: { opacity: 1, morphProgress: 1 },
    });
    expect(() =>
      buildSceneGraph(
        parseMotion(
          'import "/from.svg" as fromShape\nfromShape { morphTo missing animation morph }'
        )
      )
    ).toThrow('Morph target "missing"');
  });

  it('renders bounded deterministic particles and vector gradients on Canvas2D', () => {
    vi.stubGlobal('Path2D', FakePath2D);
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { size 640x360 duration 2s }
        effect field {
          effect particles
          opacity 1
          color #8ab4ff
          particleCount 12
          particleSize 4
          offset .4
        }
        overlay gradientCard {
          shape rect
          width 220
          height 100
          opacity 1
          fill #ffffff
          gradientFrom #8ab4ff
          gradientTo #7cf7c5
          gradientAngle 30
        }
      `)
    );
    const { ctx, calls } = trackedContext();
    new CanvasRenderer(makeCanvas(ctx)).render(evaluateScene(scene, 0.5));

    expect(calls['arc']).toHaveLength(12);
    expect(calls['createLinearGradient']).toHaveLength(1);
  });

  it('paints scene backgrounds before their visual children', () => {
    vi.stubGlobal('Path2D', FakePath2D);
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { size 640x360 duration 2s }
        scene shot { start 0s duration 2s background #050916 }
        overlay sun { parent shot shape circle radius 80 fill #fdb813 opacity 1 }
      `)
    );
    const { ctx, order } = trackedContext();
    new CanvasRenderer(makeCanvas(ctx)).render(evaluateScene(scene, 1));

    expect(order.lastIndexOf('fillRect')).toBeLessThan(order.indexOf('fill'));
  });
});
