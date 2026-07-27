import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { decomposeSvg } from '../../src/assets/svg-decomposition';
import { parseSvg } from '../../src/assets/asset-loader';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('scene and group hierarchy', () => {
  it('composes parent transforms and local timing', () => {
    const source = `canvas {
  duration 4s
}
scene shot {
  start 1s
  duration 2s
}
group phone {
  parent shot
  x 100
  scale 2
}
overlay card {
  parent phone
  shape rect
  x 20
  opacity .5
}`;
    const scene = buildSceneGraph(parseMotion(source));
    expect(evaluateScene(scene, 0.5).elements.some((element) => element.id === 'card')).toBe(false);
    const card = evaluateScene(scene, 1.5).elements.find((element) => element.id === 'card');
    expect(card?.render.x).toBe(140);
    expect(card?.render.scale).toBe(2);
    expect(card?.render.opacity).toBe(0.5);
    expect(serializeProgram(parseMotion(serializeProgram(parseMotion(source))))).toBe(
      serializeProgram(parseMotion(source))
    );
  });

  it('bridges a shared element between scenes', () => {
    const scene = buildSceneGraph(
      parseMotion(`canvas { duration 3s }
overlay first { x -100 opacity 1 }
overlay second { x 100 opacity 1 }
transition bridge {
  from first
  to second
  at 1.5s
  duration 1s
  easing linear
}`)
    );
    const frame = evaluateScene(scene, 1.5);
    expect(frame.elements.find((element) => element.id === 'first')?.render.x).toBe(0);
    // The destination fades in with the morph instead of popping at the end.
    expect(frame.elements.find((element) => element.id === 'second')?.render.opacity).toBeCloseTo(
      0.5
    );
    const start = evaluateScene(scene, 1.05);
    expect(
      Number(start.elements.find((element) => element.id === 'second')?.render.opacity)
    ).toBeLessThan(0.1);
    const end = evaluateScene(scene, 1.95);
    expect(
      Number(end.elements.find((element) => element.id === 'second')?.render.opacity)
    ).toBeGreaterThan(0.9);
  });
});

describe('editable SVG decomposition', () => {
  it('preserves named Figma-style groups and path IDs', () => {
    const svg = parseSvg(`<svg viewBox="0 0 24 24">
      <g id="logo" data-name="Logo">
        <path id="cloud-outline" data-name="Cloud outline" d="M0 0L24 0L24 24Z" fill="#d97757"/>
      </g>
    </svg>`);
    const program = parseMotion('canvas { duration 2s }');
    const nodes = decomposeSvg(program, 'mark', svg);
    expect(nodes.map((node) => node.kind)).toEqual(['group', 'group', 'path']);
    expect(nodes[1]?.properties['label']).toBe('Logo');
    expect(nodes[2]?.properties['sourceId']).toBe('cloud-outline');
    expect(nodes[2]?.properties['parent']).toBe(nodes[1]?.name);
  });

  it('keeps unsupported SVG subtrees as locked accurate leaves', () => {
    const svg = parseSvg(`<svg viewBox="0 0 100 100">
      <path id="editable" d="M0 0L10 10"/>
      <foreignObject id="rich" width="50" height="20"><div xmlns="http://www.w3.org/1999/xhtml">Hi</div></foreignObject>
    </svg>`);
    const program = parseMotion('canvas { duration 2s }');
    const nodes = decomposeSvg(program, 'mixed', svg);
    const locked = nodes.find((node) => node.kind === 'svgpart');
    expect(nodes.some((node) => node.kind === 'path')).toBe(true);
    expect(locked?.properties['locked']).toBe(true);
    expect(
      program.body.some(
        (node) => node.type === 'Import' && node.name === locked?.properties['source']
      )
    ).toBe(true);
  });
});
