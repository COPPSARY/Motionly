import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';

/**
 * The serializer owns its own fixture. It used to borrow whichever preset shipped,
 * which made an unrelated preset edit look like a serializer regression.
 */
const source = `canvas {
  size 1920x1080
  fps 60
  duration 6s
  background #05060a
}

scene main {
  label "Main"
  duration 6s
}

text fade {
  scene main
  value "Placeholder"
  center
  size 64
  color #ffffff
  opacity 0
}

animate fade {
  keyframes {
    0% {
      opacity 0
      y 40
    }
    35% {
      opacity 0.4
      ease power2.out
    }
    70% {
      opacity 0.9
    }
    100% {
      opacity 1
      y 0
    }
  }
  delay 1.5s
  duration 1.2s
  easing power3.out
}
`;

describe('motion serializer', () => {
  it('preserves keyframes and editable text through a round trip', () => {
    const ast = parseMotion(source);
    const title = ast.body.find((node) => node.type === 'Element' && node.name === 'fade');
    if (!title || title.type !== 'Element') throw new Error('fade element missing');
    title.properties['value'] = 'Create "fast"\nwithout friction.';

    const reparsed = parseMotion(serializeProgram(ast));
    const scene = buildSceneGraph(reparsed);
    const fade = reparsed.body.find((node) => node.type === 'Animation' && node.target === 'fade');
    const reparsedTitle = reparsed.body.find(
      (node) => node.type === 'Element' && node.name === 'fade'
    );

    expect(fade?.type === 'Animation' ? fade.keyframes : []).toHaveLength(4);
    expect(reparsedTitle?.type === 'Element' ? reparsedTitle.properties['value'] : '').toBe(
      'Create "fast"\nwithout friction.'
    );
    // Quotes and newlines survive escaping, and the keyframe easing rides along.
    expect(fade?.type === 'Animation' ? fade.keyframes?.[1]?.easing : '').toBe('power2.out');
    // Before its delay the element is still at its authored opacity.
    expect(
      evaluateScene(scene, 1).elements.find((element) => element.id === 'fade')?.render.opacity
    ).toBe(0);
  });

  it('is stable: serializing twice changes nothing', () => {
    const once = serializeProgram(parseMotion(source));
    expect(serializeProgram(parseMotion(once))).toBe(once);
  });

  it('keeps storyboard membership and scene blocks intact', () => {
    const text = serializeProgram(parseMotion(source));
    expect(text).toMatch(/scene main \{/);
    expect(text).toMatch(/scene main\n/);
    expect(buildSceneGraph(parseMotion(text)).storyboard!.map((plan) => plan.name)).toEqual([
      'main',
    ]);
  });
});
