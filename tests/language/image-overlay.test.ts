import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

const source = `
canvas { size 1280x720 duration 3s }
import "./photo.jpg" as photo

image product {
  source photo
  center
  width 960
  layer content
}

overlay highlight {
  parent product
  shape circle
  x 420
  y 260
  radius 72
  fill none
  stroke #7cf7c5
  strokeWidth 8
  opacity 1
  animation highlight-circle-reveal(delay 500ms duration 1s ease linear)
}
`;

describe('image overlay syntax', () => {
  it('round-trips image parents and SVG-compatible overlay properties', () => {
    const serialized = serializeProgram(parseMotion(source));
    const scene = buildSceneGraph(parseMotion(serialized));
    const image = scene.elements.find((element) => element.id === 'product');
    const overlay = scene.elements.find((element) => element.id === 'highlight');

    expect(image?.kind).toBe('image');
    expect(image?.assetName).toBe('photo');
    expect(overlay?.kind).toBe('overlay');
    expect(overlay?.properties.parent).toBe('product');
    expect(overlay?.properties.shape).toBe('circle');
    expect(overlay?.properties.layer).toBe('details');
    expect(overlay?.properties.radius).toBe(72);
  });

  it('uses the normal evaluator for overlay preset timing', () => {
    const scene = buildSceneGraph(parseMotion(source));
    const before = evaluateScene(scene, 0.5).elements.find((element) => element.id === 'highlight');
    const after = evaluateScene(scene, 1.5).elements.find((element) => element.id === 'highlight');

    expect(before?.render.pathProgress).toBe(0);
    expect(after?.render.pathProgress).toBe(1);
  });

  it.each([
    ['animated-arrow-point', 'pathProgress'],
    ['callout-text-pop', 'scale'],
    ['spotlight-mask', 'revealProgress'],
  ])('compiles the %s starter preset', (preset, property) => {
    const scene = buildSceneGraph(parseMotion(source.replace('highlight-circle-reveal', preset)));
    const animation = scene.animations.find((item) => item.target === 'highlight');
    expect(animation).toBeDefined();
    expect(property in (animation?.to ?? {})).toBe(true);
  });
});
