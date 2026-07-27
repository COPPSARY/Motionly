import { appUrl } from '../../../app/routing';
import { PRESET_CATALOG } from '../../../presets/catalog';
import { effectRegistry, moveRegistry } from '../../../semantic/catalog';
import type { AnimationPresetDef } from './types';

export const ADJUSTMENT_CONTROLS = [
  { property: 'blur', label: 'Blur', min: 0, max: 40, step: 0.5, fallback: 0 },
  { property: 'brightness', label: 'Brightness', min: 0, max: 3, step: 0.01, fallback: 1 },
  { property: 'contrast', label: 'Contrast', min: 0, max: 3, step: 0.01, fallback: 1 },
  { property: 'saturation', label: 'Saturation', min: 0, max: 3, step: 0.01, fallback: 1 },
  { property: 'hue', label: 'Hue', min: -180, max: 180, step: 1, fallback: 0 },
  { property: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.01, fallback: 0 },
  { property: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.01, fallback: 0 },
  { property: 'invert', label: 'Invert', min: 0, max: 1, step: 0.01, fallback: 0 },
] as const;

export const ANIMATION_PRESETS: AnimationPresetDef[] = moveRegistry().flatMap((entry) =>
  entry.category
    .split(' ')
    .filter((category): category is AnimationPresetDef['category'] =>
      ['text', 'object', 'transition', 'camera'].includes(category)
    )
    .map((category) => ({ name: entry.name, description: entry.docs, category }))
);

export const EFFECT_PRESETS: AnimationPresetDef[] = effectRegistry().map((entry) => ({
  name: entry.name,
  description: entry.docs,
  category: entry.category as AnimationPresetDef['category'],
}));

export const AVAILABLE_PRESETS = PRESET_CATALOG.map((preset) => ({
  name: preset.title,
  path: appUrl(preset.projectPath),
  gifPath: appUrl(preset.previewPath),
}));

export const KEYFRAME_EASINGS = [
  { value: 'linear', label: 'Linear' },
  { value: 'power1.in', label: 'Ease In' },
  { value: 'power1.out', label: 'Ease Out' },
  { value: 'power1.inOut', label: 'Ease In-Out' },
  { value: 'power3.out', label: 'Smooth Out' },
  { value: 'power3.inOut', label: 'Smooth In-Out' },
  { value: 'back.out', label: 'Back Out' },
  { value: 'elastic.out', label: 'Elastic Out' },
] as const;
