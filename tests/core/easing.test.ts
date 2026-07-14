import { describe, it, expect } from 'vitest';
import { ease } from '../../src/core/easing';

describe('Easing Functions', () => {
  describe('Linear', () => {
    it('should return unchanged progress', () => {
      expect(ease(0, 'linear')).toBe(0);
      expect(ease(0.5, 'linear')).toBe(0.5);
      expect(ease(1, 'linear')).toBe(1);
    });
  });

  describe('Power Curves (GSAP-style)', () => {
    it('should handle power1.out (quad)', () => {
      expect(ease(0, 'power1.out')).toBe(0);
      expect(ease(1, 'power1.out')).toBe(1);
      const mid = ease(0.5, 'power1.out');
      expect(mid).toBeGreaterThan(0.5); // Deceleration
    });

    it('should handle power2.out (cubic)', () => {
      expect(ease(0, 'power2.out')).toBe(0);
      expect(ease(1, 'power2.out')).toBe(1);
      const mid = ease(0.5, 'power2.out');
      expect(mid).toBeGreaterThan(0.5);
    });

    it('should handle power3.out (default)', () => {
      expect(ease(0, 'power3.out')).toBe(0);
      expect(ease(1, 'power3.out')).toBe(1);
      const mid = ease(0.5, 'power3.out');
      expect(mid).toBeGreaterThan(0.5);
      expect(mid).toBeGreaterThan(ease(0.5, 'power2.out'));
    });

    it('should use power3.out as default', () => {
      expect(ease(0.5)).toBe(ease(0.5, 'power3.out'));
    });

    it('should handle power curves in direction', () => {
      expect(ease(0.5, 'power1.in')).toBeLessThan(0.5);
      expect(ease(0.5, 'power2.in')).toBeLessThan(0.5);
    });
  });

  describe('Springs (Apple-style)', () => {
    it('should handle spring with slight overshoot', () => {
      expect(ease(0, 'spring')).toBe(0);
      expect(ease(1, 'spring')).toBe(1);

      // Spring should have overshoot
      const late = ease(0.8, 'spring');
      expect(late).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle softSpring (Apple preferred)', () => {
      expect(ease(0, 'softSpring')).toBe(0);
      expect(ease(1, 'softSpring')).toBe(1);
    });

    it('should handle soft-spring alias', () => {
      expect(ease(0.5, 'soft-spring')).toBe(ease(0.5, 'softSpring'));
    });

    it('should handle bounceOut', () => {
      expect(ease(0, 'bounceOut')).toBeCloseTo(0);
      expect(ease(1, 'bounceOut')).toBeCloseTo(1);
    });
  });

  describe('Exponential', () => {
    it('should handle expo.out', () => {
      expect(ease(0, 'expo.out')).toBe(0);
      expect(ease(1, 'expo.out')).toBe(1);
      const mid = ease(0.5, 'expo.out');
      expect(mid).toBeGreaterThan(0.7); // Strong deceleration
    });

    it('should handle expo as alias for expo.out', () => {
      expect(ease(0.5, 'expo')).toBe(ease(0.5, 'expo.out'));
    });

    it('should handle expo.in', () => {
      expect(ease(0, 'expo.in')).toBe(0);
      expect(ease(1, 'expo.in')).toBe(1);
      const mid = ease(0.5, 'expo.in');
      expect(mid).toBeLessThan(0.3); // Strong acceleration
    });
  });

  describe('Circular', () => {
    it('should handle circ.out', () => {
      expect(ease(0, 'circ.out')).toBe(0);
      expect(ease(1, 'circ.out')).toBe(1);
    });

    it('should handle circ.in', () => {
      expect(ease(0, 'circ.in')).toBe(0);
      expect(ease(1, 'circ.in')).toBe(1);
    });
  });

  describe('Back (overshoot)', () => {
    it('should handle back.out with overshoot', () => {
      expect(ease(0, 'back.out')).toBeCloseTo(0, 1);
      expect(ease(1, 'back.out')).toBeCloseTo(1, 1);

      // Should overshoot slightly past 1
      const late = ease(0.9, 'back.out');
      expect(late).toBeGreaterThan(0.9);
    });

    it('should handle back.in', () => {
      expect(ease(0, 'back.in')).toBeCloseTo(0, 1);
      expect(ease(1, 'back.in')).toBe(1);
    });
  });

  describe('Sine (gentle curves)', () => {
    it('should handle sine.out', () => {
      expect(ease(0, 'sine.out')).toBe(0);
      expect(ease(1, 'sine.out')).toBe(1);
    });

    it('should handle sine.in', () => {
      expect(ease(0, 'sine.in')).toBe(0);
      expect(ease(1, 'sine.in')).toBeCloseTo(1);
    });

    it('should handle sine.inOut', () => {
      expect(ease(0, 'sine.inOut')).toBe(0);
      expect(ease(1, 'sine.inOut')).toBe(1);
      expect(ease(0.5, 'sine.inOut')).toBeCloseTo(0.5, 1);
    });
  });

  describe('Legacy aliases', () => {
    it('should handle ease-out as the default professional ease', () => {
      expect(ease(0.5, 'ease-out')).toBe(ease(0.5, 'power3.out'));
    });

    it('should handle smooth as power3.out', () => {
      expect(ease(0.5, 'smooth')).toBe(ease(0.5, 'power3.out'));
    });
  });

  describe('Cubic Bezier', () => {
    it('should handle cubic-bezier format', () => {
      const result = ease(0.5, 'cubic-bezier(0, 0, 0.2, 1)');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should handle invalid bezier as power3.out', () => {
      expect(ease(0.5, 'cubic-bezier(invalid)')).toBe(ease(0.5, 'power3.out'));
    });
  });

  describe('Edge cases', () => {
    it('should clamp values below 0', () => {
      expect(ease(-0.5, 'power3.out')).toBe(0);
    });

    it('should clamp values above 1', () => {
      expect(ease(1.5, 'power3.out')).toBe(1);
    });

    it('should always return 0 for progress=0', () => {
      expect(ease(0, 'spring')).toBe(0);
      expect(ease(0, 'expo.out')).toBe(0);
      expect(ease(0, 'back.out')).toBeCloseTo(0, 1);
    });

    it('should always return 1 for progress=1', () => {
      expect(ease(1, 'spring')).toBe(1);
      expect(ease(1, 'expo.out')).toBe(1);
      expect(ease(1, 'back.out')).toBeCloseTo(1, 1);
    });
  });

  describe('Professional defaults', () => {
    it('should produce stronger deceleration for power3 vs power2', () => {
      const p2 = ease(0.5, 'power2.out');
      const p3 = ease(0.5, 'power3.out');
      expect(p3).toBeGreaterThan(p2);
    });

    it('should produce very strong deceleration for expo', () => {
      const p3 = ease(0.5, 'power3.out');
      const expo = ease(0.5, 'expo.out');
      expect(expo).toBeGreaterThan(p3);
    });
  });

  describe('Motion design principles', () => {
    it('should support Apple-style animations', () => {
      // Apple commonly uses power3.out and softSpring
      const appleEase = ease(0.6, 'power3.out');
      expect(appleEase).toBeGreaterThan(0.7);
      expect(appleEase).toBeLessThan(1);
    });

    it('should support GSAP-style power curves', () => {
      // GSAP power curves should be smooth and predictable
      expect(ease(0.25, 'power2.out')).toBeGreaterThan(0.25);
      expect(ease(0.75, 'power2.out')).toBeGreaterThan(0.85);
    });

    it('should have consistent curve progression', () => {
      // Progress should always increase
      const p1 = ease(0.3, 'power3.out');
      const p2 = ease(0.6, 'power3.out');
      const p3 = ease(0.9, 'power3.out');

      expect(p2).toBeGreaterThan(p1);
      expect(p3).toBeGreaterThan(p2);
    });
  });
});
