import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';

describe('Motionly product showcase', () => {
  it('parses into a renderable scene graph', () => {
    const source = readFileSync('preset/motionly/motionly.motion', 'utf8');
    const ast = parseMotion(source);
    const scene = buildSceneGraph(ast);
    const displayedText = ast.body
      .filter((node) => node.type === 'Element' && node.kind === 'text')
      .map((node) => {
        if (node.type !== 'Element') return '';
        const value = String(node.properties['value']);
        if (node.name === 'codexLabel') return `${value},`;
        if (node.name === 'claudeLabel') return `${value}, and`;
        return value;
      })
      .join(' ');

    expect(scene.canvas.duration).toBe(32.1);
    expect(scene.imports.length).toBe(10);
    expect(scene.elements.some((element) => element.id === 'motionlyLogo')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'editorWindow')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'claudeCode')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'codex')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'antigravity')).toBe(true);
    expect(source).not.toContain('SAYANA');
    expect(displayedText).toContain('What if motion graphics could be written like code?');
    expect(displayedText).toContain('Motion graphics, written.');
    expect(scene.animations.length).toBeGreaterThan(15);

    const agentPreview = evaluateScene(scene, 12.2);
    expect(agentPreview.elements.find((element) => element.id === 'codex')?.render.opacity).toBe(1);
    expect(
      agentPreview.elements.find((element) => element.id === 'claudeCode')?.render.opacity
    ).toBe(1);
    expect(
      agentPreview.elements.find((element) => element.id === 'antigravity')?.render.opacity
    ).toBe(1);

    const pipelinePreview = evaluateScene(scene, 27);
    expect(
      pipelinePreview.elements.find((element) => element.id === 'rendererPanel')?.render.opacity
    ).toBe(1);
  });
});
