/**
 * Product showcase compositions.
 *
 * A showcase turns one real asset into a finished product presentation: device
 * geometry, screen, chrome, reflection, shadow, entrance, idle motion, and an
 * optional camera push — the complete motion design idea the brief asks for,
 * selected by name instead of assembled coordinate by coordinate.
 *
 * Everything emitted here is an ordinary editable element (`group`, `overlay`,
 * `image`, `text`) plus ordinary `AnimationNode`s. No new element kinds reach
 * the scene graph, so the evaluator and canvas renderer are untouched.
 *
 * Coordinate conventions match the rest of the engine: overlays are centered on
 * their parent automatically, images and text opt in with `center`, and a parent
 * carrying `clip` with a width and height crops its children — which is how a
 * screenshot gets cropped to a device screen.
 */

import type { AnimationNode, ElementNode } from '../types/parser';
import type { MotionTheme } from '../semantic/catalog';
import type { AssetKind } from './asset-kinds';

export const SHOWCASE_TYPES = [
  'productHero',
  'phoneShowcase',
  'browserShowcase',
  'laptopShowcase',
  'appWindow',
  'dashboardShowcase',
  'screenshotPresentation',
  'uiWalkthrough',
] as const;

export type ShowcaseType = (typeof SHOWCASE_TYPES)[number];

/**
 * Behaviors a showcase understands, beyond its built-in entrance.
 *
 * `float` is opt-in and never a default: idle drift is not sustained motion, and
 * a shot that relies on it reads as waiting. `push` — a camera move expressed on
 * the subject — is the default because it keeps the frame performing.
 */
export const SHOWCASE_BEHAVIORS = [
  'float',
  'push',
  'perspective',
  'tour',
  'highlight',
  'still',
] as const;

export interface ShowcaseDefinition {
  type: ShowcaseType;
  category: 'showcase';
  description: string;
  useCases: readonly string[];
  assetKinds: readonly AssetKind[];
  /** Screen aspect ratio (width / height) the media is cropped to. */
  screenRatio: number;
  defaults: {
    width: number;
    behavior: string;
    duration: number;
  };
}

const definitions: Record<ShowcaseType, ShowcaseDefinition> = {
  productHero: {
    type: 'productHero',
    category: 'showcase',
    description: 'Hero presentation of one product asset with a glow bed and headline.',
    useCases: ['opening shot', 'product reveal', 'brand promise'],
    assetKinds: ['logo', 'ui', 'screenshot', 'illustration', 'photo'],
    screenRatio: 16 / 10,
    defaults: { width: 1100, behavior: 'push', duration: 0.75 },
  },
  phoneShowcase: {
    type: 'phoneShowcase',
    category: 'showcase',
    description: 'Mobile app screen inside a phone frame with bezel, notch, and screen glare.',
    useCases: ['app launch', 'mobile demo', 'app store reveal'],
    assetKinds: ['screenshot', 'ui', 'video'],
    screenRatio: 0.462,
    defaults: { width: 460, behavior: 'push', duration: 0.66 },
  },
  browserShowcase: {
    type: 'browserShowcase',
    category: 'showcase',
    description: 'Web product inside a browser window with chrome, traffic lights, and URL pill.',
    useCases: ['saas launch', 'website reveal', 'web demo'],
    assetKinds: ['ui', 'screenshot', 'video'],
    screenRatio: 16 / 10,
    defaults: { width: 1180, behavior: 'push', duration: 0.72 },
  },
  laptopShowcase: {
    type: 'laptopShowcase',
    category: 'showcase',
    description: 'Desktop product on a laptop with lid, base, and grounded shadow.',
    useCases: ['saas launch', 'desktop demo', 'product hero'],
    assetKinds: ['ui', 'screenshot', 'video'],
    screenRatio: 16 / 10,
    defaults: { width: 1160, behavior: 'push', duration: 0.78 },
  },
  appWindow: {
    type: 'appWindow',
    category: 'showcase',
    description: 'Native app window with a slim titlebar, for desktop application shots.',
    useCases: ['desktop app', 'tool demo', 'editor reveal'],
    assetKinds: ['ui', 'screenshot', 'video'],
    screenRatio: 16 / 9.6,
    defaults: { width: 1120, behavior: 'perspective', duration: 0.68 },
  },
  dashboardShowcase: {
    type: 'dashboardShowcase',
    category: 'showcase',
    description: 'Software dashboard in a window with a sidebar rail and a camera push into data.',
    useCases: ['saas launch', 'product demo', 'analytics explainer'],
    assetKinds: ['ui', 'chart', 'screenshot'],
    screenRatio: 16 / 9.6,
    defaults: { width: 1240, behavior: 'tour highlight', duration: 0.72 },
  },
  screenshotPresentation: {
    type: 'screenshotPresentation',
    category: 'showcase',
    description: 'Frameless media presentation with elevation and a soft floor reflection.',
    useCases: ['illustration', 'photography', 'flat asset reveal'],
    assetKinds: ['photo', 'illustration', 'screenshot', 'avatar', 'unknown'],
    screenRatio: 16 / 10,
    defaults: { width: 1200, behavior: 'perspective', duration: 0.68 },
  },
  uiWalkthrough: {
    type: 'uiWalkthrough',
    category: 'showcase',
    description: 'One product step: window, step label, and a focus ring on the acting region.',
    useCases: ['product walkthrough', 'onboarding step', 'feature demo'],
    assetKinds: ['ui', 'screenshot'],
    screenRatio: 16 / 9.6,
    defaults: { width: 1180, behavior: 'tour highlight', duration: 0.7 },
  },
};

export function isShowcaseType(value: string): value is ShowcaseType {
  return (SHOWCASE_TYPES as readonly string[]).includes(value);
}

export function showcaseDefinition(type: ShowcaseType): ShowcaseDefinition {
  return definitions[type];
}

export function showcaseDefinitions(): readonly ShowcaseDefinition[] {
  return Object.values(definitions);
}

export interface ShowcaseContext {
  name: string;
  type: ShowcaseType;
  theme: MotionTheme;
  /** Root offset from the composition center. */
  x: number;
  y: number;
  /** Overall composition width; every part derives from it. */
  width: number;
  /** Optional source aspect ratio override for exact screenshot framing. */
  aspect?: number;
  /** Imported asset alias placed on the screen. */
  media?: string;
  headline?: string;
  caption?: string;
  label?: string;
  accent: string;
  surface: string;
  delay: number;
  duration: number;
  layer: string;
  parent?: string;
  behaviors: readonly string[];
  /** Focus point inside the screen, 0..1, used by the highlight ring. */
  focusX: number;
  focusY: number;
  focusScale: number;
  /** Optional second camera target for a directed screenshot walkthrough. */
  focus2X?: number;
  focus2Y?: number;
  focus2Scale?: number;
}

export interface ShowcaseComposition {
  root: ElementNode;
  children: ElementNode[];
  animations: AnimationNode[];
  childIds: string[];
  /** Resolved screen box, so layouts and cameras can frame it. */
  screen: { width: number; height: number };
  /** Element a camera move or shared transition should target. */
  focusId: string;
}

interface Builder {
  children: ElementNode[];
  animations: AnimationNode[];
  add(kind: ElementNode['kind'], suffix: string, properties: Record<string, unknown>): string;
  parented(
    kind: ElementNode['kind'],
    suffix: string,
    parent: string,
    properties: Record<string, unknown>
  ): string;
  enter(
    target: string,
    at: number,
    duration: number,
    from: Record<string, unknown>,
    to: Record<string, unknown>,
    easing?: string
  ): void;
}

function createBuilder(ctx: ShowcaseContext): Builder {
  const children: ElementNode[] = [];
  const animations: AnimationNode[] = [];
  const push = (
    kind: ElementNode['kind'],
    suffix: string,
    parent: string,
    properties: Record<string, unknown>
  ) => {
    const name = `${ctx.name}__${suffix}`;
    // Overlays default to `opacity 0` in the engine so authored decoration stays
    // hidden until something animates it. Showcase geometry is structural — the
    // device body, screen, and chrome must render the moment the root group
    // arrives — so it opts in to full opacity unless a part asks for less.
    const visible = kind === 'overlay' ? { opacity: 1 } : {};
    children.push({
      type: 'Element',
      kind,
      name,
      properties: { parent, layer: ctx.layer, ...visible, ...properties },
    });
    return name;
  };
  return {
    children,
    animations,
    add: (kind, suffix, properties) => push(kind, suffix, ctx.name, properties),
    parented: (kind, suffix, parent, properties) => push(kind, suffix, parent, properties),
    enter(target, at, duration, from, to, easing = 'power3.out') {
      animations.push({
        type: 'Animation',
        target,
        from,
        to,
        keyframes: [],
        delay: round(ctx.delay + at),
        duration: round(duration),
        easing,
      });
    },
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Compose a showcase.
 *
 * Returns the root group plus every generated part. Callers splice the nodes
 * into the program in place of the `showcase` block.
 */
export function buildShowcase(ctx: ShowcaseContext): ShowcaseComposition {
  const definition = definitions[ctx.type];
  const theme = ctx.theme;
  const builder = createBuilder(ctx);
  const width = Math.max(80, ctx.width);
  const behaviors = new Set(ctx.behaviors.length ? ctx.behaviors : [definition.defaults.behavior]);
  const still = behaviors.has('still');

  const root: ElementNode = {
    type: 'Element',
    kind: 'group',
    name: ctx.name,
    properties: {
      ...(ctx.parent ? { parent: ctx.parent } : {}),
      center: true,
      layer: ctx.layer,
      x: round(ctx.x),
      y: round(ctx.y),
      opacity: 0,
      showcaseType: ctx.type,
    },
  };

  const geometry = deviceGeometry(ctx.type, width, ctx.aspect ?? definition.screenRatio);
  const screenId = buildFrame(builder, ctx, geometry, theme);
  const mediaId = buildScreenContent(builder, ctx, geometry, screenId, theme);
  buildCopy(builder, ctx, geometry, theme);

  // The whole composition arrives as one designed surface. Product media gets a
  // perspective settle; ordinary showcases keep the restrained rise.
  if (behaviors.has('perspective') || behaviors.has('tour')) {
    builder.enter(
      ctx.name,
      0,
      ctx.duration,
      {
        opacity: 0,
        x: round(ctx.x + width * 0.055),
        y: round(ctx.y + 54),
        scale: 0.93,
        rotationX: 4,
        rotationY: -6,
        blur: 5,
      },
      {
        opacity: 1,
        x: round(ctx.x),
        y: round(ctx.y),
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        blur: 0,
      },
      'power4.out'
    );
  } else {
    builder.enter(
      ctx.name,
      0,
      ctx.duration,
      { opacity: 0, y: round(ctx.y + 56), scale: 0.94, blur: 6 },
      { opacity: 1, y: round(ctx.y), scale: 1, blur: 0 }
    );
  }
  if (mediaId) {
    builder.enter(mediaId, 0.18, Math.max(0.4, ctx.duration * 0.8), { opacity: 0 }, { opacity: 1 });
  }

  if (behaviors.has('float') && !still) {
    builder.animations.push({
      type: 'Animation',
      target: ctx.name,
      from: {},
      to: {},
      keyframes: [
        { offset: 0, properties: { y: round(ctx.y), rotation: 0 } },
        { offset: 0.5, properties: { y: round(ctx.y - 14), rotation: 0.6 } },
        { offset: 1, properties: { y: round(ctx.y), rotation: 0 } },
      ],
      delay: round(ctx.delay + ctx.duration + 0.4),
      duration: 5.2,
      easing: 'sine.inOut',
      repeat: 'infinite',
      repeatType: 'loop',
    });
  }

  // `push` is a camera push expressed on the subject, so a single showcase can
  // move closer without dragging the whole global camera with it.
  if (behaviors.has('push') && !still) {
    builder.enter(ctx.name, ctx.duration + 0.25, 2.6, { scale: 1 }, { scale: 1.06 }, 'sine.inOut');
  }

  if (behaviors.has('tour') && !still) {
    const first = focusTransform(ctx, geometry, ctx.focusX, ctx.focusY, ctx.focusScale);
    builder.enter(
      ctx.name,
      ctx.duration + 0.48,
      1.05,
      { x: round(ctx.x), y: round(ctx.y), scale: 1, rotationX: 0, rotationY: 0 },
      first,
      'power3.inOut'
    );
    if (ctx.focus2X !== undefined && ctx.focus2Y !== undefined) {
      builder.enter(
        ctx.name,
        ctx.duration + 1.88,
        1.15,
        first,
        focusTransform(ctx, geometry, ctx.focus2X, ctx.focus2Y, ctx.focus2Scale ?? ctx.focusScale),
        'power3.inOut'
      );
    }
  }

  const focusRing = behaviors.has('highlight')
    ? buildHighlight(builder, ctx, geometry, screenId)
    : undefined;

  return {
    root,
    children: builder.children,
    animations: builder.animations,
    childIds: builder.children.map((child) => child.name),
    screen: { width: geometry.screenWidth, height: geometry.screenHeight },
    focusId: focusRing ?? mediaId ?? screenId ?? ctx.name,
  };
}

function focusTransform(
  ctx: ShowcaseContext,
  geometry: Geometry,
  focusX: number,
  focusY: number,
  scale: number
): Record<string, number> {
  const resolvedScale = Math.max(1, Math.min(1.65, scale));
  const xTravel = (Math.max(0, Math.min(1, focusX)) - 0.5) * geometry.screenWidth * resolvedScale;
  const yTravel = (Math.max(0, Math.min(1, focusY)) - 0.5) * geometry.screenHeight * resolvedScale;
  return {
    x: round(
      ctx.x - Math.max(-geometry.screenWidth * 0.36, Math.min(geometry.screenWidth * 0.36, xTravel))
    ),
    y: round(
      ctx.y -
        Math.max(-geometry.screenHeight * 0.32, Math.min(geometry.screenHeight * 0.32, yTravel))
    ),
    scale: round(resolvedScale),
    rotationX: 0,
    rotationY: 0,
  };
}

interface Geometry {
  bodyWidth: number;
  bodyHeight: number;
  screenWidth: number;
  screenHeight: number;
  /** Screen center offset inside the body. */
  screenY: number;
  bezel: number;
  chrome: number;
  radius: number;
}

/** Deterministic device geometry: one width in, a complete frame out. */
function deviceGeometry(type: ShowcaseType, width: number, screenRatio: number): Geometry {
  if (type === 'phoneShowcase') {
    const bezel = width * 0.038;
    const screenWidth = width - bezel * 2;
    const screenHeight = screenWidth / screenRatio;
    return {
      bodyWidth: width,
      bodyHeight: screenHeight + bezel * 2,
      screenWidth,
      screenHeight,
      screenY: 0,
      bezel,
      chrome: 0,
      radius: width * 0.11,
    };
  }
  if (type === 'screenshotPresentation' || type === 'productHero') {
    const screenHeight = width / screenRatio;
    return {
      bodyWidth: width,
      bodyHeight: screenHeight,
      screenWidth: width,
      screenHeight,
      screenY: 0,
      bezel: 0,
      chrome: 0,
      radius: Math.min(28, width * 0.02),
    };
  }
  const chrome =
    type === 'browserShowcase'
      ? width * 0.052
      : type === 'laptopShowcase'
        ? width * 0.05
        : width * 0.038;
  const bezel = type === 'laptopShowcase' ? width * 0.014 : width * 0.008;
  const screenWidth = width - bezel * 2;
  const screenHeight = screenWidth / screenRatio;
  return {
    bodyWidth: width,
    bodyHeight: screenHeight + chrome + bezel * 2,
    screenWidth,
    screenHeight,
    screenY: chrome / 2,
    bezel,
    chrome,
    radius: Math.min(26, width * 0.022),
  };
}

/**
 * Build the device body and chrome. Returns the id of the clipping screen,
 * which is what real media gets parented to.
 */
function buildFrame(
  builder: Builder,
  ctx: ShowcaseContext,
  geometry: Geometry,
  theme: MotionTheme
): string {
  const frameless = ctx.type === 'screenshotPresentation' || ctx.type === 'productHero';

  if (ctx.type === 'productHero') {
    builder.add('overlay', 'glow', {
      shape: 'ellipse',
      radiusX: geometry.bodyWidth * 0.62,
      radiusY: geometry.bodyHeight * 0.5,
      fill: ctx.accent,
      stroke: 'none',
      opacity: 0.16,
      blur: 60,
      blendMode: 'screen',
    });
  }

  if (ctx.type === 'laptopShowcase') {
    // Base first so the lid overlaps it.
    builder.add('overlay', 'base', {
      shape: 'rect',
      y: round(geometry.bodyHeight / 2 + geometry.bodyWidth * 0.019),
      width: round(geometry.bodyWidth * 1.14),
      height: round(geometry.bodyWidth * 0.026),
      radius: round(geometry.bodyWidth * 0.013),
      fill: theme.edge,
      stroke: 'none',
    });
    builder.add('overlay', 'foot', {
      shape: 'rect',
      y: round(geometry.bodyHeight / 2 + geometry.bodyWidth * 0.036),
      width: round(geometry.bodyWidth * 0.2),
      height: round(geometry.bodyWidth * 0.008),
      radius: round(geometry.bodyWidth * 0.004),
      fill: theme.raised,
      stroke: 'none',
      opacity: 0.9,
    });
  }

  if (!frameless) {
    builder.add('overlay', 'body', {
      shape: 'rect',
      width: round(geometry.bodyWidth),
      height: round(geometry.bodyHeight),
      radius: round(geometry.radius),
      fill: theme.raised,
      stroke: theme.edge,
      strokeWidth: 2,
      shadow: theme.shadow,
    });
  }

  const screenId = builder.add('overlay', 'screen', {
    shape: 'rect',
    y: round(geometry.screenY),
    width: round(geometry.screenWidth),
    height: round(geometry.screenHeight),
    radius: round(frameless ? geometry.radius : Math.max(4, geometry.radius * 0.6)),
    fill: theme.background,
    stroke: 'none',
    clip: true,
    ...(frameless ? { shadow: theme.shadow } : {}),
  });

  if (ctx.type === 'phoneShowcase') {
    builder.add('overlay', 'notch', {
      shape: 'rect',
      y: round(-geometry.screenHeight / 2 + geometry.bezel * 1.6),
      width: round(geometry.screenWidth * 0.32),
      height: round(geometry.bezel * 1.5),
      radius: round(geometry.bezel),
      fill: theme.ink,
      stroke: 'none',
    });
  }

  if (ctx.type === 'browserShowcase' || ctx.type === 'laptopShowcase') {
    const chromeY = -geometry.bodyHeight / 2 + geometry.chrome / 2 + geometry.bezel;
    builder.add('overlay', 'chrome', {
      shape: 'rect',
      y: round(chromeY),
      width: round(geometry.screenWidth),
      height: round(geometry.chrome),
      radius: round(geometry.radius * 0.5),
      fill: theme.surface,
      stroke: 'none',
    });
    const dot = geometry.chrome * 0.16;
    for (const [index, color] of [theme.negative, theme.warning, theme.positive].entries()) {
      builder.add('overlay', `dot${index}`, {
        shape: 'circle',
        x: round(-geometry.screenWidth / 2 + geometry.chrome * (0.55 + index * 0.42)),
        y: round(chromeY),
        radius: round(dot),
        fill: color,
        stroke: 'none',
      });
    }
    builder.add('overlay', 'address', {
      shape: 'rect',
      x: round(geometry.chrome * 0.6),
      y: round(chromeY),
      width: round(geometry.screenWidth * 0.46),
      height: round(geometry.chrome * 0.52),
      radius: round(geometry.chrome * 0.26),
      fill: theme.raised,
      stroke: 'none',
    });
  }

  if (
    ctx.type === 'appWindow' ||
    ctx.type === 'dashboardShowcase' ||
    ctx.type === 'uiWalkthrough'
  ) {
    const chromeY = -geometry.bodyHeight / 2 + geometry.chrome / 2 + geometry.bezel;
    builder.add('overlay', 'titlebar', {
      shape: 'rect',
      y: round(chromeY),
      width: round(geometry.screenWidth),
      height: round(geometry.chrome),
      radius: round(geometry.radius * 0.5),
      fill: theme.surface,
      stroke: 'none',
    });
    builder.add('overlay', 'titlebarAccent', {
      shape: 'rect',
      x: round(-geometry.screenWidth / 2 + geometry.chrome * 0.9),
      y: round(chromeY),
      width: round(geometry.chrome * 1.1),
      height: round(geometry.chrome * 0.2),
      radius: round(geometry.chrome * 0.1),
      fill: ctx.accent,
      stroke: 'none',
      opacity: 0.8,
    });
  }

  if (ctx.type === 'dashboardShowcase') {
    builder.parented('overlay', 'rail', screenId, {
      shape: 'rect',
      x: round(-geometry.screenWidth / 2 + geometry.screenWidth * 0.07),
      width: round(geometry.screenWidth * 0.14),
      height: round(geometry.screenHeight),
      fill: theme.surface,
      stroke: 'none',
      opacity: 0.92,
    });
  }

  // A single restrained glare sells glass without decorating the shot.
  builder.parented('overlay', 'glare', screenId, {
    shape: 'rect',
    x: round(-geometry.screenWidth * 0.18),
    width: round(geometry.screenWidth * 0.5),
    height: round(geometry.screenHeight * 1.6),
    rotation: -18,
    gradientFrom: '#ffffff',
    gradientTo: 'transparent',
    gradientAngle: 90,
    fill: 'none',
    stroke: 'none',
    opacity: 0.05,
    blendMode: 'screen',
  });

  if (ctx.type === 'screenshotPresentation') {
    builder.add('overlay', 'reflection', {
      shape: 'rect',
      y: round(geometry.screenHeight * 0.56),
      width: round(geometry.screenWidth * 0.9),
      height: round(geometry.screenHeight * 0.12),
      radius: round(geometry.radius),
      gradientFrom: ctx.accent,
      gradientTo: 'transparent',
      gradientAngle: 90,
      fill: 'none',
      stroke: 'none',
      opacity: 0.12,
      blur: 24,
      blendMode: 'screen',
    });
  }

  return screenId;
}

/**
 * Place the real asset on the screen, or an honest empty-state prompt when no
 * media was supplied. The screen clips, so tall captures crop instead of
 * distorting — the aggressive product crop the house style asks for.
 */
function buildScreenContent(
  builder: Builder,
  ctx: ShowcaseContext,
  geometry: Geometry,
  screenId: string,
  theme: MotionTheme
): string | undefined {
  if (ctx.media) {
    return builder.parented('image', 'media', screenId, {
      source: ctx.media,
      center: true,
      width: round(geometry.screenWidth),
      y: round(geometry.screenY),
      opacity: 0,
      focalX: 0.5,
      focalY: ctx.type === 'phoneShowcase' ? 0 : 0.5,
    });
  }
  builder.parented('text', 'placeholder', screenId, {
    value: 'Add product media',
    center: true,
    y: round(geometry.screenY),
    width: round(geometry.screenWidth * 0.7),
    size: Math.max(16, Math.round(geometry.screenWidth * 0.045)),
    weight: theme.weightRegular,
    color: theme.muted,
    textAlign: 'center',
    wrap: 'word',
  });
  return undefined;
}

/** Headline, caption, and step label live outside the device body. */
function buildCopy(
  builder: Builder,
  ctx: ShowcaseContext,
  geometry: Geometry,
  theme: MotionTheme
): void {
  const below = geometry.bodyHeight / 2;

  if (ctx.label) {
    const chipWidth = Math.max(140, ctx.label.length * geometry.bodyWidth * 0.012 + 80);
    builder.add('overlay', 'stepChip', {
      shape: 'rect',
      y: round(-below - 64),
      width: round(chipWidth),
      height: 44,
      radius: 22,
      fill: theme.surface,
      stroke: ctx.accent,
      strokeWidth: 1,
    });
    builder.add('text', 'step', {
      value: ctx.label,
      center: true,
      y: round(-below - 64),
      width: round(chipWidth),
      size: 22,
      weight: theme.weightBold,
      color: ctx.accent,
      textAlign: 'center',
      verticalAlign: 'middle',
    });
  }

  if (ctx.headline) {
    builder.add('text', 'headline', {
      value: ctx.headline,
      center: true,
      y: round(below + 96),
      width: round(Math.max(720, geometry.bodyWidth)),
      size: Math.round(theme.titleSize * 0.62),
      weight: theme.weightBold,
      color: theme.text,
      textAlign: 'center',
      wrap: 'word',
      opacity: 0,
      textAnimation: `keynoteText(split words stagger ${theme.stagger}s duration ${theme.duration}s delay ${round(ctx.delay + 0.35)}s ease ${theme.easing})`,
    });
  }

  if (ctx.caption) {
    builder.add('text', 'caption', {
      value: ctx.caption,
      center: true,
      y: round(below + (ctx.headline ? 172 : 96)),
      width: round(Math.max(640, geometry.bodyWidth * 0.8)),
      size: Math.round(theme.bodySize * 0.86),
      weight: theme.weightRegular,
      color: theme.muted,
      textAlign: 'center',
      wrap: 'word',
      opacity: 0,
      textAnimation: `fadeUp(split words stagger ${theme.stagger}s duration ${theme.duration}s delay ${round(ctx.delay + 0.55)}s ease ${theme.easing})`,
    });
  }
}

/** Focus ring drawn on the acting region of the screen. */
function buildHighlight(
  builder: Builder,
  ctx: ShowcaseContext,
  geometry: Geometry,
  screenId: string
): string {
  const x = (ctx.focusX - 0.5) * geometry.screenWidth;
  const y = (ctx.focusY - 0.5) * geometry.screenHeight + geometry.screenY;
  return builder.parented('overlay', 'focusRing', screenId, {
    shape: 'circle',
    x: round(x),
    y: round(y),
    radius: round(Math.min(geometry.screenWidth, geometry.screenHeight) * 0.13),
    fill: 'none',
    stroke: ctx.accent,
    strokeWidth: 3,
    glow: 16,
    glowColor: ctx.accent,
    opacity: 0,
    animation: `highlight-circle-reveal(delay ${round(ctx.delay + ctx.duration + 0.15)}s duration 700ms ease power3.out)`,
  });
}
