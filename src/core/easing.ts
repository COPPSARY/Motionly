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
  'spring.soft': 'back.out(1.2)',
  'spring.bouncy': 'elastic.out(0.7, 0.4)',
  'spring.stiff': 'back.out(2.4)',
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
function cubicBezier(name: string, progress: number): number {
  const values = name
    .match(/^cubic-bezier\(([^)]+)\)$/)?.[1]
    ?.split(',')
    .map((value) => Number(value.trim()));

  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    return ease(progress, 'power3.out');
  }

  const [x1, y1, x2, y2] = values as [number, number, number, number];
  // CSS timing functions require x control points in [0, 1] so x(t) is monotonic.
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return ease(progress, 'power3.out');

  const sample = (a: number, b: number, t: number): number => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number): number =>
    3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);

  // Invert x(t) to find the curve parameter for the requested timeline progress.
  let parameter = progress;
  for (let index = 0; index < 8; index += 1) {
    const error = sample(x1, x2, parameter) - progress;
    if (Math.abs(error) < 1e-7) return sample(y1, y2, parameter);
    const derivative = slope(x1, x2, parameter);
    if (Math.abs(derivative) < 1e-7) break;
    const next = parameter - error / derivative;
    if (next < 0 || next > 1) break;
    parameter = next;
  }

  // Newton iteration can become unstable for flat curves; bisection is bounded and deterministic.
  let lower = 0;
  let upper = 1;
  parameter = progress;
  for (let index = 0; index < 24; index += 1) {
    const x = sample(x1, x2, parameter);
    if (Math.abs(x - progress) < 1e-7) break;
    if (x < progress) lower = parameter;
    else upper = parameter;
    parameter = (lower + upper) / 2;
  }
  return sample(y1, y2, parameter);
}
