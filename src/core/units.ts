/**
 * Unit parsing and conversion utilities
 */

import type { Size } from '../types/utils';

/**
 * Parse time value from string to seconds
 * Supports: "1s", "500ms", or raw numbers
 */
export function parseTime(value: string | number): number {
  const text = String(value).trim();
  if (text.endsWith('ms')) return Number.parseFloat(text) / 1000;
  if (text.endsWith('s')) return Number.parseFloat(text);
  return Number.parseFloat(text);
}

/**
 * Parse size string into width and height
 * Format: "1920x1080"
 */
export function parseSize(value: string): Size {
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Invalid size "${value}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Parse scalar value (number, boolean, or string)
 */
export function parseScalar(value: unknown): string | number | boolean {
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  const numeric = Number(text);
  return Number.isNaN(numeric) ? text : numeric;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
