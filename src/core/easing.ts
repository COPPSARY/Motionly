/**
 * Easing functions for smooth animations.
 */

import { gsap } from 'gsap';
import { clamp } from './units';
import type { EasingName } from '../types/scene';

const EASE_ALIASES: Record<string, string> = {
  ease: 'power3.out',
  smooth: 'power3.out',
  'ease-out': 'power3.out',
  easeOut: 'power3.out',
  expo: 'expo.out',
  expoOut: 'expo.out',
  softSpring: 'back.out(1.05)',
  'soft-spring': 'back.out(1.05)',
  spring: 'elastic.out(0.55, 0.42)',
  bounceOut: 'bounce.out',
};

/**
 * Apply easing function to progress value (0-1)
 */
export function ease(progress: number, name?: EasingName): number {
  const t = clamp(progress, 0, 1);
  if (t === 0 || t === 1) return t;

  const easing = EASE_ALIASES[String(name ?? 'power3.out')] ?? String(name ?? 'power3.out');
  if (easing.startsWith('cubic-bezier(')) return cubicBezier(easing, t);

  const parsed = gsap.parseEase(easing) ?? gsap.parseEase('power3.out');
  return clamp(parsed(t), 0, 1.04);
}

// ============================================================================
// CUSTOM CUBIC BEZIER
// ============================================================================

/**
 * Cubic bezier easing with custom control points
 * Format: "cubic-bezier(x1, y1, x2, y2)"
 *
 * Common presets:
 * - cubic-bezier(0, 0, 0.2, 1) - Material Design standard
 * - cubic-bezier(0.4, 0, 0.2, 1) - Material accelerate-decelerate
 * - cubic-bezier(0, 0, 0.3, 1) - iOS standard
 */
function cubicBezier(name: string, t: number): number {
  const values = name
    .match(/cubic-bezier\(([^)]+)\)/)?.[1]
    ?.split(',')
    .map((value) => Number.parseFloat(value.trim()));

  if (!values || values.length !== 4 || values.some(Number.isNaN)) {
    return ease(t, 'power3.out');
  }

  const [x1, y1, x2, y2] = values;

  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    return ease(t, 'power3.out');
  }

  // Simple cubic bezier approximation
  // For production, use binary search for precise timing
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;

  return 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3;
}
