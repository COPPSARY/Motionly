import { parseTime } from '../core/units';
import type { ASTNode, AnimationNode, ElementNode, ProgramNode } from '../types/parser';
import type { SemanticComponent, SemanticRelationship } from '../types/scene';
import {
  buildComponentStructure,
  type ComponentStructure,
  type StructureContext,
} from './component-structures';
import {
  REACTBITS_COMPONENT_ALIASES,
  isSemanticComponentType,
  svgDataUri,
  vectorDefinition,
  type SemanticComponentType,
} from './vector-registry';
import {
  archetypeRegistry,
  effectRegistry,
  resolveTheme,
  componentRegistry,
  validateCatalogProperties,
  type MotionTheme,
} from './catalog';
import { lowerMotionSystem } from './motion-lowering';
import type { BeatPlan } from '../motion-system';

export interface SemanticCompilation {
  program: ProgramNode;
  components: SemanticComponent[];
  relationships: SemanticRelationship[];
  theme: MotionTheme;
  /** Storyboard beats, kept for the editor, inspector, and tests. */
  beats: BeatPlan[];
}

const COMPILER_PROPERTIES = new Set([
  'type',
  'provider',
  'role',
  'intent',
  'behavior',
  'connects',
  'relationship',
  'accent',
  'source',
  'color',
  'surface',
  'label',
  'detail',
  'headline',
  'url',
  'cta',
  'values',
  'labels',
  'countTo',
  'clickAt',
  'clicks',
  'reactsTo',
  'exitAt',
  'exitDuration',
  'delay',
  'duration',
  'fill',
  'stroke',
  'strokeWidth',
  'glow',
  'glowColor',
  'animation',
]);

interface ComponentTiming {
  delay: number;
  clickAt?: number;
}

export function compileSemanticProgram(program: ProgramNode): SemanticCompilation {
  const themeNode = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.kind === 'theme'
  );
  const theme = resolveTheme(themeNode?.properties);
  // Motion system first: beats set the pacing that layouts and showcases inherit,
  // and both lower to ordinary elements before archetypes and components run.
  const motionSystem = lowerMotionSystem(program, theme);
  const beats = motionSystem.beats;
  const loweredProgram = compileArchetypes(motionSystem.program, theme);
  const componentNodes = loweredProgram.body.filter(
    (node): node is ElementNode => node.type === 'Element' && node.kind === 'component'
  );
  if (!componentNodes.length) {
    return { program: loweredProgram, components: [], relationships: [], theme, beats };
  }

  const importNames = new Set(
    loweredProgram.body.filter((node) => node.type === 'Import').map((node) => node.name)
  );
  const allNames = new Set(
    loweredProgram.body.flatMap((node) => {
      if (node.type === 'Import') return [node.name];
      if (node.type === 'Element') return [node.name];
      return [];
    })
  );
  const componentByName = new Map(componentNodes.map((node) => [node.name, node]));
  const timings = resolveComponentTiming(componentNodes);
  const builtInAliases = new Map<string, string>();
  const generated: ASTNode[] = [];
  const components: SemanticComponent[] = [];
  const relationships: SemanticRelationship[] = [];

  for (const node of loweredProgram.body) {
    if (node.type !== 'Element' || node.kind !== 'component') {
      generated.push(node);
      continue;
    }

    const type = componentType(node);
    const definition = vectorDefinition(type);
    const canonicalType =
      REACTBITS_COMPONENT_ALIASES[type as keyof typeof REACTBITS_COMPONENT_ALIASES] ?? type;
    const catalogEntry = componentRegistry().find((entry) => entry.name === canonicalType)!;
    validateCatalogProperties(catalogEntry, node.properties, [
      'type',
      'provider',
      'connects',
      'relationship',
      'clickAt',
      'clicks',
      'reactsTo',
      'exitAt',
      'exitDuration',
      'layer',
      'fill',
      'stroke',
      'strokeWidth',
      'glow',
      'glowColor',
      'animation',
      'url',
      'detail',
      'headline',
      'cta',
      'opacity',
      'scale',
      'rotation',
      'skewX',
      'skewY',
      'center',
      'track',
      'start',
    ]);
    const requestedProvider = String(node.properties['provider'] ?? definition.provider);
    if (requestedProvider !== definition.provider && requestedProvider !== 'auto') {
      throw new Error(
        `Semantic component "${node.name}" type ${type} is provided by ${definition.provider}, not ${requestedProvider}.`
      );
    }

    const sourceAlias = String(node.properties['source'] ?? '');
    if (sourceAlias && !importNames.has(sourceAlias)) {
      throw new Error(
        `Semantic component "${node.name}" references missing imported source "${sourceAlias}".`
      );
    }
    const registryKey = `${definition.provider}:${definition.icon}`;
    let resolvedSource = sourceAlias;
    if (!resolvedSource) {
      const existingAlias = builtInAliases.get(registryKey);
      if (existingAlias) {
        resolvedSource = existingAlias;
      } else {
        resolvedSource = uniqueName(`__semantic_${type}`, allNames);
        builtInAliases.set(registryKey, resolvedSource);
        generated.push({
          type: 'Import',
          name: resolvedSource,
          path: svgDataUri(definition.svg),
        });
      }
    }

    const behaviors = behaviorList(node, definition.defaultBehavior);
    const timing = timings.get(node.name) ?? { delay: 0 };
    const duration = timeValue(node.properties['duration'], 0.9);
    const color = String(node.properties['color'] ?? theme.secondary);
    const accent = String(node.properties['accent'] ?? color);
    const role = semanticRole(node.properties['role']);
    const layer = String(node.properties['layer'] ?? layerForRole(role));
    const width = numberValue(node.properties['width'], definition.width);

    const context: StructureContext = {
      name: node.name,
      type,
      x: numberValue(node.properties['x'], 0),
      y: numberValue(node.properties['y'], 0),
      width,
      color,
      accent,
      surface: String(node.properties['surface'] ?? theme.surface),
      theme,
      delay: timing.delay,
      duration,
      role,
      layer,
      behaviors,
      iconAlias: resolvedSource,
      style: definition.style,
      strokeWidth: numberValue(
        node.properties['strokeWidth'],
        definition.style === 'outline' ? 2 : 0
      ),
      label: stringValue(node.properties['label']),
      detail: stringValue(node.properties['detail']),
      headline: stringValue(node.properties['headline']),
      url: stringValue(node.properties['url']),
      cta: stringValue(node.properties['cta']),
      values: listValue(node.properties['values']),
      labels: listValue(node.properties['labels']),
      countTo:
        node.properties['countTo'] !== undefined
          ? numberValue(node.properties['countTo'], 0)
          : undefined,
      variant: stringValue(node.properties['variant']),
      motionPreset: stringValue(node.properties['motionPreset']),
      clickAt: timing.clickAt,
      exitAt:
        node.properties['exitAt'] !== undefined
          ? timeValue(node.properties['exitAt'], 0)
          : undefined,
      exitDuration: timeValue(node.properties['exitDuration'], 0.5),
    };

    const structure = buildComponentStructure(context);
    applyAuthoredPaint(structure, node);
    applyPartOverrides(structure, node);

    generated.push({
      type: 'Element',
      kind: 'group',
      name: node.name,
      properties: componentRootProperties(node, type, definition.provider, role, behaviors, layer),
    });
    generated.push(...structure.children);
    generated.push(...structure.animations);
    generated.push(
      ...idleAnimations(node, behaviors, timing.delay + duration + 0.8, structure.glowTargetId)
    );
    generated.push(...clickChoreography(node, type, timing, componentByName, timings));

    components.push({
      id: node.name,
      type,
      provider: sourceAlias ? 'custom' : definition.provider,
      role,
      intent: String(node.properties['intent'] ?? 'support'),
      behaviors,
      rootElementId: node.name,
      childElementIds: structure.childIds,
      capabilities: [...definition.capabilities],
      source: sourceAlias || definition.source,
    });
  }

  for (const source of componentNodes) {
    const targets = String(source.properties['connects'] ?? '')
      .split(/[\s,]+/)
      .filter(Boolean);
    for (const targetName of targets) {
      if (targetName === source.name) {
        throw new Error(`Semantic component "${source.name}" cannot connect to itself.`);
      }
      const target = componentByName.get(targetName);
      if (!target) {
        throw new Error(
          `Semantic relationship from "${source.name}" references missing component "${targetName}".`
        );
      }
      const compiled = compileRelationship(source, target, allNames, timings, theme);
      generated.push(...compiled.nodes);
      relationships.push(compiled.relationship);
      components
        .find((component) => component.id === source.name)
        ?.childElementIds.push(...compiled.childIds);
    }
  }

  return {
    program: { ...loweredProgram, body: generated },
    components,
    relationships,
    theme,
    beats,
  };
}

function compileArchetypes(program: ProgramNode, theme: MotionTheme): ProgramNode {
  const imports = new Set(
    program.body.filter((node) => node.type === 'Import').map((node) => node.name)
  );
  const body: ASTNode[] = [];
  const canvas = program.body.find((node) => node.type === 'Canvas');

  for (const node of program.body) {
    if (node.type === 'Element' && node.kind === 'theme') continue;
    if (node.type !== 'Element' || node.kind !== 'archetype') {
      if (
        node === canvas &&
        node.type === 'Canvas' &&
        node.properties['background'] === undefined
      ) {
        body.push({ ...node, properties: { ...node.properties, background: theme.background } });
      } else {
        body.push(node);
      }
      continue;
    }
    body.push(...compileArchetype(node, imports, theme));
  }
  return { ...program, body };
}

function compileArchetype(node: ElementNode, imports: Set<string>, theme: MotionTheme): ASTNode[] {
  const type = String(node.properties['type'] ?? '');
  const definition = archetypeRegistry().find((entry) => entry.name === type);
  if (!definition) {
    throw new Error(
      `Archetype "${node.name}" has unsupported type "${type || 'missing'}". Available: ${archetypeRegistry()
        .map((entry) => entry.name)
        .join(', ')}.`
    );
  }
  validateCatalogProperties(definition, node.properties, ['type']);

  const start = timeValue(node.properties['start'], 0);
  const duration = timeValue(node.properties['duration'], Number(definition.defaults['duration']));
  const sceneId = node.name;
  const transitionIn = node.properties['transitionIn'];
  const transitionOut = node.properties['transitionOut'];
  const settlesWithScene = Boolean(transitionIn);
  const nodes: ASTNode[] = [
    {
      type: 'Element',
      kind: 'scene',
      name: sceneId,
      properties: {
        start: seconds(start),
        duration: seconds(duration),
        background: theme.background,
        layer: 'background',
        enter: transitionIn ? 0 : '350ms',
        exit: transitionOut ? 0 : '500ms',
        ...(transitionIn ? { transitionIn: String(transitionIn) } : {}),
        ...(transitionOut ? { transitionOut: String(transitionOut) } : {}),
      },
    },
  ];

  const effectGraph = String(node.properties['effects'] ?? definition.defaults['effects'] ?? '')
    .split(/\s*>\s*|\s*,\s*/)
    .filter(Boolean);
  const knownEffects = new Map(effectRegistry().map((entry) => [entry.name, entry]));
  for (const [index, effectName] of effectGraph.entries()) {
    const effect = knownEffects.get(effectName);
    if (!effect)
      throw new Error(`Archetype "${node.name}" references unknown effect "${effectName}".`);
    nodes.push({
      type: 'Element',
      kind: 'overlay',
      name: `${sceneId}__effect${index}`,
      properties: {
        parent: sceneId,
        layer: 'background',
        opacity: 0,
        blendMode: effect.defaults['blendMode'] ?? 'source-over',
        backgroundEffect: `${effectName}(duration ${seconds(duration)} opacity ${effect.defaults['opacity']} intensity ${effect.defaults['intensity']} gradientFrom ${theme.gradientFrom} gradientTo ${theme.gradientTo})`,
      },
    });
  }

  const title = String(node.properties['title'] ?? '');
  const subtitle = String(node.properties['subtitle'] ?? '');
  const label = String(node.properties['label'] ?? '');
  const value = String(node.properties['value'] ?? '');
  const cta = String(node.properties['cta'] ?? '');
  const media = assetSlot(node, 'media', imports);
  const secondary = assetSlot(node, 'secondary', imports);
  const logo = assetSlot(node, 'logo', imports);
  const addText = (
    suffix: string,
    text: string,
    properties: Record<string, unknown>,
    move = 'keynoteText',
    delay = 0.25
  ) => {
    if (!text) return;
    const plain = move === 'plain';
    const baseY = numberValue(properties['y'], 0);
    nodes.push({
      type: 'Element',
      kind: 'text',
      name: `${sceneId}__${suffix}`,
      properties: {
        parent: sceneId,
        center: true,
        layer: 'text',
        value: text,
        font: theme.displayFont,
        weight: theme.weightBold,
        color: theme.text,
        opacity: settlesWithScene ? 1 : plain ? 0 : 1,
        ...(!settlesWithScene && !plain
          ? {
              textAnimation: `${move}(split ${suffix === 'title' ? 'lines' : 'words'} stagger ${seconds(theme.stagger)} duration ${seconds(theme.duration)} delay ${seconds(delay)} ease ${theme.easing})`,
            }
          : {}),
        ...properties,
      },
    });
    if (plain && !settlesWithScene) {
      nodes.push({
        type: 'Animation',
        target: `${sceneId}__${suffix}`,
        from: { opacity: 0, y: baseY + 50, blur: 8 },
        to: { opacity: 1, y: baseY, blur: 0 },
        keyframes: [],
        delay: seconds(delay),
        duration: seconds(theme.duration),
        easing: theme.easing,
      });
    }
  };
  const addMedia = (
    suffix: string,
    alias: string | undefined,
    properties: Record<string, unknown>,
    delay: number
  ) => {
    if (alias) {
      nodes.push({
        type: 'Element',
        kind: 'image',
        name: `${sceneId}__${suffix}`,
        properties: {
          parent: sceneId,
          source: alias,
          center: true,
          layer: 'hero',
          opacity: settlesWithScene ? 1 : 0,
          focalX: numberValue(node.properties[`${suffix}.focalX`], 0.5),
          focalY: numberValue(node.properties[`${suffix}.focalY`], 0.5),
          ...(!settlesWithScene
            ? {
                animation: `maskReveal(delay ${seconds(delay)} duration ${seconds(theme.duration)} ease ${theme.easing})`,
              }
            : {}),
          ...properties,
        },
      });
      return;
    }
    nodes.push({
      type: 'Element',
      kind: 'component',
      name: `${sceneId}__${suffix}Frame`,
      properties: {
        parent: sceneId,
        type: suffix === 'logo' ? 'logo' : String(node.properties['frame'] ?? 'browser'),
        role: 'main',
        headline: 'Add product asset',
        cta: 'Choose media',
        width: properties['width'] ?? 900,
        x: properties['x'] ?? 0,
        y: properties['y'] ?? 80,
        accent: theme.accent,
        surface: theme.surface,
        delay: seconds(delay),
      },
    });
  };

  if (type === 'hero') {
    addText('title', title, { y: -330, width: 1380, size: theme.titleSize });
    addText(
      'subtitle',
      subtitle,
      {
        y: -235,
        width: 1050,
        size: theme.bodySize,
        weight: theme.weightRegular,
        color: theme.muted,
      },
      'fadeUp',
      0.48
    );
    addMedia('media', media, { y: 140, width: 1180, shadow: theme.shadow }, 0.72);
  } else if (type === 'splitFeature' || type === 'walkthrough') {
    addText(
      'label',
      label,
      {
        x: -400,
        y: -230,
        width: 720,
        size: theme.bodySize * 0.72,
        color: theme.accent,
        textAlign: 'left',
      },
      'fadeUp',
      0.18
    );
    addText(
      'title',
      title,
      { x: -400, y: -80, width: 720, size: theme.titleSize * 0.8, textAlign: 'left', wrap: 'word' },
      'plain'
    );
    addText(
      'subtitle',
      subtitle,
      {
        x: -400,
        y: 100,
        width: 720,
        size: theme.bodySize,
        weight: theme.weightRegular,
        color: theme.muted,
        textAlign: 'left',
        wrap: 'word',
      },
      'fadeUp',
      0.52
    );
    addMedia('media', media, { x: 440, y: 20, width: 840, shadow: theme.shadow }, 0.65);
  } else if (type === 'stat') {
    addText('label', label, { y: -180, size: theme.bodySize, color: theme.accent }, 'fadeUp', 0.18);
    addText(
      'value',
      value,
      { y: 0, size: theme.titleSize * 2, weight: theme.weightBold },
      'scaleText',
      0.32
    );
    addText(
      'subtitle',
      subtitle,
      { y: 180, width: 980, size: theme.bodySize, weight: theme.weightRegular, color: theme.muted },
      'fadeUp',
      0.58
    );
  } else if (type === 'comparison') {
    addText('title', title, { y: -360, width: 1300, size: theme.titleSize * 0.72 });
    addMedia('media', media, { x: -440, y: 70, width: 760, shadow: theme.shadow }, 0.55);
    addMedia('secondary', secondary, { x: 440, y: 70, width: 760, shadow: theme.shadow }, 0.69);
    addText(
      'beforeLabel',
      label || 'Before',
      { x: -440, y: 365, size: theme.bodySize * 0.8, color: theme.muted },
      'fadeUp',
      0.8
    );
    addText(
      'afterLabel',
      String(node.properties['secondaryLabel'] ?? 'After'),
      { x: 440, y: 365, size: theme.bodySize * 0.8, color: theme.accent },
      'fadeUp',
      0.87
    );
  } else if (type === 'cta') {
    if (logo) addMedia('logo', logo, { y: -230, width: 150 }, 0.2);
    addText('title', title, { y: -40, width: 1380, size: theme.titleSize }, 'keynoteText', 0.42);
    addText(
      'subtitle',
      subtitle,
      { y: 80, width: 1000, size: theme.bodySize, weight: theme.weightRegular, color: theme.muted },
      'fadeUp',
      0.48
    );
    addText('cta', cta, { y: 240, size: theme.bodySize, color: theme.ink }, 'scaleText', 0.75);
    nodes.push({
      type: 'Element',
      kind: 'overlay',
      name: `${sceneId}__ctaSurface`,
      properties: {
        parent: sceneId,
        center: true,
        layer: 'content',
        y: 240,
        width: 520,
        height: 76,
        radius: theme.radius * 1.5,
        gradientFrom: theme.gradientFrom,
        gradientTo: theme.gradientTo,
        shadow: theme.shadow,
        opacity: settlesWithScene ? 1 : 0,
        ...(!settlesWithScene
          ? { animation: `buttonPop(delay 650ms duration 500ms ease ${theme.easing})` }
          : {}),
      },
    });
  } else if (type === 'logoReveal') {
    addMedia('logo', logo, { y: -40, width: 260 }, 0.28);
    addText('title', title, { y: 220, width: 1200, size: theme.titleSize * 0.72 }, 'fadeUp', 0.7);
  }

  return nodes;
}

function assetSlot(node: ElementNode, key: string, imports: Set<string>): string | undefined {
  const alias = String(node.properties[key] ?? '');
  if (!alias) return undefined;
  if (!imports.has(alias)) {
    throw new Error(
      `Archetype "${node.name}" references missing imported ${key} asset "${alias}".`
    );
  }
  return alias;
}

function componentType(node: ElementNode): SemanticComponentType {
  const type = String(node.properties['type'] ?? '').toLowerCase();
  if (!isSemanticComponentType(type)) {
    throw new Error(
      `Semantic component "${node.name}" has unsupported type "${type || 'missing'}".`
    );
  }
  return type;
}

/**
 * Resolve per-component start times, including cause-and-effect chains:
 * a cursor that `clicks` a control resolves its click moment, and a
 * component that `reactsTo` another enters just after that cause fires.
 */
function resolveComponentTiming(nodes: ElementNode[]): Map<string, ComponentTiming> {
  const timings = new Map<string, ComponentTiming>();
  for (const node of nodes) {
    const delay = timeValue(node.properties['delay'], 0);
    let clickAt =
      node.properties['clickAt'] !== undefined
        ? timeValue(node.properties['clickAt'], delay + 1.2)
        : undefined;
    if (clickAt === undefined && String(node.properties['clicks'] ?? '')) {
      clickAt = delay + 1.2;
    }
    timings.set(node.name, { delay, ...(clickAt !== undefined ? { clickAt } : {}) });
  }
  // A cursor clicking a control also stamps the click moment on the control,
  // so components reacting to the control fire after the actual click.
  for (const node of nodes) {
    const clicked = String(node.properties['clicks'] ?? '');
    const clickAt = timings.get(node.name)?.clickAt;
    if (!clicked || clickAt === undefined) continue;
    const target = timings.get(clicked);
    if (target && target.clickAt === undefined) target.clickAt = clickAt;
  }
  for (const node of nodes) {
    const reactsTo = String(node.properties['reactsTo'] ?? '');
    if (!reactsTo) continue;
    const causeNode = nodes.find((candidate) => candidate.name === reactsTo);
    const cause = timings.get(reactsTo);
    if (!causeNode || !cause) {
      throw new Error(
        `Semantic component "${node.name}" reactsTo missing component "${reactsTo}".`
      );
    }
    if (node.properties['delay'] === undefined) {
      const timing = timings.get(node.name)!;
      timing.delay = (cause.clickAt ?? cause.delay + 0.9) + 0.25;
    }
  }
  return timings;
}

function componentRootProperties(
  node: ElementNode,
  type: SemanticComponentType,
  provider: string,
  role: SemanticComponent['role'],
  behaviors: string[],
  layer: string
): Record<string, unknown> {
  const definition = vectorDefinition(type);
  const width = numberValue(node.properties['width'], definition.width);
  const properties = Object.fromEntries(
    Object.entries(node.properties).filter(
      ([key]) => !COMPILER_PROPERTIES.has(key) && !key.includes('.')
    )
  );
  return {
    ...properties,
    center: node.properties['center'] ?? true,
    width,
    height: Math.round((width * definition.height) / definition.width),
    opacity: node.properties['opacity'] ?? 1,
    layer,
    ...(node.properties['animation'] ? { animation: node.properties['animation'] } : {}),
    semanticType: type,
    semanticProvider: provider,
    semanticRole: role,
    semanticIntent: String(node.properties['intent'] ?? 'support'),
    semanticBehavior: behaviors.join(' '),
  };
}

/** Forward authored paint overrides to the rendered glyph child, if one exists. */
function applyAuthoredPaint(structure: ComponentStructure, node: ElementNode): void {
  const glyph = structure.children.find((child) => child.name === `${node.name}__glyph`);
  if (!glyph) return;
  for (const key of ['fill', 'stroke', 'strokeWidth', 'glow', 'glowColor'] as const) {
    if (node.properties[key] !== undefined) glyph.properties[key] = node.properties[key];
  }
}

/**
 * Dotted part overrides: `PART.PROPERTY VALUE` on a component customizes one
 * base property of one generated part (`price.countPrefix "€"`,
 * `headline.color #fff`) — full control from plain .motion source, without
 * touching the library. Unknown parts fail loudly with the available names.
 */
function applyPartOverrides(structure: ComponentStructure, node: ElementNode): void {
  for (const [key, value] of Object.entries(node.properties)) {
    const dot = key.indexOf('.');
    if (dot <= 0 || dot === key.length - 1) continue;
    const suffix = key.slice(0, dot);
    const property = key.slice(dot + 1);
    const child = structure.children.find(
      (candidate) => candidate.name === `${node.name}__${suffix}`
    );
    if (!child) {
      const available = structure.children
        .map((candidate) => candidate.name.slice(node.name.length + 2))
        .join(', ');
      throw new Error(
        `Component "${node.name}" has no part "${suffix}" for override "${key}". Available parts: ${available}.`
      );
    }
    child.properties[property] = value;
  }
}

function idleAnimations(
  node: ElementNode,
  behaviors: string[],
  start: number,
  glowTargetId: string
): AnimationNode[] {
  const x = numberValue(node.properties['x'], 0);
  const y = numberValue(node.properties['y'], 0);
  const scale = numberValue(node.properties['scale'], 1);
  const animations: AnimationNode[] = [];

  if (behaviors.includes('float') || behaviors.includes('premiumReveal')) {
    animations.push({
      type: 'Animation',
      target: node.name,
      from: {},
      to: {},
      keyframes: [
        { offset: 0, properties: { x, y, rotation: 0 } },
        { offset: 0.5, properties: { x: x + 4, y: y - 12, rotation: 0.8 } },
        { offset: 1, properties: { x, y, rotation: 0 } },
      ],
      delay: start,
      duration: 4.8,
      easing: 'sine.inOut',
      repeat: 'infinite',
      repeatType: 'loop',
    });
  }

  if (behaviors.includes('pulse')) {
    animations.push({
      type: 'Animation',
      target: node.name,
      from: { scale },
      to: { scale: scale * 1.035 },
      keyframes: [],
      delay: start + 0.2,
      duration: 1.8,
      easing: 'sine.inOut',
      repeat: 'infinite',
      repeatType: 'yoyo',
    });
  }

  if (behaviors.includes('activate') || behaviors.includes('glow')) {
    animations.push({
      type: 'Animation',
      target: glowTargetId,
      from: { glow: 10 },
      to: { glow: 26 },
      keyframes: [],
      delay: start + 0.1,
      duration: 1.4,
      easing: 'sine.inOut',
      repeat: 'infinite',
      repeatType: 'yoyo',
    });
  }

  return animations;
}

/**
 * A cursor with `clicks TARGET` travels to the control and fires a click:
 * the cursor compresses (handled in its structure), the target dips in
 * scale, and any component reacting to the target enters right after.
 */
function clickChoreography(
  node: ElementNode,
  type: SemanticComponentType,
  timing: ComponentTiming,
  componentByName: Map<string, ElementNode>,
  timings: Map<string, ComponentTiming>
): AnimationNode[] {
  if (type !== 'cursor') return [];
  const targetName = String(node.properties['clicks'] ?? '');
  if (!targetName) return [];
  const target = componentByName.get(targetName);
  if (!target) {
    throw new Error(`Semantic component "${node.name}" clicks missing component "${targetName}".`);
  }
  const clickAt = timing.clickAt ?? timing.delay + 1.2;
  const targetWidth = numberValue(
    target.properties['width'],
    vectorDefinition(componentType(target)).width
  );
  const landX = numberValue(target.properties['x'], 0) + targetWidth * 0.16;
  const landY = numberValue(target.properties['y'], 0) + targetWidth * 0.1;
  const startX = numberValue(node.properties['x'], landX + 260);
  const startY = numberValue(node.properties['y'], landY + 190);

  const animations: AnimationNode[] = [
    {
      type: 'Animation',
      target: node.name,
      from: { x: startX, y: startY },
      to: { x: landX, y: landY },
      keyframes: [],
      delay: Math.max(0, clickAt - 0.85),
      duration: 0.8,
      easing: 'power2.inOut',
    },
  ];

  // Buttons with a known click moment compress themselves (with glow and
  // ripple) inside their structure; everything else gets a generic dip here.
  const selfCompressing =
    componentType(target) === 'button' && timings.get(targetName)?.clickAt !== undefined;
  if (!selfCompressing) {
    animations.push({
      type: 'Animation',
      target: targetName,
      from: {},
      to: {},
      keyframes: [
        { offset: 0, properties: { scale: 1 } },
        { offset: 0.4, properties: { scale: 0.94 } },
        { offset: 0.75, properties: { scale: 1.02 } },
        { offset: 1, properties: { scale: 1 } },
      ],
      delay: clickAt,
      duration: 0.36,
      easing: 'power2.inOut',
    });
  }

  return animations;
}

function compileRelationship(
  source: ElementNode,
  target: ElementNode,
  names: Set<string>,
  timings: Map<string, ComponentTiming>,
  theme: MotionTheme
): {
  nodes: ASTNode[];
  childIds: string[];
  relationship: SemanticRelationship;
} {
  const connectionId = uniqueName(`${source.name}__to__${target.name}`, names);
  const particleId = uniqueName(`${connectionId}__particle`, names);
  const sourcePoint = componentPoint(source);
  const targetPoint = componentPoint(target);
  const endpoints = insetEndpoints(sourcePoint, targetPoint);
  const color = String(source.properties['accent'] ?? source.properties['color'] ?? theme.accent);
  const delay = Math.max(
    timings.get(source.name)?.delay ?? 0,
    timings.get(target.name)?.delay ?? 0
  );
  const relationshipType = String(source.properties['relationship'] ?? 'dataFlow');

  const connection: ElementNode = {
    type: 'Element',
    kind: 'overlay',
    name: connectionId,
    properties: {
      shape: 'arrow',
      x: endpoints.start.x,
      y: endpoints.start.y,
      x2: endpoints.end.x - endpoints.start.x,
      y2: endpoints.end.y - endpoints.start.y,
      fill: 'none',
      stroke: color,
      strokeWidth: 4,
      opacity: 0.72,
      glow: 12,
      glowColor: color,
      layer: 'supporting',
      animation: `animated-arrow-point(delay ${seconds(delay + 0.35)} duration 800ms ease power3.out)`,
      relationshipFrom: source.name,
      relationshipTo: target.name,
      relationshipType,
      relationshipSourceRadius: sourcePoint.radius,
      relationshipTargetRadius: targetPoint.radius,
    },
  };
  const particle: ElementNode = {
    type: 'Element',
    kind: 'overlay',
    name: particleId,
    properties: {
      shape: 'circle',
      x: endpoints.start.x,
      y: endpoints.start.y,
      radius: 7,
      fill: color,
      stroke: 'none',
      opacity: 0,
      glow: 20,
      glowColor: color,
      layer: 'details',
      relationshipFrom: source.name,
      relationshipTo: target.name,
      relationshipType,
      relationshipProgress: 0,
      relationshipSourceRadius: sourcePoint.radius,
      relationshipTargetRadius: targetPoint.radius,
    },
  };
  const particleAnimation: AnimationNode = {
    type: 'Animation',
    target: particleId,
    from: {},
    to: {},
    keyframes: [
      { offset: 0, properties: { relationshipProgress: 0, opacity: 0 } },
      { offset: 0.12, properties: { relationshipProgress: 0.12, opacity: 1 } },
      { offset: 0.82, properties: { relationshipProgress: 0.82, opacity: 1 } },
      { offset: 1, properties: { relationshipProgress: 1, opacity: 0 } },
    ],
    delay: delay + 1.05,
    duration: 2.2,
    easing: 'power3.out',
    repeat: 'infinite',
    repeatType: 'loop',
  };

  return {
    nodes: [connection, particle, particleAnimation],
    childIds: [connectionId, particleId],
    relationship: {
      id: connectionId,
      from: source.name,
      to: target.name,
      type: relationshipType,
      connectorElementId: connectionId,
      particleElementIds: [particleId],
    },
  };
}

function componentPoint(node: ElementNode): { x: number; y: number; radius: number } {
  const definition = vectorDefinition(componentType(node));
  return {
    x: numberValue(node.properties['x'], 0),
    y: numberValue(node.properties['y'], 0),
    radius: numberValue(node.properties['width'], definition.width) * 0.34,
  };
}

function insetEndpoints(
  source: { x: number; y: number; radius: number },
  target: { x: number; y: number; radius: number }
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    start: { x: source.x + ux * source.radius, y: source.y + uy * source.radius },
    end: { x: target.x - ux * target.radius, y: target.y - uy * target.radius },
  };
}

function behaviorList(node: ElementNode, fallback: string): string[] {
  return String(node.properties['behavior'] ?? fallback)
    .split(/[\s,]+/)
    .filter(Boolean);
}

function semanticRole(value: unknown): SemanticComponent['role'] {
  const role = String(value ?? 'supporting');
  if (role === 'main' || role === 'supporting' || role === 'connection' || role === 'background') {
    return role;
  }
  return 'supporting';
}

function layerForRole(role: SemanticComponent['role']): string {
  if (role === 'main') return 'hero';
  if (role === 'background') return 'background';
  if (role === 'connection') return 'supporting';
  return 'content';
}

function uniqueName(base: string, names: Set<string>): string {
  let candidate = base;
  let index = 2;
  while (names.has(candidate)) candidate = `${base}_${index++}`;
  names.add(candidate);
  return candidate;
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number.parseFloat(String(value ?? fallback));
  return Number.isFinite(number) ? number : fallback;
}

function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value);
  return text.length ? text : undefined;
}

function listValue(value: unknown): string[] | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  // Two-plus spaces are the primary separator so items may contain commas
  // ("4,812"). Commas only split when no double-space separator is present.
  const separator = /\s{2,}/.test(text) ? /\s{2,}/ : /,/;
  const items = text.split(separator).map((item) => item.trim());
  const filtered = items.filter(Boolean);
  return filtered.length ? filtered : text.split(/\s+/).filter(Boolean);
}

function timeValue(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return parseTime(value as string | number);
  } catch {
    return fallback;
  }
}

function seconds(value: number): string {
  return `${Number(value.toFixed(3))}s`;
}
