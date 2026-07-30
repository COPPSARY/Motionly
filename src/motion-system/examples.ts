/**
 * Registry example compositions.
 *
 * Every layout and showcase ships a real, installable `.motion` project that
 * demonstrates it. These are not documentation snippets — they are the catalog's
 * product surface and the ground truth an agent reads before authoring. A model
 * that can install a correct composition outperforms one handed a schema table.
 *
 * They are generated from the definitions rather than hand-written so they cannot
 * drift, and the test suite audits every one of them against the motion doctrine.
 * Our own catalog is held to the rules we publish.
 */

import { layoutDefinition, layoutDefinitions, type LayoutType } from './layout';
import { showcaseDefinition, showcaseDefinitions, type ShowcaseType } from './showcase';
import type { SemanticComponentType } from '../semantic/vector-registry';

export interface RegistryExample {
  /** Block the example demonstrates. */
  name: string;
  kind: 'layout' | 'showcase' | 'component';
  /** File stem, kebab-cased for the registry folder. */
  slug: string;
  /** Complete, valid `.motion` source. */
  source: string;
  duration: number;
}

const CANVAS = { width: 1920, height: 1080, fps: 60 } as const;

const slugify = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase();

const header = (duration: number, comment: string) => `// ${comment}
canvas {
  size ${CANVAS.width}x${CANVAS.height}
  fps ${CANVAS.fps}
  duration ${duration}s
}

camera {
  zoom 1
}

theme {
  accent #7CF7C5
}`;

/** Component types used to fill layout slots, chosen to suit each layout. */
const FILLERS: Partial<Record<LayoutType, readonly string[]>> = {
  bentoGrid: ['chart', 'notification', 'terminal', 'button'],
  featureGrid: ['button', 'notification', 'button', 'notification'],
  logoWall: ['logo', 'logo', 'logo', 'logo', 'logo', 'logo'],
  deviceStack: ['phone', 'phone', 'phone'],
  timelineLayout: ['button', 'button', 'button'],
  comparisonLayout: ['browser', 'dashboard'],
  splitLayout: ['dashboard', 'notification'],
  masonryGrid: ['browser', 'notification', 'chart', 'terminal', 'button', 'notification'],
  carousel: ['phone', 'phone', 'phone'],
  gallery: ['browser', 'notification', 'chart'],
  floatingCollage: ['notification', 'chart', 'button'],
  heroLayout: ['website', 'notification'],
};

/**
 * Build the example for one layout: three beats so the demo keeps performing —
 * the group composes, the camera pushes in, then settles back out. A single
 * long beat would leave the frame sitting still after its cascade, which is the
 * dead zone the doctrine forbids.
 */
function layoutExample(type: LayoutType): RegistryExample {
  const definition = layoutDefinition(type);
  const fillers = FILLERS[type] ?? ['button', 'notification', 'button'];
  const count = Math.min(
    Math.max(definition.items.min, Math.min(fillers.length, 6)),
    definition.items.max
  );
  const children = Array.from({ length: count }, (_, index) => {
    const componentType = fillers[index % fillers.length]!;
    return `component ${type}Item${index + 1} {
  parent showcase
  type ${componentType}
  label "Item ${index + 1}"
}`;
  }).join('\n\n');
  const beat = 1.6;
  const duration = Number((beat * 3).toFixed(3));

  return {
    name: type,
    kind: 'layout',
    slug: slugify(type),
    duration,
    source: `${header(duration, `${type} — ${definition.description}`)}

beat compose {
  duration ${beat}s
  focus showcase
  route stagedReveals
  label "${definition.useCases[0] ?? 'Composition'}"
}

beat inspect {
  duration ${beat}s
  focus showcase
  zoom 1.12
  route cameraIntent
  label "Look closer"
}

beat settle {
  duration ${beat}s
  focus showcase
  zoom 1
  route cameraIntent
  label "Settle"
}

layout showcase {
  type ${type}
  columns ${definition.defaults.columns}
  gap ${definition.defaults.gap}
  beat compose
}

${children}

text caption {
  value "${definition.useCases[0] ?? type}"
  center
  layer text
  y 430
  size 30
  color #8B94A1
  beat compose
}
`,
  };
}

/**
 * Build the example for one showcase. With no bundled media the showcase renders
 * its own empty state, which is the honest demonstration: a device frame with a
 * prompt for real product media, not fabricated screen content.
 */
function showcaseExample(type: ShowcaseType): RegistryExample {
  const definition = showcaseDefinition(type);
  const beat = 1.5;
  const duration = Number((beat * 3).toFixed(3));
  return {
    name: type,
    kind: 'showcase',
    slug: slugify(type),
    duration,
    source: `${header(duration, `${type} — ${definition.description}`)}

beat reveal {
  duration ${beat}s
  focus subject
  route stagedReveals
  label "${definition.useCases[0] ?? 'Product reveal'}"
}

beat push {
  duration ${beat}s
  focus subject
  zoom 1.14
  route cameraIntent
  label "Push in"
}

beat settle {
  duration ${beat}s
  focus subject
  zoom 1
  route cameraIntent
  label "Settle"
}

showcase subject {
  type ${type}
  headline "Show the real product"
  caption "Import your asset and set media to replace this frame."
  beat reveal
  behavior ${definition.defaults.behavior}
}

text hint {
  value "${definition.useCases[0] ?? type}"
  center
  layer text
  y 470
  size 28
  color #8B94A1
  beat reveal
}
`,
  };
}

const COMPONENT_EXAMPLES = [
  'tilted-card',
  'magic-bento',
  'spotlight-card',
  'fluid-glass',
  'form',
  'button',
  'loader',
] as const satisfies readonly SemanticComponentType[];

/** Installable component recipes: replace the content slots, not the choreography. */
function componentExample(type: (typeof COMPONENT_EXAMPLES)[number]): RegistryExample {
  const duration = 4.8;
  const content =
    type === 'form'
      ? `  label "Welcome back"
  detail "Replace these content slots."
  labels "Email  Password"
  values "you@example.com  ••••••••"
  cta "Continue"`
      : type === 'button'
        ? `  label "Replace this action"`
        : type === 'loader'
          ? `  label "Rendering 82%"
  countTo 82`
          : `  label "FEATURE"
  headline "Replace this headline"
  detail "Keep the component, motion, and layout. Change only the content."
  cta "Explore →"`;

  return {
    name: type,
    kind: 'component',
    slug: slugify(type),
    duration,
    source: `${header(duration, `${type} — editable registry component recipe`)}

beat reveal {
  duration 1.6s
  focus subject
  route uiLife
  label "Reveal component"
}

beat inspect {
  duration 1.6s
  focus subject
  zoom 1.12
  route cameraIntent
  label "Inspect motion"
}

beat settle {
  duration 1.6s
  focus subject
  zoom 1
  route cameraIntent
  label "Settle"
}

component subject {
  type ${type}
  beat reveal
  role main
  motionPreset premium
${content}
}
`,
  };
}

/** Every generated registry example, in a stable order. */
export function registryExamples(): readonly RegistryExample[] {
  return [
    ...showcaseDefinitions().map((definition) => showcaseExample(definition.type)),
    ...layoutDefinitions().map((definition) => layoutExample(definition.type)),
    ...COMPONENT_EXAMPLES.map(componentExample),
  ];
}
