/**
 * Value interpolation utilities for animations
 */

import { parseColor } from './color';
import type { RGBA } from '../types/utils';
import type { AnimatableValue } from '../types/scene';

/**
 * Interpolate between two values based on progress (0-1)
 * Supports: numbers, colors (hex, rgb, rgba)
 */
export function interpolateValue(
  from: AnimatableValue,
  to: AnimatableValue,
  progress: number
): AnimatableValue {
  if (progress <= 0) return from;
  if (progress >= 1) return to;

  if (typeof from === 'number' && typeof to === 'number') {
    return from + (to - from) * progress;
  }

  if (isColor(from) && isColor(to)) {
    return interpolateColor(from, to, progress);
  }

  return progress < 1 ? from : to;
}

/**
 * Interpolate a rotation angle (degrees) between two values, honoring a
 * direction preference:
 * - 'auto' (default) takes the literal from->to delta as authored, so
 *   multi-turn sweeps (e.g. a spin preset going -260deg or +720deg) work
 *   exactly as written — this matches long-standing preset behavior.
 * - 'cw' / 'ccw' force the rotation to move through a positive / negative
 *   delta, nudging by a single 360 turn when the authored delta points the
 *   other way. Only meant for resolving ambiguous short (<360) deltas.
 */
export function interpolateAngle(
  from: number,
  to: number,
  progress: number,
  direction: 'auto' | 'cw' | 'ccw' = 'auto'
): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;

  let delta = to - from;

  if (direction === 'cw' && delta < 0) {
    delta += 360;
  } else if (direction === 'ccw' && delta > 0) {
    delta -= 360;
  }

  return from + delta * progress;
}

/**
 * Check if value is a color string
 */
function isColor(value: AnimatableValue): value is string {
  return typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'));
}

/**
 * Interpolate between two color values
 */
function interpolateColor(from: string, to: string, progress: number): string {
  const a = colorToRgb(from);
  const b = colorToRgb(to);

  if (!a || !b) {
    return progress < 1 ? parseColor(from) : parseColor(to);
  }

  const r = Math.round(a.r + (b.r - a.r) * progress);
  const g = Math.round(a.g + (b.g - a.g) * progress);
  const bl = Math.round(a.b + (b.b - a.b) * progress);
  const alpha = a.a + (b.a - a.a) * progress;

  return `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
}

/**
 * Convert color string to RGBA components
 */
function colorToRgb(value: string): RGBA | null {
  const text = String(value).trim();

  // Parse hex colors
  if (text.startsWith('#')) {
    const hex = text.slice(1);

    // Short hex (#fff)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0]! + hex[0]!, 16),
        g: Number.parseInt(hex[1]! + hex[1]!, 16),
        b: Number.parseInt(hex[2]! + hex[2]!, 16),
        a: 1,
      };
    }

    // Full hex (#ffffff)
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
  }

  // Parse rgb/rgba colors
  const rgba = text.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return null;

  const values = rgba[1]!.split(',').map((part) => Number.parseFloat(part.trim()));
  return {
    r: values[0] ?? 0,
    g: values[1] ?? 0,
    b: values[2] ?? 0,
    a: values[3] ?? 1,
  };
}

/**
 * Export colorToRgb for testing/external use
 */
export { colorToRgb };
