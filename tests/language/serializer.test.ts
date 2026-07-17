import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';

describe('motion serializer', () => {
  it('preserves keyframes and editable text through a round trip', () => {
    const ast = parseMotion(readFileSync('preset/motionly/motionly.motion', 'utf8'));
    const title = ast.body.find((node) => node.type === 'Element' && node.name === 'hook');
    if (!title || title.type !== 'Element') throw new Error('hook element missing');
    title.properties['value'] = 'Create "fast"\nwithout friction.';

    const serialized = serializeProgram(ast);
    const reparsed = parseMotion(serialized);
    const scene = buildSceneGraph(reparsed);
    const fade = reparsed.body.find((node) => node.type === 'Animation' && node.target === 'fade');
    const reparsedTitle = reparsed.body.find(
      (node) => node.type === 'Element' && node.name === 'hook'
    );

    expect(fade?.type === 'Animation' ? fade.keyframes : []).toHaveLength(4);
    expect(reparsedTitle?.type === 'Element' ? reparsedTitle.properties['value'] : '').toBe(
      'Create "fast"\nwithout friction.'
    );
    expect(scene.animations.length).toBeGreaterThan(15);
    expect(
      evaluateScene(scene, 1).elements.find((element) => element.id === 'fade')?.render.opacity
    ).toBe(0);
  });
});
