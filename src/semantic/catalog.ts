import {
  publishedSemanticVectorDefinitions,
  semanticComponentMetadata,
  semanticVectorDefinitions,
  type SemanticVectorDefinition,
  type SemanticComponentMetadata,
} from './vector-registry';
import { layoutDefinitions } from '../motion-system/layout';
import { showcaseDefinitions } from '../motion-system/showcase';
import { parseTime } from '../core/units';
import { TRANSITION_TOKENS } from '../motion-system/budget';

export const MOTION_CATALOG_VERSION = 1;

/** ReactBits names stay public; Motionly lowers them to its deterministic recipes. */
export const REACTBITS_MOVE_ALIASES = {
  'animated-content': 'softReveal',
  'blob-cursor': 'cursorTap',
  'click-spark': 'cursorTap',
  crosshair: 'snapMove',
  cubes: 'rotateScale',
  'fade-content': 'softReveal',
  'glare-hover': 'pulse',
  'image-trail': 'cascadeIn',
  magnet: 'snapMove',
  'magnet-lines': 'snapMove',
  'meta-balls': 'orbitDrift',
  'metallic-paint': 'pulse',
  noise: 'pulse',
  'pixel-trail': 'cascadeIn',
  'pixel-transition': 'maskReveal',
  ribbons: 'orbitDrift',
  'shape-blur': 'rackFocus',
  'splash-cursor': 'cursorTap',
  'star-border': 'pulse',
  'sticker-peel': 'tiltReveal',
  'target-cursor': 'cursorTap',
  'ascii-text': 'charReveal',
  'blur-text': 'blurReveal',
  'circular-text': 'charReveal',
  'count-up': 'countUp',
  'curved-loop': 'charReveal',
  'decrypted-text': 'charReveal',
  'falling-text': 'charReveal',
  'fuzzy-text': 'blurReveal',
  'glitch-text': 'charReveal',
  'gradient-text': 'gradientReveal',
  'rotating-text': 'scaleText',
  'scrambled-text': 'charReveal',
  'scroll-float': 'fadeUp',
  'scroll-reveal': 'wordReveal',
  'scroll-velocity': 'slideIn',
  'shiny-text': 'gradientReveal',
  'split-text': 'splitReveal',
  'text-cursor': 'typewriter',
  'text-pressure': 'scaleText',
  'text-trail': 'charReveal',
  'text-type': 'typewriter',
  'true-focus': 'blurReveal',
  'variable-proximity': 'scaleText',
} as const;

export function canonicalMoveName(name: string): string {
  return REACTBITS_MOVE_ALIASES[name as keyof typeof REACTBITS_MOVE_ALIASES] ?? name;
}

const DISTINCT_REACTBITS_TEXT_MOVES = new Set([
  'split-text',
  'decrypted-text',
  'scrambled-text',
  'glitch-text',
  'rotating-text',
  'falling-text',
  'scroll-float',
  'text-trail',
  'text-pressure',
  'variable-proximity',
]);

export const REACTBITS_EFFECT_ALIASES = {
  aurora: 'aurora',
  balatro: 'meshGradient',
  ballpit: 'particles',
  beams: 'prism',
  'dark-veil': 'vignette',
  dither: 'noise',
  'dot-grid': 'grid',
  'faulty-terminal': 'noise',
  galaxy: 'particles',
  'grid-distortion': 'rippleGrid',
  'grid-motion': 'grid',
  hyperspeed: 'prism',
  iridescence: 'meshGradient',
  'letter-glitch': 'noise',
  'light-rays': 'prism',
  lightning: 'prism',
  'liquid-chrome': 'gradientMotion',
  orb: 'radialGlow',
  particles: 'particles',
  'ripple-grid': 'rippleGrid',
  silk: 'meshGradient',
  squares: 'grid',
  threads: 'rippleGrid',
  waves: 'rippleGrid',
} as const;

export function canonicalEffectName(name: string): string {
  return REACTBITS_EFFECT_ALIASES[name as keyof typeof REACTBITS_EFFECT_ALIASES] ?? name;
}

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
  metadata?: SemanticComponentMetadata;
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
  exitDistance: field('number', 'Exit travel distance, independent of the entrance.'),
  exitDirection: field('string', 'Exit direction, independent of the entrance.'),
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
  aspect: field('number', 'Source aspect ratio used to calculate a media focus path.'),
  focusX: field('number', 'First normalized media focus X, 0-1.'),
  focusY: field('number', 'First normalized media focus Y, 0-1.'),
  focus2X: field('number', 'Second normalized media focus X, 0-1.'),
  focus2Y: field('number', 'Second normalized media focus Y, 0-1.'),
  focus2Scale: field('number', 'Second focal scale multiplier.'),
  focus3X: field('number', 'Optional third normalized media focus X, 0-1.'),
  focus3Y: field('number', 'Optional third normalized media focus Y, 0-1.'),
  focus3Scale: field('number', 'Third focal scale multiplier.'),
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

const BASE_MOVES: readonly CatalogEntry[] = [
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
  move('fadeIn', 'text', 'Whole-line opacity entrance.', { duration: 0.62 }),
  move('fadeOut', 'text', 'Whole-line opacity exit.', { duration: 0.46, ease: 'power2.in' }),
  move('bounceOut', 'text', 'Compact text exit with a downward rebound.', {
    duration: 0.5,
    ease: 'power2.in',
  }),
  move('slideLeft', 'text', 'Text glides left into its resting position.', { duration: 0.62 }),
  move('slideRight', 'text', 'Text glides right into its resting position.', { duration: 0.62 }),
  move('slideUp', 'text', 'Text rises into its resting position.', { duration: 0.62 }),
  move('slideDown', 'text', 'Text drops into its resting position.', { duration: 0.62 }),
  move('zoomIn', 'text', 'Text scales cleanly into view.', { duration: 0.62 }),
  move('zoomOut', 'text', 'Text scales away from view.', { duration: 0.5, ease: 'power2.in' }),
  move('spinOut', 'text', 'Text rotates and contracts out of view.', {
    duration: 0.5,
    ease: 'power2.in',
  }),
  move('flicker', 'text loop', 'Finite seek-safe text flicker over the authored duration.', {
    duration: 1.2,
  }),
  move('wave', 'text loop', 'Per-letter vertical wave.', { duration: 1.6, ease: 'sine.inOut' }),
  move('jitter', 'text loop', 'Fast restrained per-letter shake.', {
    duration: 0.8,
    ease: 'linear',
  }),
  move('fallDown', 'text', 'Letters fall from above and settle.', { duration: 0.68 }),
  move('riseUp', 'text', 'Letters rise decisively into place.', { duration: 0.68 }),
  move('driftUp', 'text', 'Whole-line gentle upward entrance.', { duration: 0.8 }),
  move('expand', 'text', 'Whole-line tracking expands into place.', { duration: 0.72 }),
  move('concentrate', 'text', 'Wide tracking contracts into a precise lockup.', { duration: 0.72 }),
  move('jigglyWobble', 'text loop', 'Finite per-letter wobble.', {
    duration: 1.4,
    ease: 'sine.inOut',
  }),
  move('rainbow', 'text loop', 'Cycles editable text color across a finite loop.', {
    duration: 2,
    ease: 'linear',
  }),
  move('fontShift', 'text loop', 'Cycles between bundled font families over time.', {
    duration: 2,
    ease: 'linear',
  }),
  move('roll', 'text', 'Text rolls vertically into place.', { duration: 0.68 }),
  move('pendulumSwing', 'text loop', 'Whole-line pendulum motion.', {
    duration: 1.8,
    ease: 'sine.inOut',
  }),
  move('glitchTransition', 'text transition', 'Per-letter digital slice and settle.', {
    duration: 0.62,
  }),
  move('blurPass', 'text transition', 'Directional blur travels across words.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('whiteFlash', 'text transition', 'Bright impact flash resolving to the text color.', {
    duration: TRANSITION_TOKENS.duration.medium,
  }),
  move('blackSmoke', 'text transition', 'Dark blurred text dispersal.', {
    duration: TRANSITION_TOKENS.duration.medium,
    ease: 'power2.in',
  }),
  move('pullIn', 'text transition', 'Fast depth pull into the resting title.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('pullOut', 'text transition', 'Fast depth push away from the viewer.', {
    duration: TRANSITION_TOKENS.duration.medium,
    ease: 'power2.in',
  }),
  move('slideTransition', 'text transition', 'Directional old-to-new title slide recipe.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('splitMaskWipe', 'text transition', 'Text opens from the center as a split mask.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('revolvingChecker', 'text transition', 'Alternating glyph blocks revolve into view.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('fanOut', 'text transition', 'Words spread outward from one focal point.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('clockWipe', 'text transition', 'Radial-style ordered glyph reveal.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('zoomLens', 'text transition', 'Optical blur and scale snap into focus.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('pageCurl', 'text transition', 'Line segments turn in like a page.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('mosaicPixelate', 'text transition', 'Glyph blocks assemble from pixel-like pieces.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('neonGlowWipe', 'text transition', 'A bright glow sweeps across the title.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('verticalBlinds', 'text transition', 'Glyph slats open around the vertical axis.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('horizontalBlinds', 'text transition', 'Word slats open around the horizontal axis.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('smoothScale', 'text transition', 'Fluid whole-line scale transition.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move(
    'doubleCrossShift',
    'text transition',
    'Alternating diagonal text slices cross and settle.',
    {
      duration: TRANSITION_TOKENS.duration.emphasis,
    }
  ),
  move('waveWarp', 'text transition', 'Per-letter liquid wave resolves into a title.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
  }),
  move('softReveal', 'object', 'Opacity, position, scale, and blur on offset timing.'),
  move('springIn', 'object', 'Soft spring entrance.', { ease: 'spring.soft' }),
  move('float', 'object', 'Slow sine-like idle motion.', { duration: 4 }),
  move('pulse', 'text object', 'Restrained emphasis loop.', { duration: 2 }),
  move('heroLogo', 'object', 'Protected logo entrance without CTA-style overshoot.'),
  move('drawSVG', 'object', 'Draw a simple stroked SVG path.'),
  move('scaleReveal', 'object', 'Restrained scale entrance.', {
    duration: 0.62,
    ease: 'power4.out',
  }),
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
      duration: TRANSITION_TOKENS.duration.emphasis,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      role: 'focus',
      focusScale: 1.12,
      siblingScale: 0.96,
      siblingOpacity: 0.55,
      pushX: 30,
      pushY: 0,
    }
  ),
  move(
    'zoomThrough',
    'object transition',
    'Drive through the focal layer to reveal the next shot.',
    {
      duration: TRANSITION_TOKENS.duration.slow,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      focusScale: 1.25,
      blur: TRANSITION_TOKENS.blur.medium,
    }
  ),
  move(
    'whipPan',
    'object transition',
    'Fast directional travel with brief blur and a clean settle.',
    {
      duration: TRANSITION_TOKENS.duration.medium,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      direction: 'left',
      distance: 96,
      blur: TRANSITION_TOKENS.blur.medium,
    }
  ),
  move(
    'sceneSlide',
    'scene transition',
    'Push the whole outgoing scene out while the incoming scene moves in from the same direction.',
    {
      duration: TRANSITION_TOKENS.duration.emphasis,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      direction: 'right',
    }
  ),
  move(
    'sceneZoom',
    'scene transition',
    'Zoom the whole outgoing scene through camera while the incoming scene resolves from depth.',
    {
      duration: TRANSITION_TOKENS.duration.emphasis,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      from: TRANSITION_TOKENS.scale.modal,
      to: 1.06,
      blur: TRANSITION_TOKENS.blur.medium,
    }
  ),
  move(
    'sceneWhip',
    'scene transition',
    'Fast directional whole-scene travel with a short motion-blur bridge.',
    {
      duration: TRANSITION_TOKENS.duration.medium,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      direction: 'right',
      distance: 480,
      blur: TRANSITION_TOKENS.blur.medium,
    }
  ),
  move(
    'sceneFocus',
    'scene transition',
    'Depth handoff that keeps the frame covered while focus shifts between scenes.',
    {
      duration: TRANSITION_TOKENS.duration.slow,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      from: 1.02,
      to: 1.02,
      blur: TRANSITION_TOKENS.blur.medium,
    }
  ),
  move(
    'scenePivot',
    'scene transition',
    'Shallow whole-scene perspective pivot with restrained travel and blur.',
    {
      duration: TRANSITION_TOKENS.duration.slow,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      direction: 'right',
      distance: 96,
      blur: TRANSITION_TOKENS.blur.small,
    }
  ),
  move('rackFocus', 'object', 'Shift a soft secondary layer into sharp visual focus.', {
    duration: TRANSITION_TOKENS.duration.emphasis,
    ease: TRANSITION_TOKENS.easing.smoothOut,
    blur: TRANSITION_TOKENS.blur.medium,
    from: TRANSITION_TOKENS.scale.modal,
    opacity: 0.35,
  }),
  move(
    'depthSwap',
    'object transition',
    'Move a layer between background and foreground depth roles.',
    {
      duration: TRANSITION_TOKENS.duration.emphasis,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      role: 'foreground',
      from: TRANSITION_TOKENS.scale.modal,
      siblingOpacity: 0.55,
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
      duration: TRANSITION_TOKENS.duration.slow,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      distance: TRANSITION_TOKENS.distance.large,
    }
  ),
  move(
    'popover',
    'object',
    'Open a panel from its transform origin with a compact spring settle.',
    {
      duration: TRANSITION_TOKENS.duration.fast,
      ease: TRANSITION_TOKENS.easing.smoothOut,
      from: TRANSITION_TOKENS.scale.modal,
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
  move('bounceIn', 'text object', 'Compact bounce entrance.', { ease: 'spring' }),
  move('morph', 'object', 'Restrained matched-shape fallback.'),
  move('spinIn', 'text object', 'Single spin entrance.'),
  move('rotateReveal', 'object', 'Rotation and opacity entrance.'),
  move('rotateOut', 'object', 'Rotation exit.', { duration: 0.5, ease: 'power2.in' }),
  move('swing', 'text object', 'Damped swing emphasis.'),
  move('pendulum', 'text object', 'Pendulum loop.'),
  move('rollIn', 'text object', 'Rolling entrance.'),
  move('rotateScale', 'object', 'Rotation with restrained scale.'),
  move('logoSpinReveal', 'object', 'Protected logo spin reveal.'),
  move('spin', 'object', 'Continuous linear rotation.', { ease: 'linear' }),
  move('kenBurns', 'object', 'Slow media pan and scale.'),
  move('tiltReveal', 'object', 'Perspective-style media entrance.'),
  move(
    'mediaTour',
    'object transition',
    'Establish one real screenshot, then travel through two authored focus points without rebuilding the UI.',
    {
      duration: 0.76,
      ease: 'power3.inOut',
      aspect: 1.7778,
      focusScale: 1.24,
      focus2Scale: 1.3,
    }
  ),
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

const REACTBITS_MOVES: readonly CatalogEntry[] = Object.entries(REACTBITS_MOVE_ALIASES).map(
  ([name, target]) => {
    const base = BASE_MOVES.find((entry) => entry.name === target)!;
    return move(
      name,
      base.category,
      DISTINCT_REACTBITS_TEXT_MOVES.has(name)
        ? `ReactBits ${name} adapted as distinct editable deterministic text choreography.`
        : `ReactBits ${name} adapted to Motionly's editable deterministic ${target} recipe.`,
      base.defaults
    );
  }
);

export const MOVES: readonly CatalogEntry[] = [...BASE_MOVES, ...REACTBITS_MOVES];

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

const BASE_EFFECTS: readonly CatalogEntry[] = [
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

const BASE_EFFECT_NAMES = new Set(BASE_EFFECTS.map((entry) => entry.name));
const REACTBITS_EFFECTS: readonly CatalogEntry[] = Object.entries(REACTBITS_EFFECT_ALIASES)
  .filter(([name]) => !BASE_EFFECT_NAMES.has(name))
  .map(([name, target]) => {
    const base = BASE_EFFECTS.find((entry) => entry.name === target)!;
    return effect(
      name,
      'background reactbits',
      `ReactBits ${name} adapted to Motionly's editable deterministic ${target} renderer.`,
      base.defaults
    );
  });

export const EFFECTS: readonly CatalogEntry[] = [...BASE_EFFECTS, ...REACTBITS_EFFECTS];

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
  aspect: field('number', 'Optional source aspect ratio for exact screenshot framing.'),
  behavior: field('list', 'Showcase behaviors: perspective, tour, push, highlight, float, still.'),
  accent: field('string', 'Accent override.'),
  surface: field('string', 'Surface override.'),
  focusX: field('number', 'Highlight focus X inside the screen, 0-1.'),
  focusY: field('number', 'Highlight focus Y inside the screen, 0-1.'),
  focusScale: field('number', 'Scale used for the first directed product focus.'),
  focus2X: field('number', 'Optional second product focus X inside the screen, 0-1.'),
  focus2Y: field('number', 'Optional second product focus Y inside the screen, 0-1.'),
  focus2Scale: field('number', 'Scale used for the optional second product focus.'),
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

function componentCatalogEntry(definition: SemanticVectorDefinition): CatalogEntry {
  const metadata = semanticComponentMetadata(definition.type);
  return {
    name: definition.type,
    version: MOTION_CATALOG_VERSION,
    category: `component ${metadata.category}`,
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
      variant: field('string', `Visual variant: ${metadata.variants.join(', ')}.`),
      motionPreset: field('string', `Motion recipe: ${metadata.motionPresets.join(', ')}.`),
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
      variant: metadata.variants[0] ?? 'default',
      motionPreset: 'premium',
    },
    docs: `${metadata.purpose} Use for ${metadata.useCases.join(', ')}. Interaction: ${metadata.interaction} Parts: ${definition.layers.join(', ')}.`,
    metadata,
  };
}

/** Public registry: only names backed by their own visual recipe. */
export function componentRegistry(): readonly CatalogEntry[] {
  return publishedSemanticVectorDefinitions().map(componentCatalogEntry);
}

/** Parser compatibility for old alias-authored projects; not publicly advertised. */
export function runtimeComponentRegistry(): readonly CatalogEntry[] {
  return semanticVectorDefinitions().map(componentCatalogEntry);
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
    section(
      'Components',
      // Include specialized editorial components too. Filtering to the base
      // vocabulary made the registry look rich in code but invisible to the AI.
      componentRegistry()
    ),
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
