import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_SKILLS,
  MOTIONLY_PROMPT_TEMPLATE,
  brandHasContent,
  buildAiKnowledge,
  defaultSkillState,
  describeAiContext,
  emptyBrandProfile,
  enabledSkills,
  generateBrandMarkdown,
  resolveSkillState,
  type BrandProfile,
} from '../../src/ai/config';

const sampleBrand: BrandProfile = {
  name: 'Motionly',
  logo: 'mark',
  colors: ['#4F8CFF'],
  typography: 'Inter',
  visualStyle: ['Minimal', 'Premium', 'Modern'],
  motionStyle: ['Smooth', 'Cinematic'],
  avoid: ['Overly flashy effects'],
};

describe('AI config brand markdown', () => {
  it('generates BRAND.md from structured fields in the documented shape', () => {
    const markdown = generateBrandMarkdown(sampleBrand);
    expect(markdown).toContain('# Brand Profile');
    expect(markdown).toContain('Brand:\nMotionly');
    expect(markdown).toContain('Colors:\n#4F8CFF');
    expect(markdown).toContain('Style:\nMinimal\nPremium\nModern');
    expect(markdown).toContain('Motion:\nSmooth\nCinematic');
    expect(markdown).toContain('Avoid:\nOverly flashy effects');
    expect(markdown).toContain('Logo:\nmark');
    expect(markdown).toContain('Typography:\nInter');
  });

  it('omits empty sections and honors a markdown override', () => {
    const sparse = generateBrandMarkdown({ ...emptyBrandProfile(), name: 'Acme' });
    expect(sparse).toContain('Brand:\nAcme');
    expect(sparse).not.toContain('Colors:');
    expect(sparse).not.toContain('Style:');

    const override = generateBrandMarkdown({
      ...sampleBrand,
      markdownOverride: '# Custom\n\nHand written',
    });
    expect(override.trim()).toBe('# Custom\n\nHand written');
  });

  it('detects whether a brand carries usable content', () => {
    expect(brandHasContent(null)).toBe(false);
    expect(brandHasContent(emptyBrandProfile())).toBe(false);
    expect(brandHasContent(sampleBrand)).toBe(true);
    expect(brandHasContent({ ...emptyBrandProfile(), markdownOverride: '# X' })).toBe(true);
  });
});

describe('AI config skills', () => {
  it('provides the complete copyable authoring prompt template', () => {
    expect(MOTIONLY_PROMPT_TEMPLATE).toContain('Audience and goal');
    expect(MOTIONLY_PROMPT_TEMPLATE).toContain('Story:');
    expect(MOTIONLY_PROMPT_TEMPLATE).toContain('native editable SVG');
    expect(MOTIONLY_PROMPT_TEMPLATE).not.toContain('Output file');
    expect(MOTIONLY_PROMPT_TEMPLATE).not.toContain('Assets:\n- Folder');
    expect(MOTIONLY_PROMPT_TEMPLATE).not.toContain('Duration and FPS');
  });

  it('ships multiple built-in skills, all enabled by default', () => {
    expect(AVAILABLE_SKILLS.length).toBeGreaterThanOrEqual(5);
    const ids = AVAILABLE_SKILLS.map((skill) => skill.id);
    expect(ids).toContain('write-motionly');
    expect(ids).toContain('motion-graphics');
    expect(ids).toContain('svg-motion');
    expect(ids).toContain('animated-assets');
    expect(ids).toContain('motionly-rules');
    const state = defaultSkillState();
    expect(enabledSkills(state)).toHaveLength(AVAILABLE_SKILLS.length);
  });

  it('every skill carries actionable instructions', () => {
    for (const skill of AVAILABLE_SKILLS) {
      expect(skill.instructions.trim().length).toBeGreaterThan(20);
    }
  });

  it('merges stored state so unknown/new skills default to enabled', () => {
    const resolved = resolveSkillState({ 'write-motionly': false });
    expect(resolved['write-motionly']).toBe(false);
    expect(resolved['motion-graphics']).toBe(true);
    expect(enabledSkills(resolved).map((skill) => skill.id)).not.toContain('write-motionly');
    expect(resolveSkillState(null)['write-motionly']).toBe(true);
  });
});

describe('AI config knowledge and context', () => {
  it('assembles a knowledge block from brand and enabled skill instructions', () => {
    const knowledge = buildAiKnowledge({
      brand: sampleBrand,
      skillState: defaultSkillState(),
      assets: [],
    });
    expect(knowledge).toContain('Brand profile (BRAND.md):');
    expect(knowledge).toContain('Skill: write-motionly');
    expect(knowledge).toContain('Skill: motion-graphics');
    expect(knowledge).toContain('power3.out');
  });

  it('returns an empty knowledge block when nothing is configured', () => {
    const disabled = Object.fromEntries(AVAILABLE_SKILLS.map((skill) => [skill.id, false]));
    expect(
      buildAiKnowledge({
        brand: null,
        skillState: disabled,
        assets: [],
      })
    ).toBe('');
  });

  it('summarizes context with check/cross markers', () => {
    const summary = describeAiContext({
      brand: sampleBrand,
      skillState: defaultSkillState(),
      assets: [
        { name: 'a', path: '/a.png', type: 'image' },
        { name: 'b', path: '/b.svg', type: 'svg' },
      ],
      project: { width: 1920, height: 1080, fps: 60, duration: 8, elementCount: 3 },
    });
    expect(summary.brandLoaded).toBe(true);
    expect(summary.enabledSkillCount).toBe(AVAILABLE_SKILLS.length);
    expect(summary.assetCount).toBe(2);
    expect(summary.lines[0]).toContain(`${AVAILABLE_SKILLS.length} skills enabled`);
    expect(summary.lines).toContainEqual('✓ 2 assets available');
    expect(summary.lines.some((line) => line.includes('1920x1080'))).toBe(true);
  });

  it('marks missing knowledge with a cross', () => {
    const disabled = Object.fromEntries(AVAILABLE_SKILLS.map((skill) => [skill.id, false]));
    const summary = describeAiContext({
      brand: null,
      skillState: disabled,
      assets: [],
      project: null,
    });
    expect(summary.lines[0]).toContain('✗ 0 skills enabled');
    expect(summary.lines[1]).toContain('✗ Brand profile not set');
  });
});
