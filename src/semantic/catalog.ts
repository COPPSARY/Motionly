import { semanticVectorDefinitions } from './vector-registry';
import { layoutDefinitions } from '../motion-system/layout';
import { showcaseDefinitions } from '../motion-system/showcase';
import { parseTime } from '../core/units';

export const MOTION_CATALOG_VERSION = 1;

export type FieldSchema = Readonly<{
  type: 'string' | 'number' | 'time' | 'boolean' | 'asset' | 'list';
  docs: string;
}>;

export type CatalogEntry = Readonly<{
  name: string;
  version: number;
  category: string;
  schema: Readonly<Record<string, FieldSchema>>;
  defaults: Readonly<Record<string, string | number | boolean>>;
  docs: string;
}>;

const field = (type: FieldSchema['type'], docs: string): FieldSchema => ({ type, docs });

const presetSchema = {
  delay: field('time', 'Start offset.'),
  duration: field('time', 'Total move duration.'),
  ease: field('string', 'Easing curve.'),
  easing: field('string', 'Alias for easing curve.'),
  exitAt: field('time', 'Optional exit start.'),
  exitDuration: field('time', 'Optional faster exit duration.'),
  exitEase: field('string', 'Exit easing curve.'),
  split: field('string', 'Text split mode.'),
  stagger: field('time', 'Sibling delay.'),
  direction: field('string', 'Entrance or transition direction.'),
  distance: field('number', 'Travel distance.'),
  from: field('number', 'Starting value.'),
  to: field('number', 'Resting value.'),
  peak: field('number', 'Optional peak value.'),
  opacity: field('number', 'Opacity value.'),
  blur: field('number', 'Blur amount.'),
  intensity: field('number', 'Effect intensity.'),
  anticipation: field('time', 'Counter-move duration.'),
  overshoot: field('number', 'Single overshoot multiplier.'),
  repeat: field('number', 'Repeat count.'),
  loop: field('boolean', 'Loop the move.'),
  order: field('string', 'Reading order.'),
  rangeStart: field('number', 'First text fragment.'),
  rangeEnd: field('number', 'Last text fragment.'),
  amplitude: field('number', 'Emphasis amplitude.'),
  turns: field('number', 'Rotation turns.'),
  rotationFrom: field('number', 'Starting rotation.'),
  rotationTo: field('number', 'Ending rotation.'),
  rotationXFrom: field('number', 'Starting X rotation.'),
  rotationYFrom: field('number', 'Starting Y rotation.'),
  skewXFrom: field('number', 'Starting X skew.'),
  skewYFrom: field('number', 'Starting Y skew.'),
  panX: field('number', 'Media pan X.'),
  panY: field('number', 'Media pan Y.'),
  xFrom: field('number', 'Starting X.'),
  xPeak: field('number', 'Peak X.'),
  xTo: field('number', 'Ending X.'),
  xExit: field('number', 'Exit X.'),
  y: field('number', 'Y offset.'),
  yFrom: field('number', 'Starting Y.'),
  yPeak: field('number', 'Peak Y.'),
  yTo: field('number', 'Ending Y.'),
  yExit: field('number', 'Exit Y.'),
  exitBlur: field('number', 'Exit blur.'),
  exitScale: field('number', 'Exit scale.'),
  separator: field('string', 'Count-up separator.'),
  role: field('string', 'Move role, such as focus or sibling.'),
  focusScale: field('number', 'Focal scale multiplier.'),
  siblingScale: field('number', 'Sibling scale multiplier.'),
  siblingOpacity: field('number', 'Sibling opacity at the end of the move.'),
  pushX: field('number', 'Sibling horizontal parallax distance.'),
  pushY: field('number', 'Sibling vertical parallax distance.'),
} as const;

const move = (
  name: string,
  category: string,
  docs: string,
  defaults: CatalogEntry['defaults'] = {}
): CatalogEntry => ({
  name,
  version: MOTION_CATALOG_VERSION,
  category,
  schema: presetSchema,
  defaults: { duration: 1.2, ease: 'power3.out', ...defaults },
  docs,
});

export const MOVES: readonly CatalogEntry[] = [
  move('keynoteText', 'text', 'Line-masked hero text reveal.', { duration: 0.85, stagger: 0.08 }),
  move('wordReveal', 'text', 'Readable word-by-word reveal.', { stagger: 0.08 }),
  move('charReveal', 'text', 'Fast character treatment.', { stagger: 0.04 }),
  move('splitReveal', 'text', 'Split text reveal.'),
  move('blurReveal', 'text', 'Short blur, rise, and opacity reveal.'),
  move('fadeUp', 'text', 'Subtle upward text entrance.'),
  move('slideIn', 'text', 'Directional text entrance.'),
  move('scaleText', 'text', 'Restrained scale text entrance.'),
  move('typewriter', 'text', 'Character typing treatment.', { stagger: 0.035 }),
  move('maskReveal', 'text transition', 'Clipped line or media reveal.'),
  move('gradientReveal', 'text', 'Accent-colored text reveal.'),
  move('countUp', 'text', 'Animate a numeric text value from zero.'),
  move('softReveal', 'object', 'Opacity, position, scale, and blur on offset timing.'),
  move('springIn', 'object', 'Soft spring entrance.', { ease: 'spring.soft' }),
  move('float', 'object', 'Slow sine-like idle motion.', { duration: 4 }),
  move('pulse', 'object', 'Restrained emphasis loop.', { duration: 2 }),
  move('heroLogo', 'object', 'Protected logo entrance without CTA-style overshoot.'),
  move('drawSVG', 'object', 'Draw a simple stroked SVG path.'),
  move('scaleReveal', 'object', 'Small elastic scale entrance.'),
  move('dynamicSlide', 'object transition', 'Directional slide with a settled arrival.'),
  move('shapeWipe', 'transition', 'Full-frame directional wipe.'),
  move('irisWipe', 'transition', 'Circular scene wipe.'),
  move('slowPush', 'camera', 'Restrained camera push.', { duration: 2.5 }),
  move('push', 'camera', 'Alias for a restrained camera push.', { duration: 2.5 }),
  move('pan', 'camera', 'Purposeful camera pan.', { duration: 2.5, ease: 'sine.inOut' }),
  move('pull', 'camera', 'Settle from a closer camera view.', { duration: 2 }),
  move('speedZoom', 'camera', 'One short camera punch.', { duration: 0.9 }),
  move('productPanel', 'object', 'Product panel entrance.'),
  move(
    'focusZoom',
    'object transition',
    'Focus mode scales and recenters the hero; sibling mode pushes surrounding layers outward with a coordinated fade.',
    {
      duration: 0.9,
      ease: 'power3.inOut',
      role: 'focus',
      focusScale: 1.5,
      siblingScale: 0.86,
      siblingOpacity: 0.08,
      pushX: 180,
      pushY: 0,
    }
  ),
  move(
    'zoomThrough',
    'object transition',
    'Drive through the focal layer to reveal the next shot.',
    {
      duration: 0.75,
      ease: 'power2.in',
      focusScale: 2.4,
      blur: 10,
    }
  ),
  move(
    'whipPan',
    'object transition',
    'Fast directional travel with brief blur and a clean settle.',
    {
      duration: 0.65,
      ease: 'power3.out',
      direction: 'left',
      distance: 220,
      blur: 10,
    }
  ),
  move(
    'sceneSlide',
    'scene transition',
    'Push the whole outgoing scene out while the incoming scene moves in from the same direction.',
    {
      duration: 0.5,
      ease: 'power3.inOut',
      direction: 'right',
    }
  ),
  move(
    'sceneZoom',
    'scene transition',
    'Zoom the whole outgoing scene through camera while the incoming scene resolves from depth.',
    {
      duration: 0.5,
      ease: 'power3.inOut',
      from: 0.55,
      to: 2.4,
      blur: 10,
    }
  ),
  move('rackFocus', 'object', 'Shift a soft secondary layer into sharp visual focus.', {
    duration: 0.85,
    ease: 'power3.out',
    blur: 16,
    from: 0.96,
    opacity: 0.35,
  }),
  move(
    'depthSwap',
    'object transition',
    'Move a layer between background and foreground depth roles.',
    {
      duration: 0.9,
      ease: 'power3.inOut',
      role: 'foreground',
      from: 0.84,
      siblingOpacity: 0.3,
    }
  ),
  move(
    'cascadeIn',
    'object',
    'Stagger-friendly card or media entrance with one restrained settle.',
    {
      duration: 0.75,
      ease: 'power3.out',
      distance: 70,
      rotationFrom: -3,
    }
  ),
  move(
    'snapMove',
    'object transition',
    'Reposition a UI layer with one directional overshoot and settle.',
    {
      duration: 0.7,
      ease: 'power3.out',
      distance: 140,
    }
  ),
  move(
    'popover',
    'object',
    'Open a panel from its transform origin with a compact spring settle.',
    {
      duration: 0.55,
      ease: 'spring.soft',
      from: 0.78,
    }
  ),
  move('cursorTap', 'object', 'Compact press-and-release feedback for a cursor or control.', {
    duration: 0.42,
    ease: 'power2.inOut',
    amplitude: 0.2,
  }),
  move('shakeReject', 'object', 'Restrained damped rejection feedback for a blocked action.', {
    duration: 0.55,
    ease: 'power2.out',
    amplitude: 12,
  }),
  move('orbitDrift', 'object', 'Deterministic elliptical idle orbit around the resting position.', {
    duration: 4,
    ease: 'sine.inOut',
    amplitude: 70,
    loop: true,
  }),
  move('sceneExit', 'object transition', 'Fast scene exit.', { duration: 0.5, ease: 'power2.in' }),
  move('bounceIn', 'object', 'Compact bounce entrance.', { ease: 'spring' }),
  move('morph', 'object', 'Restrained matched-shape fallback.'),
  move('spinIn', 'object', 'Single spin entrance.'),
  move('rotateReveal', 'object', 'Rotation and opacity entrance.'),
  move('rotateOut', 'object', 'Rotation exit.', { duration: 0.5, ease: 'power2.in' }),
  move('swing', 'object', 'Damped swing emphasis.'),
  move('pendulum', 'object', 'Pendulum loop.'),
  move('rollIn', 'object', 'Rolling entrance.'),
  move('rotateScale', 'object', 'Rotation with restrained scale.'),
  move('logoSpinReveal', 'object', 'Protected logo spin reveal.'),
  move('spin', 'object', 'Continuous linear rotation.', { ease: 'linear' }),
  move('kenBurns', 'object', 'Slow media pan and scale.'),
  move('tiltReveal', 'object', 'Perspective-style media entrance.'),
  move('cardReveal', 'object', 'Card rise with surface elevation.'),
  move('buttonPop', 'object', 'Fast control entrance.', { duration: 0.45 }),
  move('progressFill', 'object', 'Left-anchored progress growth.'),
  move('productReveal', 'object', 'Restrained product reveal.'),
  move('appleHero', 'object', 'Restrained hero fallback.'),
  move('startupLaunch', 'object', 'Restrained launch fallback.'),
  move('highlight-circle-reveal', 'object', 'Draw a structural focus ring.'),
  move('animated-arrow-point', 'object', 'Draw a structural connector arrow.'),
  move('callout-text-pop', 'object', 'Reveal a structural callout.'),
  move('spotlight-mask', 'object', 'Open a structural spotlight mask.'),
];

const effect = (
  name: string,
  category: string,
  docs: string,
  defaults: CatalogEntry['defaults']
): CatalogEntry => ({
  name,
  version: MOTION_CATALOG_VERSION,
  category,
  schema: {
    opacity: field('number', 'Effect opacity.'),
    intensity: field('number', 'Effect strength.'),
    duration: field('time', 'Loop duration.'),
    blendMode: field('string', 'Canvas blend mode.'),
    gradientFrom: field('string', 'Theme gradient start.'),
    gradientTo: field('string', 'Theme gradient end.'),
    color: field('string', 'Effect color.'),
    gridSize: field('number', 'Grid cell size.'),
    gridThickness: field('number', 'Grid line thickness.'),
    particleCount: field('number', 'Particle count.'),
    particleSize: field('number', 'Particle size.'),
  },
  defaults,
  docs,
});

export const EFFECTS: readonly CatalogEntry[] = [
  effect('gradientMotion', 'background', 'Legacy moving gradient.', {
    opacity: 0.2,
    intensity: 1,
    duration: 12,
  }),
  effect('grid', 'background', 'Structural background grid.', {
    opacity: 0.12,
    intensity: 0.7,
    duration: 8,
  }),
  effect('particles', 'background', 'Deterministic ambient particles.', {
    opacity: 0.16,
    intensity: 0.7,
    duration: 8,
  }),
  effect('prism', 'background', 'Restrained prismatic light.', {
    opacity: 0.16,
    intensity: 0.6,
    duration: 10,
  }),
  effect('rippleGrid', 'background', 'Animated structural ripple grid.', {
    opacity: 0.14,
    intensity: 0.6,
    duration: 8,
  }),
  effect('ripple-grid', 'background', 'Alias for rippleGrid.', {
    opacity: 0.14,
    intensity: 0.6,
    duration: 8,
  }),
  effect('meshGradient', 'background', 'Soft moving multi-color background.', {
    opacity: 0.24,
    intensity: 0.7,
    duration: 10,
  }),
  effect('radialGlow', 'background', 'Single focal radial glow.', {
    opacity: 0.28,
    intensity: 0.8,
    duration: 8,
  }),
  effect('aurora', 'background', 'Slow ambient aurora.', {
    opacity: 0.18,
    intensity: 0.55,
    duration: 10,
  }),
  effect('gridFade', 'background', 'Grid that fades toward the frame edge.', {
    opacity: 0.16,
    intensity: 0.7,
    duration: 8,
  }),
  effect('noise', 'background', 'Deterministic fine noise.', {
    opacity: 0.05,
    intensity: 0.5,
    duration: 6,
  }),
  effect('vignette', 'atmosphere', 'Subtle edge darkening.', {
    opacity: 0.32,
    intensity: 0.6,
    duration: 8,
  }),
  effect('grain', 'atmosphere', 'Fine animated film grain.', {
    opacity: 0.04,
    intensity: 0.4,
    duration: 4,
  }),
  effect('edgeFade', 'atmosphere', 'Transparent center with a quiet edge fade.', {
    opacity: 0.24,
    intensity: 0.5,
    duration: 8,
  }),
  effect('bloom', 'atmosphere', 'Additive ambient bloom.', {
    opacity: 0.16,
    intensity: 0.5,
    duration: 8,
    blendMode: 'screen',
  }),
  effect('glass', 'surface', 'Theme-styled translucent surface.', {
    opacity: 0.82,
    intensity: 0.5,
    duration: 0,
  }),
  effect('card', 'surface', 'Theme-styled card surface.', {
    opacity: 1,
    intensity: 0.5,
    duration: 0,
  }),
  effect('deviceFrame', 'surface', 'Theme-styled device surround.', {
    opacity: 1,
    intensity: 0.5,
    duration: 0,
  }),
];

const archetypeSchema = {
  title: field('string', 'Primary headline slot.'),
  subtitle: field('string', 'Supporting copy slot.'),
  media: field('asset', 'Primary real asset alias.'),
  secondary: field('asset', 'Secondary real asset alias.'),
  logo: field('asset', 'Brand logo alias.'),
  value: field('string', 'Primary statistic.'),
  label: field('string', 'Statistic or step label.'),
  cta: field('string', 'Call-to-action copy.'),
  start: field('time', 'Scene start.'),
  duration: field('time', 'Scene duration.'),
  effects: field('list', 'Ordered effect graph, separated by >.'),
  transitionIn: field('string', 'Paired whole-scene entrance transition.'),
  transitionOut: field('string', 'Paired whole-scene exit transition.'),
  frame: field('string', 'Device-frame stub type.'),
  secondaryLabel: field('string', 'Comparison secondary label.'),
} as const;

const archetype = (
  name: string,
  docs: string,
  defaults: CatalogEntry['defaults']
): CatalogEntry => ({
  name,
  version: MOTION_CATALOG_VERSION,
  category: 'scene',
  schema: archetypeSchema,
  defaults,
  docs,
});

export const ARCHETYPES: readonly CatalogEntry[] = [
  archetype('hero', 'Centered promise with one real focal asset.', {
    duration: 5,
    effects: 'meshGradient > grain > vignette',
  }),
  archetype('splitFeature', 'Editorial copy and media split.', {
    duration: 5,
    effects: 'radialGlow > grain',
  }),
  archetype('stat', 'One large statistic with a short explanation.', {
    duration: 4,
    effects: 'gridFade > vignette',
  }),
  archetype('walkthrough', 'One product step with real media and a step label.', {
    duration: 5,
    effects: 'gridFade > grain',
  }),
  archetype('comparison', 'Before/after media comparison.', {
    duration: 6,
    effects: 'radialGlow > vignette',
  }),
  archetype('cta', 'Closing brand promise and CTA.', {
    duration: 4,
    effects: 'aurora > grain > vignette',
  }),
  archetype('logoReveal', 'Protected logo reveal with optional title.', {
    duration: 4,
    effects: 'radialGlow > grain',
  }),
];

/**
 * Composition placement shared by every motion-system block: where the block
 * sits, which beat paces it, and how it stacks.
 */
const placementSchema = {
  parent: field('string', 'Parent scene, group, or layout.'),
  beat: field('string', 'Beat that paces this block.'),
  x: field('number', 'Offset from the parent center.'),
  y: field('number', 'Offset from the parent center.'),
  layer: field('string', 'Compositing layer.'),
  delay: field('time', 'Entrance delay, added to the beat start.'),
  opacity: field('number', 'Base opacity.'),
  scale: field('number', 'Base scale.'),
  center: field('boolean', 'Center in the parent coordinate space.'),
  start: field('time', 'Element start time.'),
  duration: field('time', 'Entrance duration.'),
  track: field('string', 'Timeline row.'),
} as const;

const layoutSchema = {
  ...placementSchema,
  type: field('string', 'Layout solver name.'),
  columns: field('number', 'Column count, where the solver uses one.'),
  gap: field('number', 'Spacing between slots.'),
  width: field('number', 'Composition frame width.'),
  height: field('number', 'Composition frame height.'),
  itemWidth: field('number', 'Explicit slot width.'),
  itemHeight: field('number', 'Explicit slot height.'),
  order: field('string', 'Entrance reading order: linear, center-out, reverse.'),
  stagger: field('time', 'Delay between adjacent slots.'),
} as const;

/** Layouts expose the composition engine as catalog entries. */
export function layoutRegistry(): readonly CatalogEntry[] {
  return layoutDefinitions().map((definition) => ({
    name: definition.type,
    version: MOTION_CATALOG_VERSION,
    category: 'layout',
    schema: layoutSchema,
    defaults: {
      columns: definition.defaults.columns,
      gap: definition.defaults.gap,
      stagger: definition.defaults.stagger,
    },
    docs: `${definition.description} Use for: ${definition.useCases.join(', ')}. Items ${definition.items.min}-${definition.items.max}.`,
  }));
}

const showcaseSchema = {
  ...placementSchema,
  type: field('string', 'Showcase name.'),
  media: field('asset', 'Imported asset alias placed on the screen.'),
  headline: field('string', 'Headline beneath the subject.'),
  caption: field('string', 'Supporting caption.'),
  label: field('string', 'Step or category chip.'),
  width: field('number', 'Overall composition width.'),
  behavior: field('list', 'Showcase behaviors: float, push, highlight, still.'),
  accent: field('string', 'Accent override.'),
  surface: field('string', 'Surface override.'),
  focusX: field('number', 'Highlight focus X inside the screen, 0-1.'),
  focusY: field('number', 'Highlight focus Y inside the screen, 0-1.'),
} as const;

/** Showcases expose the product-presentation compositions as catalog entries. */
export function showcaseRegistry(): readonly CatalogEntry[] {
  return showcaseDefinitions().map((definition) => ({
    name: definition.type,
    version: MOTION_CATALOG_VERSION,
    category: 'showcase',
    schema: showcaseSchema,
    defaults: {
      width: definition.defaults.width,
      behavior: definition.defaults.behavior,
      duration: definition.defaults.duration,
    },
    docs: `${definition.description} Use for: ${definition.useCases.join(', ')}. Presents: ${definition.assetKinds.join(', ') || 'any media'}.`,
  }));
}

const beatSchema = {
  start: field('time', 'Absolute beat start; omit to follow the previous beat.'),
  duration: field('time', 'Beat length; omit to share remaining canvas time.'),
  focus: field('string', 'Focal element the camera frames.'),
  zoom: field('number', 'Camera zoom for this beat.'),
  cameraX: field('number', 'Camera X for this beat.'),
  cameraY: field('number', 'Camera Y for this beat.'),
  transition: field('string', 'Transition into this beat.'),
  from: field('string', 'Transition source element.'),
  to: field('string', 'Transition destination element.'),
  transitionDuration: field('time', 'Transition duration.'),
  easing: field('string', 'Transition easing.'),
  route: field(
    'string',
    'Sustained-motion route: stagedReveals, cameraIntent, uiLife, sequence, cursorLed, or hold.'
  ),
  label: field('string', 'Storyboard label shown in the editor.'),
} as const;

export const BEAT_ENTRY: CatalogEntry = {
  name: 'beat',
  version: MOTION_CATALOG_VERSION,
  category: 'beat',
  schema: beatSchema,
  defaults: {},
  docs: 'A change in focus. Beats never clear the composition; objects persist and transform across them.',
};

export function beatRegistry(): readonly CatalogEntry[] {
  return [BEAT_ENTRY];
}

export interface MotionTheme {
  version: number;
  background: string;
  surface: string;
  raised: string;
  edge: string;
  text: string;
  muted: string;
  accent: string;
  secondary: string;
  positive: string;
  warning: string;
  negative: string;
  ink: string;
  gradientFrom: string;
  gradientTo: string;
  displayFont: string;
  monoFont: string;
  titleSize: number;
  bodySize: number;
  weightRegular: number;
  weightBold: number;
  radius: number;
  shadow: number;
  duration: number;
  stagger: number;
  easing: string;
  cameraZoom: number;
}

export const DEFAULT_THEME: MotionTheme = {
  version: MOTION_CATALOG_VERSION,
  background: '#050608',
  surface: '#12161D',
  raised: '#1A2029',
  edge: '#2A313C',
  text: '#EDF0F4',
  muted: '#8B94A1',
  accent: '#7CF7C5',
  secondary: '#8AB4FF',
  positive: '#57D98B',
  warning: '#FEBC2E',
  negative: '#FF5F57',
  ink: '#0A0E1B',
  gradientFrom: '#7CF7C5',
  gradientTo: '#8AB4FF',
  displayFont: "'Space Grotesk', Inter, sans-serif",
  monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  titleSize: 76,
  bodySize: 30,
  weightRegular: 540,
  weightBold: 740,
  radius: 24,
  shadow: 24,
  duration: 0.8,
  stagger: 0.07,
  easing: 'power3.out',
  cameraZoom: 1.08,
};

export function resolveTheme(properties: Record<string, unknown> = {}): MotionTheme {
  const theme = { ...DEFAULT_THEME };
  for (const key of Object.keys(theme) as Array<keyof MotionTheme>) {
    if (properties[key] === undefined) continue;
    const fallback = theme[key];
    const value =
      typeof fallback === 'number'
        ? key === 'duration' || key === 'stagger'
          ? parseTime(properties[key] as string | number)
          : Number(properties[key])
        : String(properties[key]);
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    (theme as unknown as Record<string, unknown>)[key] = value;
  }
  return theme;
}

export function effectRegistry(): readonly CatalogEntry[] {
  return EFFECTS;
}

export function moveRegistry(): readonly CatalogEntry[] {
  return MOVES;
}

export function componentRegistry(): readonly CatalogEntry[] {
  return semanticVectorDefinitions().map((definition) => ({
    name: definition.type,
    version: MOTION_CATALOG_VERSION,
    category: 'component',
    schema: {
      label: field('string', 'Primary label slot.'),
      detail: field('string', 'Supporting detail slot.'),
      headline: field('string', 'Headline slot.'),
      cta: field('string', 'Action slot.'),
      source: field('asset', 'Optional real asset alias.'),
      width: field('number', 'Component width.'),
      x: field('number', 'Legacy component X position.'),
      y: field('number', 'Legacy component Y position.'),
      role: field('string', 'Semantic role.'),
      intent: field('string', 'Story intent.'),
      behavior: field('list', 'Built-in behaviors.'),
      parent: field('string', 'Parent scene or group.'),
      color: field('string', 'Primary themed color override.'),
      accent: field('string', 'Accent override.'),
      surface: field('string', 'Surface override.'),
      delay: field('time', 'Entrance delay.'),
      duration: field('time', 'Entrance duration.'),
      values: field('list', 'Value slots.'),
      labels: field('list', 'Label slots.'),
      countTo: field('number', 'Animated statistic target.'),
    },
    defaults: {
      width: definition.width,
      behavior: definition.defaultBehavior,
    },
    docs: `${definition.type}: ${definition.capabilities.join(', ')}. Parts: ${definition.layers.join(', ')}.`,
  }));
}

export function archetypeRegistry(): readonly CatalogEntry[] {
  return ARCHETYPES;
}

export function catalogPrompt(): string {
  const section = (title: string, entries: readonly CatalogEntry[]) =>
    `${title} (catalog v${MOTION_CATALOG_VERSION}):\n${entries
      .map(
        (entry) =>
          `- ${entry.name}: ${entry.docs} Fields: ${Object.keys(entry.schema).join(', ')}. Defaults: ${JSON.stringify(entry.defaults)}`
      )
      .join('\n')}`;
  return [
    section('Effects', EFFECTS),
    section('Moves', MOVES),
    section('Components', componentRegistry()),
    section('Showcases', showcaseRegistry()),
    section('Layouts', layoutRegistry()),
    section('Beats', beatRegistry()),
    section('Archetypes', ARCHETYPES),
  ].join('\n\n');
}

/**
 * Markers the motion system stamps on lowered blocks so the editor and
 * inspector can tell where a value came from. They are always accepted.
 */
const MOTION_SYSTEM_MARKERS = new Set(['beat', 'layoutType', 'layoutEmphasis', 'showcaseType']);

export function validateCatalogProperties(
  entry: CatalogEntry,
  properties: Record<string, unknown>,
  allowed: readonly string[] = []
): void {
  const known = new Set([...Object.keys(entry.schema), ...allowed]);
  const unknown = Object.keys(properties).filter(
    (key) => !known.has(key) && !MOTION_SYSTEM_MARKERS.has(key) && !key.includes('.')
  );
  if (unknown.length) {
    throw new Error(
      `${entry.category} "${entry.name}" does not support ${unknown.join(', ')}. Available: ${[
        ...known,
      ].join(', ')}.`
    );
  }
}
