import { appUrl } from '../../../app/routing';
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

export const ANIMATION_PRESETS: AnimationPresetDef[] = [
  { name: 'splitReveal', description: 'Split character reveal', category: 'text' },
  { name: 'blurReveal', description: 'Blur and fade reveal', category: 'text' },
  { name: 'fadeUp', description: 'Fade up from bottom', category: 'text' },
  { name: 'slideIn', description: 'Slide in from side', category: 'text' },
  { name: 'typewriter', description: 'Typewriter effect', category: 'text' },
  { name: 'keynoteText', description: 'Keynote-style text reveal', category: 'text' },
  { name: 'charReveal', description: 'Character-by-character reveal', category: 'text' },
  { name: 'wordReveal', description: 'Word-by-word reveal', category: 'text' },
  { name: 'heroLogo', description: 'Hero logo entrance', category: 'object' },
  { name: 'softReveal', description: 'Soft fade and scale reveal', category: 'object' },
  { name: 'springIn', description: 'Spring entrance', category: 'object' },
  { name: 'float', description: 'Floating motion', category: 'object' },
  { name: 'pulse', description: 'Pulsing scale', category: 'object' },
  { name: 'drawSVG', description: 'SVG path drawing', category: 'object' },
  { name: 'scaleReveal', description: 'Scale up reveal', category: 'object' },
  { name: 'shapeWipe', description: 'Directional wipe transition', category: 'transition' },
  { name: 'irisWipe', description: 'Circular iris wipe', category: 'transition' },
  { name: 'maskReveal', description: 'Masked reveal transition', category: 'transition' },
  { name: 'dynamicSlide', description: 'Dynamic slide transition', category: 'transition' },
  { name: 'slowPush', description: 'Slow camera push', category: 'camera' },
  { name: 'pan', description: 'Camera pan', category: 'camera' },
  { name: 'speedZoom', description: 'Speed zoom punch', category: 'camera' },
];

export const AVAILABLE_PRESETS = [
  {
    name: 'Motionly',
    path: appUrl('preset/motionly/motionly.motion'),
    gifPath: appUrl('preset/motionly/motionly-preset.gif'),
  },
];

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
