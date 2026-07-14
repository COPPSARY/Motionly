/**
 * Motion Design Defaults
 * Professional motion quality standards based on Apple, GSAP, and industry best practices
 */

export const MOTION_DEFAULTS = {
  /**
   * DEFAULT DURATIONS (in seconds)
   * Based on professional motion design research
   */
  duration: {
    // UI Interactions (snappy, responsive)
    button: 0.2,
    hover: 0.25,
    click: 0.3,
    toggle: 0.35,

    // Micro-interactions
    ripple: 0.4,
    tooltip: 0.3,
    notification: 0.5,

    // Text Animations (Apple keynote style)
    textReveal: 1.2,
    titleReveal: 1.4,
    subtitleReveal: 1.0,
    wordStagger: 1.2,
    charAnimation: 1.5,

    // Logo Animations (hero moments)
    logoReveal: 1.4,
    heroLogo: 1.6,
    logoMorph: 1.8,
    logoFloat: 3.0,

    // Product Animations
    productReveal: 2.0,
    cardReveal: 0.8,
    deviceShowcase: 1.5,
    panelSlide: 0.6,

    // Camera Movements (cinematic)
    cameraPush: 2.5,
    cameraPull: 2.0,
    cameraPan: 3.0,
    cameraOrbit: 4.0,

    // Transitions (scene changes)
    fade: 1.0,
    crossFade: 1.2,
    blur: 0.8,
    mask: 1.5,
    sceneTransition: 1.8,

    // Background Effects (ambient, looping)
    gradientMotion: 8.0,
    noise: 0.0, // continuous
    particles: 6.0,
  },

  /**
   * DEFAULT EASING CURVES
   * Apple's most common: power3.out
   * GSAP standard: power2.out
   */
  easing: {
    // Most common (use 80% of the time)
    default: 'power3.out',

    // UI interactions (quick, responsive)
    ui: 'power2.out',
    button: 'power2.out',
    hover: 'power1.out',

    // Text animations (smooth, readable)
    text: 'power3.out',
    title: 'power3.out',

    // Logo animations (polished, intentional)
    logo: 'softSpring',
    heroLogo: 'softSpring',

    // Product showcases (premium feel)
    product: 'power3.out',

    // Camera movements (cinematic, smooth)
    camera: 'softSpring',
    cameraPush: 'power3.out',
    cameraPan: 'sine.inOut',

    // Transitions (natural, unobtrusive)
    fade: 'power2.out',
    crossFade: 'sine.inOut',

    // Special cases
    bounce: 'bounceOut',
    elastic: 'spring',
    snap: 'power4.out',
    overshoot: 'back.out',
  },

  /**
   * SPRING SETTINGS
   * Apple-style physics parameters
   */
  spring: {
    // Soft spring (Apple's preferred - subtle overshoot)
    soft: {
      tension: 85,
      friction: 22,
      mass: 1,
    },

    // Standard spring (balanced bounce)
    standard: {
      tension: 100,
      friction: 18,
      mass: 1,
    },

    // Tight spring (minimal overshoot)
    tight: {
      tension: 120,
      friction: 25,
      mass: 1,
    },

    // Bouncy spring (playful)
    bouncy: {
      tension: 80,
      friction: 12,
      mass: 1,
    },
  },

  /**
   * STAGGER TIMING RULES
   * Rhythm guidelines for sequential animations
   */
  stagger: {
    // Text animations
    characters: 0.035, // 35ms between characters (smooth wave)
    words: 0.09, // 90ms between words (Apple standard)
    lines: 0.12, // 120ms between lines

    // Object sequences
    listItems: 0.08, // 80ms between list items
    cards: 0.15, // 150ms between cards
    panels: 0.2, // 200ms between panels

    // UI elements
    buttons: 0.05, // 50ms between buttons
    icons: 0.06, // 60ms between icons
    images: 0.1, // 100ms between images

    // Fast stagger (energetic)
    fast: 0.025, // 25ms

    // Slow stagger (deliberate)
    slow: 0.25, // 250ms
  },

  /**
   * CAMERA MOVEMENT RULES
   * Professional cinematography standards
   */
  camera: {
    // Zoom amounts (subtle is better)
    zoomPushAmount: 0.08, // 1.0 → 1.08 (Apple standard)
    zoomPushStrong: 0.12, // 1.0 → 1.12 (emphasis)
    zoomPullAmount: 0.06, // 1.06 → 1.0

    // Pan distances (in pixels)
    panShort: 100,
    panMedium: 200,
    panLong: 400,

    // Offset amounts (Y-axis push)
    pushYOffset: -20, // Slight upward drift

    // Rotation (very subtle)
    maxRotation: 5, // ±5 degrees maximum
    subtleRotation: 2, // ±2 degrees (preferred)
  },

  /**
   * ANIMATION CONSTRAINTS
   * Professional limits for polished feel
   */
  constraints: {
    // Blur limits (avoid excessive blur)
    maxBlur: 10, // 10px maximum blur
    textBlur: 6, // 6px for text reveals
    transitionBlur: 20, // 20px for transitions

    // Scale limits (avoid jarring changes)
    minScale: 0.85, // Don't scale below 85%
    maxScale: 1.15, // Don't scale above 115%
    subtleScale: 0.96, // Subtle scale start (Apple)

    // Overshoot limits
    minOvershoot: 1.02, // 2% overshoot
    maxOvershoot: 1.08, // 8% overshoot (maximum)
    defaultOvershoot: 1.04, // 4% overshoot (balanced)

    // Opacity transitions
    fadeStart: 0, // Always start from 0
    fadeEnd: 1, // Always end at 1
    subtleFade: 0.3, // Subtle fade-in start

    // Rotation constraints
    anticipationRotation: -2, // Small counter-rotation before main movement
    maxTextRotation: 3, // Text should barely rotate
  },

  /**
   * LAYER DEPTH HIERARCHY
   * Visual stacking order (back to front)
   */
  layers: {
    background: 0,
    backgroundEffects: 1,
    supporting: 2,
    hero: 3,
    content: 4,
    details: 5,
    text: 6,
    effects: 7,
    foreground: 8,
  },

  /**
   * TIMING OFFSETS
   * Professional coordination between animations
   */
  timing: {
    // Overlap for smooth transitions
    crossfadeOverlap: 0.3, // 300ms overlap
    sequenceOverlap: 0.15, // 150ms overlap

    // Delays for emphasis
    heroDelay: 0.5, // Half-second pause before hero
    titleDelay: 0.8, // Pause before title
    actionDelay: 0.3, // Pause before call-to-action

    // Exit timing (faster than entrance)
    exitMultiplier: 0.6, // Exits are 60% of entrance duration
  },

  /**
   * PROFESSIONAL GUIDELINES
   */
  philosophy: {
    // Core principles
    polishedOverFlashy: true,
    purposefulMotion: true,
    restrainedEffects: true,
    consistentTiming: true,
    naturalEasing: true,

    // Design rules
    preferEaseOut: true, // 80% of animations should ease out
    avoidLinear: true, // Linear feels robotic
    subtleIsBetter: true, // Less is more
    intentionalOnly: true, // Every animation has purpose
  },
} as const;

/**
 * Quick access to most common defaults
 */
export const QUICK_DEFAULTS = {
  // Most common animation (80% of use cases)
  standard: {
    duration: 1.2,
    ease: 'power3.out',
    delay: 0,
  },

  // UI interactions
  interaction: {
    duration: 0.3,
    ease: 'power2.out',
    delay: 0,
  },

  // Hero moments
  hero: {
    duration: 1.6,
    ease: 'softSpring',
    delay: 0.5,
  },

  // Quick fades
  fade: {
    duration: 0.8,
    ease: 'power2.out',
    delay: 0,
  },
} as const;

/**
 * Get recommended duration for animation type
 */
export function getDefaultDuration(type: keyof typeof MOTION_DEFAULTS.duration): number {
  return MOTION_DEFAULTS.duration[type];
}

/**
 * Get recommended easing for animation type
 */
export function getDefaultEasing(type: keyof typeof MOTION_DEFAULTS.easing): string {
  return MOTION_DEFAULTS.easing[type];
}

/**
 * Get recommended stagger timing
 */
export function getDefaultStagger(type: keyof typeof MOTION_DEFAULTS.stagger): number {
  return MOTION_DEFAULTS.stagger[type];
}
