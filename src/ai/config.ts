import type { Asset } from '../types/scene';

/**
 * AI Config is the browser-persisted "AI knowledge" layer that sits beside the
 * asset system. It manages a brand profile (BRAND.md) and which skills are
 * enabled. Enabled skills carry the authoring rules that used to live in a
 * per-project AGENTS.md, so the assistant is guided by skills instead.
 *
 * Storage mirrors the existing BYOK pattern: everything lives in localStorage,
 * never on a Motionly server.
 */

export const AI_BRAND_KEY = 'motionly.ai.brand.v1';
export const AI_SKILLS_KEY = 'motionly.ai.skills.v1';

export const MOTIONLY_PROMPT_TEMPLATE = `Create or refine a polished, fully editable Motionly animation from this creative brief.

Audience and goal:
[Who should see this, what should they understand, and what should they do next?]

Story:
[Describe the message or progression. A rough beginning, middle, and end is enough.]

Assets (optional):
[List required logos, screenshots, video, animated SVG/GIF, Lottie, photos, or illustrations. Say which existing animation must be preserved.]

Narration or script:
[Paste narration, exact on-screen copy, or useful timestamps. Mark any wording that must remain verbatim.]

Brand direction:
[Colors, typography, visual references, motion character, and anything to avoid.]

Important requirements:
[Anything that must appear, must not change, or must be avoided.]

Infer sensible format, duration, pacing, timeline organization, and technical settings from the brief and available media. Prefer native editable SVG artwork and Motionly animation for logos, icons, diagrams, and illustrations unless an existing asset's animation must be preserved.`;

/** Structured brand identity edited visually and serialized to BRAND.md. */
export interface BrandProfile {
  name: string;
  logo: string;
  colors: string[];
  typography: string;
  visualStyle: string[];
  motionStyle: string[];
  avoid: string[];
  /** Optional advanced override; when set it replaces generated markdown. */
  markdownOverride?: string;
}

/** A skill the assistant can be told to follow. */
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  /** Actionable guidance loaded into the assistant context when enabled. */
  instructions: string;
  /** Repository file that backs this skill, when one exists. */
  path?: string;
  reference?: string;
}

export type SkillState = Record<string, boolean>;

export interface AiContextInput {
  brand: BrandProfile | null;
  skillState: SkillState;
  assets: Asset[];
  project?: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    elementCount: number;
  } | null;
}

export interface AiContextSummary {
  brandLoaded: boolean;
  enabledSkillCount: number;
  assetCount: number;
  lines: string[];
}

/**
 * Built-in skills. `write-motionly` mirrors the real `.agents/skills` entry;
 * the others carry the product rules and motion-design knowledge that used to
 * be duplicated in a per-project AGENTS.md. Enabling a skill loads its
 * instructions into the assistant context.
 */
export const AVAILABLE_SKILLS: SkillInfo[] = [
  {
    id: 'write-motionly',
    name: 'write-motionly',
    description:
      'Author, retime, review, and repair Motionly .motion projects: storyboard shots, choose transitions and presets, sync visuals to narration, and validate composition.',
    instructions: `Inspect the request, current project, brand constraints, script, audio, and every relevant asset before editing. Probe media duration and dimensions instead of guessing.
Storyboard distinct shots first. For each shot define purpose, time range, focal subject, supporting elements, entrance, readable hold, exit, and transition.
Write the smallest valid .motion project that realizes the storyboard. Use predictable visual layers, keep audio on the bottom audio track, preserve aspect ratios, and keep supplied copy verbatim when requested.
Synchronize entrances and exits to supplied narration timestamps. Prefer power3.out, restrained 650ms–1s entrances, deliberate exits, and one strong transition for a real scene change.
Prefer native SVG and overlay primitives for logos, icons, diagrams, and vector illustrations. Animate the object itself with x, y, scale, rotation, skew, opacity, blur, fill, stroke, masks, and drawSVG rather than moving the global camera.
Preserve requested MP4, WebM, MOV, GIF, animated SVG, and Lottie motion; never silently flatten animated media to a still.
Do not invent syntax, presets, block types, or renderer features. Generated output must remain editable through Motionly's parser and visual controls.
Run inspect:motion with the expected duration, review every empty-frame range, inspect representative scene/transition frames, and confirm parse/serialize/parse preserves timing, tracks, masks, and keyframes.`,
    path: '.agents/skills/write-motionly/SKILL.md',
    reference: '.agents/skills/write-motionly/references/motion-syntax.md',
  },
  {
    id: 'motion-graphics',
    name: 'motion-graphics',
    description:
      'Motion design principles for polished, professional animation: composition, timing, easing, and restrained transitions.',
    instructions: `Build each scene around one clear focal subject; keep supporting elements subordinate and spatially separated.
Default to power3.out easing and entrances around 650ms–1s. Prefer subtle motion over flashy effects.
Use staggered word reveals for important copy only, not every label.
Mark story progression with scene/background changes and purposeful movement — avoid constant camera drift and repeated fade-only scenes.
Give every element a deliberate exit; do not leave unrelated layers stacked indefinitely.
Vary shot composition (full-frame type, editorial left/right, centered hero) rather than randomizing motion.`,
  },
  {
    id: 'svg-motion',
    name: 'svg-motion',
    description:
      'Native editable SVG and vector animation for logos, icons, diagrams, illustrations, and UI graphics.',
    instructions: `Prefer creating editable SVG or Motionly overlay primitives over importing a pre-rendered animation unless the user asks to preserve an existing animation.
Use drawSVG for simple stroked paths; combine fill/stroke color animation, masks, opacity, blur, scale, rotation, skew, and local x/y movement for richer reveals.
For push-ins, pull-backs, and pans, animate the SVG element's own x, y, scale, rotation, and originX/originY. Do not move the global camera when only the artwork should move.
Keep detailed artwork readable, preserve its aspect ratio, and stagger related vector layers as one intentional group.`,
  },
  {
    id: 'animated-assets',
    name: 'animated-assets',
    description:
      'Correct import, timing, and export behavior for video, GIF, animated SVG, and Lottie assets.',
    instructions: `Treat MP4, WebM, MOV, GIF, animated SVG, and Lottie as animated media, never as static substitutes.
Use timeline clips to set start, duration, trimIn, and trimOut. Keep transformations editable on the asset layer.
Browser codec support controls MOV/video decoding. Animated SVG uses real-time Canvas playback and cannot be deterministically seeked; CSS keyframes may differ from browser DOM playback, so state that limitation when it applies.
If an asset fails to decode, report the actual format/browser limitation instead of implying its animation rendered.`,
  },
  {
    id: 'motionly-rules',
    name: 'motionly-rules',
    description:
      'Core Motionly product rules and .motion syntax: keep projects simple, visual, and valid. (Replaces per-project AGENTS.md.)',
    instructions: `Motionly is a visual motion graphics editor around .motion; .motion is the saved source format, not something users hand-write for normal work.
Use only supported syntax and presets. Prefer properties: x, y, scale, rotation, opacity, blur, size, color, center, duration, delay, easing.
Use size (not fontSize) and easing (not ease) in explicit animate blocks. Valid layers: background, hero, supporting, content, details, text, effects.
Import assets as: import "path" as alias, and render them with alias { ... }. Never invent block types like image/asset/video/scene/group/rect/layer.
Preserve imported asset aspect ratios (set width OR height). Avoid node graphs, plugin systems, and speculative complexity.`,
  },
];

export function emptyBrandProfile(): BrandProfile {
  return {
    name: '',
    logo: '',
    colors: [],
    typography: '',
    visualStyle: [],
    motionStyle: [],
    avoid: [],
  };
}

function section(title: string, values: string[]): string {
  const items = values.map((value) => value.trim()).filter(Boolean);
  if (!items.length) return '';
  return `${title}:\n${items.join('\n')}\n`;
}

/** Serialize a brand profile into BRAND.md markdown. */
export function generateBrandMarkdown(profile: BrandProfile): string {
  if (profile.markdownOverride && profile.markdownOverride.trim()) {
    return profile.markdownOverride.trim() + '\n';
  }
  const blocks: string[] = ['# Brand Profile', ''];
  const name = profile.name.trim();
  if (name) blocks.push(`Brand:\n${name}\n`);
  if (profile.logo.trim()) blocks.push(`Logo:\n${profile.logo.trim()}\n`);
  const colors = section('Colors', profile.colors);
  if (colors) blocks.push(colors);
  if (profile.typography.trim()) blocks.push(`Typography:\n${profile.typography.trim()}\n`);
  const style = section('Style', profile.visualStyle);
  if (style) blocks.push(style);
  const motion = section('Motion', profile.motionStyle);
  if (motion) blocks.push(motion);
  const avoid = section('Avoid', profile.avoid);
  if (avoid) blocks.push(avoid);
  return (
    blocks
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

/** True when the brand profile carries any usable identity. */
export function brandHasContent(profile: BrandProfile | null): boolean {
  if (!profile) return false;
  if (profile.markdownOverride && profile.markdownOverride.trim()) return true;
  return Boolean(
    profile.name.trim() ||
    profile.logo.trim() ||
    profile.typography.trim() ||
    profile.colors.length ||
    profile.visualStyle.length ||
    profile.motionStyle.length ||
    profile.avoid.length
  );
}

/** By default every known skill is enabled. */
export function defaultSkillState(): SkillState {
  return Object.fromEntries(AVAILABLE_SKILLS.map((skill) => [skill.id, true]));
}

/** Merge stored state with the registry so new skills default to enabled. */
export function resolveSkillState(stored: SkillState | null): SkillState {
  const base = defaultSkillState();
  if (!stored) return base;
  for (const skill of AVAILABLE_SKILLS) {
    const value = stored[skill.id];
    if (typeof value === 'boolean') base[skill.id] = value;
  }
  return base;
}

/** Resolve enabled skills against the known registry. */
export function enabledSkills(state: SkillState): SkillInfo[] {
  const resolved = resolveSkillState(state);
  return AVAILABLE_SKILLS.filter((skill) => resolved[skill.id]);
}

/**
 * Assemble the extra system-context block passed to the assistant so generated
 * `.motion` respects brand identity and the enabled skills' instructions.
 */
export function buildAiKnowledge(input: AiContextInput): string {
  const parts: string[] = [];
  if (brandHasContent(input.brand)) {
    parts.push(
      `Brand profile (BRAND.md):\n${generateBrandMarkdown(input.brand as BrandProfile).trim()}`
    );
  }
  for (const skill of enabledSkills(input.skillState)) {
    parts.push(`Skill: ${skill.name}\n${skill.description}\n${skill.instructions.trim()}`);
  }
  if (!parts.length) return '';
  return `Additional project knowledge. Honor this brand identity and these enabled skills when generating .motion:\n\n${parts.join(
    '\n\n'
  )}`;
}

/** Summarize what the assistant currently knows, for the Context preview. */
export function describeAiContext(input: AiContextInput): AiContextSummary {
  const brandLoaded = brandHasContent(input.brand);
  const enabledSkillCount = enabledSkills(input.skillState).length;
  const assetCount = input.assets.length;
  const lines = [
    `${enabledSkillCount > 0 ? '✓' : '✗'} ${enabledSkillCount} skill${enabledSkillCount === 1 ? '' : 's'} enabled`,
    `${brandLoaded ? '✓' : '✗'} Brand profile ${brandLoaded ? 'loaded' : 'not set'}`,
    `${assetCount > 0 ? '✓' : '✗'} ${assetCount} asset${assetCount === 1 ? '' : 's'} available`,
  ];
  if (input.project) {
    lines.push(
      `✓ Project ${input.project.width}x${input.project.height} · ${input.project.fps}fps · ${input.project.duration.toFixed(
        2
      )}s · ${input.project.elementCount} element${input.project.elementCount === 1 ? '' : 's'}`
    );
  }
  return { brandLoaded, enabledSkillCount, assetCount, lines };
}

/* ---------------------------------------------------------------------------
 * localStorage helpers (thin, browser-only wrappers around the pure logic).
 * ------------------------------------------------------------------------- */

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable; keep working in-memory */
  }
}

export function loadBrand(): BrandProfile | null {
  const raw = safeGet(AI_BRAND_KEY);
  if (!raw) return null;
  try {
    return { ...emptyBrandProfile(), ...(JSON.parse(raw) as BrandProfile) };
  } catch {
    return null;
  }
}

export function saveBrand(profile: BrandProfile): void {
  safeSet(AI_BRAND_KEY, JSON.stringify(profile));
}

export function loadSkillState(): SkillState {
  const raw = safeGet(AI_SKILLS_KEY);
  if (!raw) return defaultSkillState();
  try {
    return resolveSkillState(JSON.parse(raw) as SkillState);
  } catch {
    return defaultSkillState();
  }
}

export function saveSkillState(state: SkillState): void {
  safeSet(AI_SKILLS_KEY, JSON.stringify(state));
}
