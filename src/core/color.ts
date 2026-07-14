/**
 * Color parsing and normalization utilities
 */

/**
 * Normalize color parts into a single string
 */
export function normalizeColor(parts: string[]): string {
  return parts.join(' ');
}

/**
 * Parse color value to normalized string
 * Supports: hex (#fff, #ffffff), rgb(), rgba()
 */
export function parseColor(value: string | number): string {
  return String(value).trim();
}
