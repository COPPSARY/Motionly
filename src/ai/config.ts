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

export const MOTIONLY_PROMPT_TEMPLATE = `Read AGENTS.md, .agents/skills/write-motionly/SKILL.md, and .agents/skills/write-motionly/references/motion-syntax.md before editing.

Create or update an editable Motionly project.

Project:
- Output file: [path/to/project.motion]
- Audience and goal: [who it is for and what it should communicate]
- Format: [aspect ratio or canvas size]
- Duration and FPS: [exact duration and frame rate]

Story:
[Describe the sequence of shots and the single focal subject in each shot.]

Assets:
- Folder: [path/to/assets]
- Required assets: [files that must appear]
- Optional assets: [files the agent may use]

Script and timing:
[Paste narration, exact on-screen copy, timestamps, or an audio path. Mark text that must remain verbatim.]

Brand direction:
[Colors, typography, visual style, motion style, and anything to avoid.]

Requirements:
- Inspect the existing project and every relevant asset before editing.
- Probe media duration and dimensions; do not guess or stretch assets.
- Storyboard shot purpose, time range, focal subject, entrance, hold, and exit before writing source.
- Use only syntax and presets supported by Motionly's current parser and renderer.
- Keep visual tracks as predictable layers; keep audio on the bottom audio track.
- Preserve supplied copy exactly when requested and synchronize it to supplied timestamps.
- Use restrained professional motion, deliberate exits, and one strong transition per real scene change.
- Avoid accidental overlap, clipped text, stale layers, repeated fade-only scenes, and constant camera drift.
- Keep all output editable in Motionly; do not replace the project with a black-box rendered video.
- Run inspect:motion, review reported empty ranges, inspect representative frames, and verify parse/serialize/parse stability.

Return the completed .motion file and briefly report validation performed.`;

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
