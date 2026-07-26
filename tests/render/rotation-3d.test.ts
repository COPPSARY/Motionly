import { describe, expect, it, vi } from 'vitest';
import { apply3DTilt, resolveOrigin } from '../../src/render/canvas-renderer';

describe('resolveOrigin', () => {
  it('uses normalized originX/originY scaled by box size by default', () => {
    expect(resolveOrigin({ originX: 0.5, originY: 0.25 }, 200, 80)).toEqual({ x: 100, y: 20 });
  });

  it('falls back to a centered origin when unset', () => {
    expect(resolveOrigin({}, 200, 80)).toEqual({ x: 100, y: 40 });
  });

  it('prefers an explicit pixel anchor over the normalized fraction', () => {
    expect(
      resolveOrigin({ originX: 0.5, originY: 0.5, originXPixel: 10, originYPixel: 5 }, 200, 80)
    ).toEqual({ x: 10, y: 5 });
  });
});

describe('apply3DTilt', () => {
  it('is a no-op when rotationX/rotationY are both zero', () => {
    const transform = vi.fn();
    const ctx = { transform } as unknown as CanvasRenderingContext2D;
    apply3DTilt(ctx, {}, 200, 100);
    expect(transform).not.toHaveBeenCalled();
  });

  it('foreshortens the tilted axis by its cosine and skews by a perspective-scaled sine', () => {
    const transform = vi.fn();
    const ctx = { transform } as unknown as CanvasRenderingContext2D;
    apply3DTilt(ctx, { rotationX: 45, perspective: 800 }, 200, 100);

    expect(transform).toHaveBeenCalledTimes(1);
    const [scaleX, skewFromX, skewFromY, scaleY] = transform.mock.calls[0]!;
    expect(scaleX).toBeCloseTo(1, 5); // rotationY is 0, so the horizontal axis is untouched.
    expect(scaleY).toBeCloseTo(Math.cos(Math.PI / 4), 5);
    expect(skewFromY).toBeCloseTo(0, 5);
    expect(skewFromX).toBeCloseTo((Math.sin(Math.PI / 4) * 100) / 2 / 800, 5);
  });

  it('clamps foreshortening so a 90 degree tilt does not fully collapse the axis', () => {
    const transform = vi.fn();
    const ctx = { transform } as unknown as CanvasRenderingContext2D;
    apply3DTilt(ctx, { rotationX: 90 }, 200, 100);

    const [, , , scaleY] = transform.mock.calls[0]!;
    expect(scaleY).toBeGreaterThan(0);
    expect(scaleY).toBeCloseTo(0.02, 5);
  });
});
