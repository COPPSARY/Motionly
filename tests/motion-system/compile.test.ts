import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { compileSemanticProgram } from '../../src/semantic/compiler';
import type { Scene } from '../../src/types/scene';

const project = (body: string) => `canvas {
  size 1920x1080
  fps 60
  duration 24s
}

camera {
  zoom 1
}

theme {
  accent #7CF7C5
}

${body}`;

const build = (body: string): Scene => buildSceneGraph(parseMotion(project(body)));

/**
 * Earliest entrance for a block, counting the animations on its generated parts.
 * Components and showcases choreograph their parts, not their root.
 */
const entranceOf = (scene: Scene, id: string): number =>
  Math.min(
    ...scene.animations
      .filter((animation) => animation.target === id || animation.target.startsWith(`${id}__`))
      .map((animation) => animation.delay)
  );

const STORYBOARD = `import "/assets/dashboard-ui.png" as dashShot

beat intro {
  duration 5s
  focus title
  label "Brand introduction"
}

beat reveal {
  duration 7s
  focus product
  zoom 1.25
  label "Product reveal"
}

beat features {
  duration 8s
  focus capabilities
  zoom 1
  transition layoutMorph
  from product
  to capabilities
  label "Feature showcase"
}

showcase product {
  type dashboardShowcase
  media dashShot
  headline "Ship faster"
  beat reveal
}

layout capabilities {
  type bentoGrid
  columns 3
  gap 40
  beat features
}

component planCard {
  parent capabilities
  type pricingcard
}

component alert {
  parent capabilities
  type notification
  label "Deployed"
}

component usage {
  parent capabilities
  type chart
}

text title {
  value "Motionly"
  center
  layer text
  size 96
  beat intro
}`;

describe('motion system lowering', () => {
  it('leaves projects without motion-system blocks untouched', () => {
    const source = project(`text hello {
  value "Hi"
  center
}`);
    const ast = parseMotion(source);
    const compiled = compileSemanticProgram(ast);
    expect(compiled.beats).toEqual([]);
    expect(serializeProgram(compiled.program)).toContain('text hello');
  });

  it('lowers every new block kind away before the scene graph sees it', () => {
    const scene = build(STORYBOARD);
    for (const element of scene.elements) {
      expect(['layout', 'showcase', 'beat'], element.id).not.toContain(element.kind);
    }
    expect(scene.elements.some((element) => element.kind === 'scene')).toBe(false);
  });

  it('keeps the layout and showcase roots as ordinary groups', () => {
    const scene = build(STORYBOARD);
    const layout = scene.elements.find((element) => element.id === 'capabilities')!;
    const showcase = scene.elements.find((element) => element.id === 'product')!;
    expect(layout.kind).toBe('group');
    expect(showcase.kind).toBe('group');
  });

  it('resolves layout children into a rhythmic composition', () => {
    const scene = build(STORYBOARD);
    const cards = ['planCard', 'alert', 'usage'].map((id) =>
      scene.elements.find((element) => element.id === id)!
    );
    for (const card of cards) {
      expect(card.properties.parent).toBe('capabilities');
      expect(Math.abs(Number(card.properties.x) % 8)).toBe(0);
      expect(Math.abs(Number(card.properties.y) % 8)).toBe(0);
      expect(Number(card.properties.width)).toBeGreaterThan(0);
    }
    const positions = new Set(cards.map((card) => `${card.properties.x}:${card.properties.y}`));
    expect(positions.size).toBe(3);
  });

  it('fits fixed-aspect components inside their slot instead of stretching them', () => {
    const scene = build(STORYBOARD);
    const card = scene.elements.find((element) => element.id === 'planCard')!;
    const layoutSlotWidth = 1600 / 3;
    expect(Number(card.properties.width)).toBeLessThan(layoutSlotWidth * 2);
  });

  it('respects an authored coordinate over the layout solver', () => {
    const scene = build(`layout grid {
  type featureGrid
  columns 3
}

component one {
  parent grid
  type button
  x 640
}

component two {
  parent grid
  type button
}

component three {
  parent grid
  type button
}`);
    expect(Number(scene.elements.find((element) => element.id === 'one')!.properties.x)).toBe(640);
  });

  it('paces attached content from its beat start', () => {
    const scene = build(STORYBOARD);
    const titleEntrance = scene.animations.find((animation) => animation.target === 'title')!;
    expect(titleEntrance.delay).toBe(0);
    // features starts at 12s; the first bento slot enters right on the beat.
    expect(entranceOf(scene, 'planCard')).toBeGreaterThanOrEqual(12);
    expect(entranceOf(scene, 'planCard')).toBeLessThan(12.5);
    // The showcase on the reveal beat waits for 5s.
    expect(entranceOf(scene, 'product')).toBeGreaterThanOrEqual(5);
  });

  it('staggers layout siblings instead of firing them together', () => {
    const scene = build(STORYBOARD);
    const delays = ['planCard', 'alert', 'usage'].map((id) => entranceOf(scene, id));
    expect(new Set(delays).size).toBe(3);
    expect(delays).toEqual([...delays].sort((left, right) => left - right));
  });

  it('reveals arrivals binary instead of fading them in', () => {
    const scene = build(STORYBOARD);
    const arrival = scene.animations.find((animation) => animation.target === 'title')!;
    expect(arrival.keyframes.length).toBe(3);
    expect(arrival.keyframes[0]!.properties['opacity']).toBe(0);
    // Opacity is already full one frame in — the motion carries the entrance.
    expect(arrival.keyframes[1]!.properties['opacity']).toBe(1);
    expect(arrival.keyframes[1]!.offset).toBeLessThanOrEqual(0.08);
    expect(arrival.keyframes[2]!.properties['opacity']).toBe(1);
    expect(arrival.easing).toBe('power4.out');
  });

  it('keeps a delayed arrival hidden before its beat despite full-opacity keyframes', () => {
    const scene = build(STORYBOARD);
    const early = evaluateScene(scene, 11.5);
    const card = early.elements.find((element) => element.id === 'planCard')!;
    expect(Number(card.render.opacity)).toBe(0);
    const landed = evaluateScene(scene, 14);
    expect(
      Number(landed.elements.find((element) => element.id === 'planCard')!.render.opacity)
    ).toBeGreaterThan(0.9);
  });

  it('gives the focal tile more travel than its support', () => {
    const scene = build(`layout grid {
  type bentoGrid
  columns 3
}

text a {
  value "One"
  parent grid
}

text b {
  value "Two"
  parent grid
}

text c {
  value "Three"
  parent grid
}

text d {
  value "Four"
  parent grid
}`);
    const travel = (id: string) => {
      const animation = scene.animations.find((item) => item.target === id)!;
      const start = Number(animation.keyframes[0]!.properties['y']);
      const rest = Number(animation.keyframes[2]!.properties['y']);
      return Math.abs(start - rest);
    };
    expect(travel('a')).toBeGreaterThan(travel('b'));
  });

  it('never exceeds the single-entry duration budget', () => {
    const scene = build(STORYBOARD);
    for (const animation of scene.animations) {
      if (animation.repeat === 'infinite') continue;
      expect(animation.duration, animation.target).toBeLessThanOrEqual(2.7);
    }
  });

  it('reframes the composition with a camera move per beat', () => {
    const scene = build(STORYBOARD);
    const moves = scene.animations.filter((animation) => animation.target === 'camera');
    expect(moves).toHaveLength(2);
    expect(moves[0]!.delay).toBe(5);
    expect(moves[0]!.to['zoom']).toBe(1.25);
    expect(moves[1]!.delay).toBe(12);
    expect(moves[1]!.to['zoom']).toBe(1);
  });

  it('records the storyboard on the scene for the editor', () => {
    const scene = build(STORYBOARD);
    expect(scene.beats?.map((beat) => beat.label)).toEqual([
      'Brand introduction',
      'Product reveal',
      'Feature showcase',
    ]);
    expect(scene.beats?.map((beat) => beat.start)).toEqual([0, 5, 12]);
  });

  it('builds a complete device presentation from one asset', () => {
    const scene = build(STORYBOARD);
    const parts = scene.elements.filter((element) => element.id.startsWith('product__'));
    expect(parts.length).toBeGreaterThan(4);
    const media = parts.find((element) => element.id === 'product__media')!;
    expect(media.kind).toBe('image');
    expect(media.assetName).toBe('dashShot');
    expect(media.properties.parent).toBe('product__screen');
    const screen = parts.find((element) => element.id === 'product__screen')!;
    expect(screen.properties.clip).toBe(true);
  });

  it('lowers a layout morph into paired group animations, never a frame fade', () => {
    const scene = build(STORYBOARD);
    const outgoing = scene.animations.find(
      (animation) => animation.target === 'product' && animation.to['opacity'] === 0
    );
    const incoming = scene.animations.find(
      (animation) => animation.target === 'capabilities' && animation.to['opacity'] === 1
    );
    expect(outgoing).toBeDefined();
    expect(incoming).toBeDefined();
    expect(scene.transitions).toHaveLength(0);
  });

  it('lowers a shared element beat transition to the engine transition mechanism', () => {
    const scene = build(`beat one {
  duration 6s
}

beat two {
  duration 6s
  transition sharedElement
  from cardA
  to cardB
}

component cardA {
  type pricingcard
  x -400
}

component cardB {
  type dashboard
  x 400
}`);
    expect(scene.transitions).toHaveLength(1);
    expect(scene.transitions[0]!.from).toBe('cardA');
    expect(scene.transitions[0]!.to).toBe('cardB');
    expect(scene.transitions[0]!.at).toBe(6);
  });

  it('evaluates and renders across the whole timeline without errors', () => {
    const scene = build(STORYBOARD);
    for (const time of [0, 2.5, 5, 8, 12, 16, 20, 23.9]) {
      const evaluated = evaluateScene(scene, time);
      expect(evaluated.elements.length).toBe(scene.elements.length);
      for (const element of evaluated.elements) {
        expect(Number.isFinite(Number(element.render.x)), `${element.id} at ${time}s`).toBe(true);
        expect(Number.isFinite(Number(element.render.y)), `${element.id} at ${time}s`).toBe(true);
        expect(Number.isFinite(Number(element.render.opacity)), `${element.id} at ${time}s`).toBe(
          true
        );
      }
    }
  });

  it('keeps objects alive across beats instead of clearing them', () => {
    const scene = build(STORYBOARD);
    const late = evaluateScene(scene, 20);
    // The title entered on the first beat and is still part of the composition
    // two beats later: beats never clear what came before.
    const title = late.elements.find((element) => element.id === 'title')!;
    expect(Number(title.render.opacity)).toBeGreaterThan(0.9);
    const dashboardScreen = late.elements.find((element) => element.id === 'product__screen')!;
    expect(dashboardScreen).toBeDefined();
  });

  it('recedes only the outgoing arrangement of an explicit layout morph', () => {
    const scene = build(STORYBOARD);
    // product hands off to capabilities at 12s, so it steps back afterwards
    // while everything not part of the morph stays on screen.
    const before = evaluateScene(scene, 11);
    const after = evaluateScene(scene, 20);
    const opacity = (frame: ReturnType<typeof evaluateScene>, id: string) =>
      Number(frame.elements.find((element) => element.id === id)!.render.opacity);
    expect(opacity(before, 'product')).toBeGreaterThan(0.9);
    expect(opacity(after, 'product')).toBeLessThan(0.1);
    expect(opacity(after, 'capabilities')).toBeGreaterThan(0.9);
  });

  it('round-trips through the serializer back into the same scene', () => {
    const first = build(STORYBOARD);
    const compiled = compileSemanticProgram(parseMotion(project(STORYBOARD)));
    const second = buildSceneGraph(parseMotion(serializeProgram(compiled.program)));
    expect(second.elements.map((element) => element.id)).toEqual(
      first.elements.map((element) => element.id)
    );
  });

  it('rejects an unknown layout type', () => {
    expect(() =>
      build(`layout grid {
  type notALayout
}`)
    ).toThrow(/unsupported type "notALayout"/);
  });

  it('rejects an unknown showcase type', () => {
    expect(() =>
      build(`showcase shot {
  type notAShowcase
}`)
    ).toThrow(/unsupported type "notAShowcase"/);
  });

  it('rejects an unknown beat transition', () => {
    expect(() =>
      build(`beat one {
  duration 4s
}

beat two {
  transition crossfade
}`)
    ).toThrow(/unsupported transition "crossfade"/);
  });

  it('rejects a reference to a missing beat', () => {
    expect(() =>
      build(`beat one {
  duration 4s
}

text hi {
  value "Hi"
  center
  beat nope
}`)
    ).toThrow(/missing beat "nope"/);
  });

  it('rejects a layout with more children than it supports', () => {
    const children = Array.from(
      { length: 6 },
      (_, index) => `component c${index} {
  parent stack
  type phone
}`
    ).join('\n\n');
    expect(() =>
      build(`layout stack {
  type deviceStack
}

${children}`)
    ).toThrow(/supports at most 5 children/);
  });

  it('rejects an unknown property on a motion-system block', () => {
    expect(() =>
      build(`layout grid {
  type bentoGrid
  wobble 4
}`)
    ).toThrow(/does not support wobble/);
  });
});
