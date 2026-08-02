import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';
import { auditScene, auditStoryboard } from '../../src/inspection/motion-audit';
import { PRESET_CATALOG } from '../../src/presets/catalog';

const source = readFileSync('preset/motionly/motionly.motion', 'utf8');
const program = parseMotion(source);
const scene = buildSceneGraph(program);

function text(id: string): string {
  const node = program.body.find(
    (candidate) => candidate.type === 'Element' && candidate.name === id
  );
  return node && node.type === 'Element' ? String(node.properties['value'] ?? '') : '';
}

/**
 * Visible opacity of an element or, for text driven by a preset, of its fragments.
 * A text preset hides the source element and animates `NAME__words_*` /
 * `NAME__chars_*`, so asking about the source alone always reads zero.
 */
function opacity(time: number, id: string): number {
  const elements = evaluateScene(scene, time).elements;
  const own = elements.find((element) => element.id === id);
  if (own && Number(own.render.opacity) > 0) return Number(own.render.opacity);
  const fragments = elements.filter((element) => element.id.startsWith(`${id}__`));
  if (!fragments.length) return own ? Number(own.render.opacity) : 0;
  return Math.max(...fragments.map((element) => Number(element.render.opacity)));
}

describe('Motionly product film', () => {
  it('is organized as a storyboard, not one long timeline', () => {
    expect(scene.storyboard!.map((plan) => plan.name)).toEqual([
      'direction',
      'agents',
      'product',
      'delivery',
      'finish',
    ]);
    expect(scene.canvas.duration).toBe(26.9);
  });

  it('runs its scenes back to back with no absolute time authored', () => {
    const plans = scene.storyboard!;
    for (const [index, plan] of plans.entries()) {
      const previous = plans[index - 1];
      if (previous) expect(plan.start, plan.name).toBeCloseTo(previous.end, 3);
    }
    expect(plans.at(-1)!.end).toBeCloseTo(26.9, 3);
    const sceneNodes = program.body.filter(
      (candidate) => candidate.type === 'Element' && candidate.kind === 'scene'
    );
    expect(
      sceneNodes.every((node) => node.type === 'Element' && node.properties.start === undefined)
    ).toBe(true);
  });

  it('uses authored storyboard transitions and only clears where requested', () => {
    expect(
      Object.fromEntries(
        scene.storyboard!.slice(1).map((plan) => [plan.name, plan.transition!.kind])
      )
    ).toEqual({
      agents: 'continuous',
      product: 'continuous',
      delivery: 'cut',
      finish: 'continuous',
    });
    for (const plan of scene.storyboard!.slice(1)) {
      expect(plan.transition!.participation.shared, plan.name).toEqual([]);
    }
    const sceneNodes = program.body.filter(
      (candidate) => candidate.type === 'Element' && candidate.kind === 'scene'
    );
    expect(
      sceneNodes
        .filter((node) => node.type === 'Element' && node.properties.clear === true)
        .map((node) => (node.type === 'Element' ? node.name : ''))
    ).toEqual(['product']);
    expect(source).not.toMatch(/identity\s+message/);
  });

  it('uses clean cuts while visible subjects perform the transition', () => {
    expect(source).not.toMatch(/transition\s+(crossfade|fade)/);
    expect(source).not.toMatch(/transition(In|Out)/);
    expect(source).not.toContain('tiltReveal');
    expect(source).not.toContain('maskReveal');
    for (const plan of scene.storyboard!) {
      expect(['sharedElement', 'cameraMove', 'continuous', 'cut']).toContain(
        plan.transition?.kind ?? 'sharedElement'
      );
    }
  });

  it('keeps its product assets and uses direct media surfaces', () => {
    for (const id of [
      'motionlyLogo',
      'codexLogo',
      'claudeLogo',
      'antigravityLogo',
      'motionlyUI',
      'exportCapture',
      'bgDark',
      'bgTeal',
      'bgAurora',
    ]) {
      expect(
        scene.imports.some((asset) => asset.name === id),
        id
      ).toBe(true);
    }
    expect(source).toContain('splitMaskWipe');
    expect(source).not.toMatch(/^audio\s/m);
    expect(source).not.toMatch(/\bblur\s/);
  });

  it('opens on editorial type and closes on the brand call to action', () => {
    expect(text('openingLead')).toBe('Create editable motion with AI.');
    expect(text('openingAnswer')).toBe('Then refine every detail');
    expect(text('agentsLine')).toBe('Bring any');
    expect(text('codexLabel')).toBe('Codex');
    expect(text('claudeLabel')).toBe('Claude Code');
    expect(text('antigravityLabel')).toBe('Antigravity');
    expect(text('finalLine')).toBe('AI-native motion graphics editor.');
    expect(opacity(0.9, 'openingLead')).toBeGreaterThan(0.9);
    expect(opacity(4.8, 'codexAgent')).toBeGreaterThan(0.9);
    expect(opacity(4.8, 'claudeAgent')).toBeGreaterThan(0.9);
    expect(opacity(4.8, 'antigravityAgent')).toBeGreaterThan(0.9);
    expect(
      program.body.some((node) => node.type === 'Element' && node.name === 'promptTerminal')
    ).toBe(false);
    expect(opacity(25.2, 'finalLine')).toBeGreaterThan(0.9);
  });

  it('surfaces storyboard continuity warnings from the current preset', () => {
    expect(auditStoryboard(scene).map((finding) => [finding.kind, finding.target])).toEqual([
      ['scene-discontinuity', 'agents'],
      ['scene-discontinuity', 'product'],
      ['scene-discontinuity', 'finish'],
    ]);
    const audit = auditScene(scene);
    expect(audit.findings.map((finding) => [finding.kind, finding.target])).toEqual([
      ['scene-discontinuity', 'agents'],
      ['scene-discontinuity', 'product'],
      ['scene-discontinuity', 'finish'],
    ]);
  });

  it('keeps every scene performing instead of entering and then waiting', () => {
    // The dead-zone check is the one that catches a film that reads as slides.
    expect(auditScene(scene).counts['dead-zone']).toBeUndefined();
  });

  it('round-trips through the serializer unchanged', () => {
    const once = serializeProgram(program);
    expect(serializeProgram(parseMotion(once))).toBe(once);
  });

  it('matches the catalog entry that ships it', () => {
    const entry = PRESET_CATALOG.find((candidate) => candidate.name === 'motionly')!;
    expect(entry.duration).toBe(scene.canvas.duration);
    expect(entry.width).toBe(scene.canvas.width);
    expect(entry.height).toBe(scene.canvas.height);
    expect(entry.tags).toContain('scenes');
  });

  it('is the only preset in the catalog', () => {
    expect(PRESET_CATALOG.map((entry) => entry.name)).toEqual(['motionly']);
  });
});
