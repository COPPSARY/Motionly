import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { compileSemanticProgram } from '../../src/semantic/compiler';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';
import { lowerStoryboard, usesStoryboard } from '../../src/semantic/storyboard-lowering';
import type { ElementNode } from '../../src/types/parser';

const storyboardSource = `
canvas {
  size 1920x1080
  fps 60
  duration 12s
  background #020308
}

scene intro {
  label "Intro"
  duration 4s
  background #05060a
}

scene demo {
  label "Demo"
  duration 5s
  zoom 1.2
}

text brandmark {
  scene intro
  identity brand
  value "Motionly"
  center
  size 96
  color #ffffff
}

text tagline {
  scene intro
  value "Effortless animation"
  size 32
  color #9aa3b2
}

text brandSmall {
  scene demo
  identity brand
  value "Motionly"
  size 32
  color #ffffff
}

text panel {
  scene demo
  value "Dashboard"
  size 48
  color #ffffff
}
`;

function element(source: string, id: string) {
  const scene = buildSceneGraph(parseMotion(source));
  return scene.elements.find((entry) => entry.id === id);
}

describe('storyboard detection', () => {
  it('engages for a project that declares scene membership', () => {
    expect(usesStoryboard(parseMotion(storyboardSource))).toBe(true);
  });

  it('leaves a legacy flat project completely alone', () => {
    const legacy = `
canvas { size 1920x1080 duration 5s }

scene shot1 {
  start 0s
  duration 5s
  background #000000
}

text title {
  parent shot1
  value "Hello"
}
`;
    const program = parseMotion(legacy);
    expect(usesStoryboard(program)).toBe(false);
    const lowered = lowerStoryboard(program);
    expect(lowered.storyboard).toEqual([]);
    expect(lowered.program).toBe(program);
  });
});

describe('storyboard lowering', () => {
  const compilation = compileSemanticProgram(parseMotion(storyboardSource));

  it('resolves scenes into an ordered storyboard with absolute timing', () => {
    expect(compilation.storyboard.map((plan) => plan.name)).toEqual(['intro', 'demo']);
    expect(compilation.storyboard.map((plan) => plan.start)).toEqual([0, 4]);
    expect(compilation.storyboard.map((plan) => plan.duration)).toEqual([4, 5]);
    expect(compilation.storyboard[0]!.label).toBe('Intro');
  });

  it('links neighbours so a boundary can be planned from both sides', () => {
    expect(compilation.storyboard[0]!.next).toBe('demo');
    expect(compilation.storyboard[1]!.previous).toBe('intro');
  });

  it('records scene membership', () => {
    expect(compilation.storyboard[0]!.members.map((member) => member.id)).toEqual([
      'brandmark',
      'tagline',
    ]);
    expect(compilation.storyboard[1]!.members.map((member) => member.id)).toEqual([
      'brandSmall',
      'panel',
    ]);
  });

  it('detects the shared component from its persistent identity', () => {
    const participation = compilation.storyboard[1]!.transition!.participation;
    expect(participation.shared).toEqual([
      { identity: 'brand', from: 'brandmark', to: 'brandSmall' },
    ]);
    expect(participation.exit).toEqual(['tagline']);
    expect(participation.enter).toEqual(['panel']);
    expect(compilation.storyboard[1]!.transition!.kind).toBe('sharedElement');
  });

  it('parents every member to its scene and strips the storyboard sugar', () => {
    const nodes = compilation.program.body.filter(
      (node): node is ElementNode => node.type === 'Element'
    );
    const brandmark = nodes.find((node) => node.name === 'brandmark')!;
    expect(brandmark.properties['parent']).toBe('intro');
    expect(brandmark.properties['scene']).toBeUndefined();
    expect(brandmark.properties['identity']).toBeUndefined();
  });

  it('gives each scene root its time origin and camera, but never a cage', () => {
    const nodes = compilation.program.body.filter(
      (node): node is ElementNode => node.type === 'Element' && node.kind === 'scene'
    );
    const demo = nodes.find((node) => node.name === 'demo')!;
    expect(demo.properties['start']).toBe('4s');
    expect(demo.properties['cameraZoom']).toBe(1.2);
    // No duration on the element: a scene sets the time origin, it does not clear
    // the composition at its edge.
    expect(demo.properties['duration']).toBeUndefined();
  });

  it('caps a scene only when the author explicitly asks to clear it', () => {
    const cleared = compileSemanticProgram(
      parseMotion(`
canvas { duration 8s }
scene a { duration 4s label "A" clear }
scene b { duration 4s }
text t { scene a value "x" }
`)
    );
    const a = cleared.program.body.find(
      (node): node is ElementNode => node.type === 'Element' && node.name === 'a'
    )!;
    expect(a.properties['duration']).toBe('4s');
    expect(a.properties['clear']).toBeUndefined();
  });

  it('emits a shared-element handoff at the boundary', () => {
    const handoff = compilation.program.body.find(
      (node) => node.type === 'Element' && node.kind === 'transition'
    );
    if (!handoff || handoff.type !== 'Element') throw new Error('expected a transition');
    expect(handoff.properties['from']).toBe('brandmark');
    expect(handoff.properties['to']).toBe('brandSmall');
    expect(handoff.properties['at']).toBe('4s');
  });

  it('rejects membership in a scene that does not exist', () => {
    expect(() =>
      compileSemanticProgram(
        parseMotion(`
canvas { duration 5s }
scene intro { label "Intro" duration 5s }
text a { scene ghost value "x" }
`)
      )
    ).toThrow(/references missing scene "ghost"/);
  });

  it('rejects a fade at a scene boundary', () => {
    expect(() =>
      compileSemanticProgram(
        parseMotion(`
canvas { duration 8s }
scene a { duration 4s label "A" }
scene b { duration 4s transition crossfade }
text t { scene a value "x" }
`)
      )
    ).toThrow(/never fade/);
  });
});

describe('storyboard reaches the scene graph', () => {
  const scene = buildSceneGraph(parseMotion(storyboardSource));

  it('exposes the storyboard for the editor and inspector', () => {
    expect(scene.storyboard!.map((plan) => plan.name)).toEqual(['intro', 'demo']);
  });

  it('keeps scene roots as ordinary scene elements the renderer already draws', () => {
    const roots = scene.elements.filter((element) => element.kind === 'scene');
    expect(roots.map((element) => element.id)).toEqual(['intro', 'demo']);
    expect(roots[0]!.properties.start).toBe(0);
    expect(roots[1]!.properties.start).toBe(4);
  });

  it('extends a canvas that is shorter than its storyboard', () => {
    const short = buildSceneGraph(
      parseMotion(`
canvas { duration 3s }
scene a { duration 4s label "A" }
scene b { duration 4s }
text t { scene a value "x" }
`)
    );
    expect(short.canvas.duration).toBe(8);
  });

  it('shows a member from its scene onward, and animates out the ones that leave', () => {
    const early = evaluateScene(scene, 1);
    expect(early.elements.map((element) => element.id)).toContain('brandmark');
    // A member of a later scene has not started yet.
    expect(early.elements.map((element) => element.id)).not.toContain('panel');

    const later = evaluateScene(scene, 6);
    expect(later.elements.map((element) => element.id)).toContain('panel');
    // Scene membership is organizational by default, so members stay visible
    // after their source scene unless a scene declares `clear`.
    const tagline = later.elements.find((element) => element.id === 'tagline');
    expect(Number(tagline!.render.opacity)).toBeGreaterThan(0.9);
    // The shared brandmark is never cleared at the boundary.
    expect(later.elements.map((element) => element.id)).toContain('brandmark');
  });

  it('retires the rendered fragments of shared animated text', () => {
    const animated = buildSceneGraph(
      parseMotion(`
canvas { duration 6s }
scene a { duration 3s label "A" }
scene b { duration 3s }
text first {
  scene a
  identity headline
  value "First headline"
  animation "keynoteText(duration 600ms)"
}
text second {
  scene b
  identity headline
  value "Second headline"
  animation "keynoteText(duration 600ms)"
}
`)
    );
    const afterHandoff = evaluateScene(animated, 4);
    const firstWords = afterHandoff.elements.filter(
      (entry) => entry.properties.textGroup === 'first'
    );
    expect(firstWords.length).toBeGreaterThan(0);
    expect(firstWords.every((entry) => Number(entry.render.opacity) === 0)).toBe(true);
  });

  it('clears a scene at its edge only when asked', () => {
    const caged = buildSceneGraph(
      parseMotion(`
canvas { duration 8s }
scene a { duration 4s label "A" clear }
scene b { duration 4s }
text held { scene a value "x" center size 40 color #ffffff }
`)
    );
    expect(evaluateScene(caged, 1).elements.map((e) => e.id)).toContain('held');
    expect(evaluateScene(caged, 5).elements.map((e) => e.id)).not.toContain('held');
  });

  it('times a member relative to its own scene, not the global timeline', () => {
    const source = `
canvas { duration 10s }
scene a { duration 5s label "A" }
scene b { duration 5s }
text late { scene b value "x" center size 40 color #ffffff }
animate late {
  from { opacity 0 }
  to { opacity 1 }
  delay 0s
  duration 0.5s
}
`;
    const graph = buildSceneGraph(parseMotion(source));
    // The animation is authored at scene-local 0s, which is global 5s.
    const atSceneStart = evaluateScene(graph, 5.0001);
    const late = atSceneStart.elements.find((entry) => entry.id === 'late');
    expect(late).toBeDefined();
    expect(Number(late!.render.opacity)).toBeLessThan(0.2);
    const settled = evaluateScene(graph, 6);
    expect(Number(settled.elements.find((entry) => entry.id === 'late')!.render.opacity)).toBe(1);
  });

  it('keeps the legacy flat project shape untouched', () => {
    const legacy = buildSceneGraph(
      parseMotion(`
canvas { duration 5s }
text title { value "Hello" center size 72 color #ffffff }
`)
    );
    expect(legacy.storyboard).toEqual([]);
    expect(element('canvas { duration 5s }\ntext t { value "x" }', 't')).toBeDefined();
  });
});
