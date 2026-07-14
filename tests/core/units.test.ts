import { describe, it, expect } from 'vitest';
import { parseTime, parseSize, parseScalar, clamp } from '../../src/core/units';

describe('Units', () => {
  describe('parseTime', () => {
    it('should parse seconds', () => {
      expect(parseTime('5s')).toBe(5);
      expect(parseTime('1.5s')).toBe(1.5);
    });

    it('should parse milliseconds', () => {
      expect(parseTime('1000ms')).toBe(1);
      expect(parseTime('500ms')).toBe(0.5);
    });

    it('should handle numbers without units as seconds', () => {
      expect(parseTime('3')).toBe(3);
      expect(parseTime(3)).toBe(3);
    });
  });

  describe('parseSize', () => {
    it('should parse dimension strings', () => {
      const size = parseSize('1920x1080');
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it('should handle spaces', () => {
      const size = parseSize('1280 x 720');
      expect(size.width).toBe(1280);
      expect(size.height).toBe(720);
    });
  });

  describe('parseScalar', () => {
    it('should parse numbers', () => {
      expect(parseScalar('42')).toBe(42);
      expect(parseScalar('3.14')).toBe(3.14);
    });

    it('should parse booleans', () => {
      expect(parseScalar('true')).toBe(true);
      expect(parseScalar('false')).toBe(false);
    });

    it('should return strings as-is', () => {
      expect(parseScalar('hello')).toBe('hello');
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });
});
