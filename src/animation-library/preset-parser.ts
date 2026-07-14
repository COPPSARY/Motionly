/**
 * Animation preset parser
 * Parses preset calls from .motion syntax like "heroLogo(delay 1s duration 2s)"
 */

import { parseTime } from '../core/units';
import type { PresetCall, PresetOptions } from '../types/presets';

/**
 * Parse preset call from string value
 * Format: "presetName(option1 value1, option2 value2)"
 */
export function parsePresetCall(value: string | number | unknown): PresetCall {
  const text = String(value ?? '').trim();
  const match = text.match(/^([A-Za-z][\w-]*)(?:\((.*)\))?$/);

  if (!match) {
    return { name: text, options: {} };
  }

  return {
    name: match[1]!,
    options: parseOptions(match[2] ?? ''),
  };
}

/**
 * Parse options from preset call arguments
 */
function parseOptions(source: string): PresetOptions {
  const options: PresetOptions = {};
  const tokens = source
    .replace(/[,:]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];

    if (!key || value == null) break;

    options[key] = normalizeOption(key, value);
  }

  return options;
}

/**
 * Normalize option value based on key
 */
function normalizeOption(key: string, value: string): number | string {
  if (['delay', 'duration', 'stagger', 'exitAt', 'exitDuration'].includes(key)) {
    return parseTime(value);
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}
