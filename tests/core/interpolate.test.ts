import { describe, it, expect } from 'vitest';
import { interpolateAngle, interpolateValue } from '../../src/core/interpolate';

describe('Interpolate', () => {
  describe('interpolateValue', () => {
    it('should interpolate numbers', () => {
      expect(interpolateValue(0, 100, 0)).toBe(0);
      expect(interpolateValue(0, 100, 0.5)).toBe(50);
      expect(interpolateValue(0, 100, 1)).toBe(100);
    });

    it('should interpolate negative numbers', () => {
      expect(interpolateValue(-50, 50, 0.5)).toBe(0);
    });

    it('should interpolate colors', () => {
      const result = interpolateValue('#000000', '#ffffff', 0.5);
      expect(typeof result).toBe('string');
      expect(result).toContain('rgb');
    });

    it('should handle rgb colors', () => {
      const result = interpolateValue('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 0.5);
      expect(result).toContain('rgb');
    });

    it('should handle rgba colors', () => {
      const result = interpolateValue('rgba(0, 0, 0, 1)', 'rgba(255, 255, 255, 0)', 0.5);
      expect(result).toContain('rgba');
    });

    it('should return from value when progress is 0', () => {
      expect(interpolateValue(10, 20, 0)).toBe(10);
      expect(interpolateValue('#ff0000', '#00ff00', 0)).toBe('#ff0000');
    });

    it('should return to value when progress is 1', () => {
      expect(interpolateValue(10, 20, 1)).toBe(20);
      expect(interpolateValue('#ff0000', '#00ff00', 1)).toBe('#00ff00');
    });
  });

  describe('interpolateAngle', () => {
    it('defaults ("auto") to the literal authored delta, preserving multi-turn sweeps', () => {
      expect(interpolateAngle(0, 360, 0.5)).toBe(180);
      expect(interpolateAngle(0, -260, 0.5)).toBe(-130);
      expect(interpolateAngle(0, 720, 1)).toBe(720);
    });

    it('forces a positive (clockwise) delta when direction is "cw"', () => {
      // from 350 -> to 10 is a -340 literal delta; cw should nudge it to +20.
      expect(interpolateAngle(350, 10, 0.5, 'cw')).toBe(360);
      // an already-positive delta is left untouched.
      expect(interpolateAngle(0, 90, 0.5, 'cw')).toBe(45);
    });

    it('forces a negative (counter-clockwise) delta when direction is "ccw"', () => {
      // literal delta is +340; ccw nudges it to -20.
      expect(interpolateAngle(10, 350, 0.5, 'ccw')).toBe(0);
      expect(interpolateAngle(90, 0, 0.5, 'ccw')).toBe(45);
    });

    it('returns from/to exactly at progress bounds', () => {
      expect(interpolateAngle(10, 400, 0, 'cw')).toBe(10);
      expect(interpolateAngle(10, 400, 1, 'cw')).toBe(400);
    });
  });
});
