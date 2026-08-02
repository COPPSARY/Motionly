import { describe, expect, it } from 'vitest';
import {
  MIN_SCENE_DURATION,
  SCENE_TRANSITION_KINDS,
  classifyParticipation,
  isSceneTransitionKind,
  lowerSceneRoots,
  lowerSceneTransitions,
  planSceneTransition,
  planScenes,
  sceneAt,
  sceneStarts,
  staticMembers,
  scenePrompt,
  storyboardDuration,
  type SceneSpec,
} from '../../src/motion-system/scenes';
import type { ASTNode, ElementNode } from '../../src/types/parser';

const options = { canvasDuration: 20, camera: { x: 0, y: 0, zoom: 1 } };

function spec(name: string, extra: Partial<SceneSpec> = {}): SceneSpec {
  return { name, ...extra };
}

describe('storyboard planning', () => {
  it('runs scenes back to back when no start is given', () => {
    const plans = planScenes(
      [
        spec('intro', { duration: 4 }),
        spec('demo', { duration: 6 }),
        spec('outro', { duration: 5 }),
      ],
      options
    );
    expect(plans.map((plan) => plan.start)).toEqual([0, 4, 10]);
    expect(plans.map((plan) => plan.end)).toEqual([4, 10, 15]);
    expect(storyboardDuration(plans)).toBe(15);
  });

  it('splits leftover canvas time between scenes that declare no duration', () => {
    const plans = planScenes([spec('a', { duration: 8 }), spec('b'), spec('c')], options);
    expect(plans[1]!.duration).toBe(6);
    expect(plans[2]!.duration).toBe(6);
    expect(plans[2]!.end).toBe(20);
  });

  it('honors an explicit start and never goes below the minimum scene length', () => {
    const plans = planScenes(
      [spec('a', { duration: 2 }), spec('b', { start: 9, duration: 0.01 })],
      options
    );
    expect(plans[1]!.start).toBe(9);
    expect(plans[1]!.duration).toBe(MIN_SCENE_DURATION);
  });

  it('links each scene to its previous and next neighbour', () => {
    const plans = planScenes(
      [spec('a', { duration: 4 }), spec('b', { duration: 4 }), spec('c', { duration: 4 })],
      options
    );
    expect(plans.map((plan) => plan.previous)).toEqual([null, 'a', 'b']);
    expect(plans.map((plan) => plan.next)).toEqual(['b', 'c', null]);
  });

  it('inherits the previous camera framing instead of snapping back', () => {
    const plans = planScenes(
      [spec('a', { duration: 5, zoom: 1.3 }), spec('b', { duration: 5 })],
      options
    );
    expect(plans[1]!.camera.zoom).toBe(1.3);
  });

  it('rejects duplicate scene names', () => {
    expect(() => planScenes([spec('a'), spec('a')], options)).toThrow(/Duplicate scene "a"/);
  });

  it('returns nothing for an empty storyboard', () => {
    expect(planScenes([], options)).toEqual([]);
  });

  it('exposes scene starts and locates the scene at a time', () => {
    const plans = planScenes(
      [spec('intro', { duration: 3 }), spec('demo', { duration: 4 })],
      options
    );
    expect(sceneStarts(plans).get('demo')).toBe(3);
    expect(sceneAt(plans, 0)!.name).toBe('intro');
    expect(sceneAt(plans, 3)!.name).toBe('demo');
    expect(sceneAt(plans, 99)).toBeNull();
  });
});

describe('participation', () => {
  const storyboard = planScenes(
    [
      spec('a', {
        duration: 5,
        members: [{ id: 'logo', identity: 'brand' }, { id: 'hero' }, { id: 'cta' }],
      }),
      spec('b', {
        duration: 5,
        members: [{ id: 'logoSmall', identity: 'brand' }, { id: 'dashboard' }, { id: 'sidebar' }],
      }),
    ],
    options
  );

  it('pairs components across a boundary by persistent identity', () => {
    const participation = classifyParticipation(storyboard[0]!, storyboard[1]!);
    expect(participation.shared).toEqual([{ identity: 'brand', from: 'logo', to: 'logoSmall' }]);
    expect(participation.exit).toEqual(['hero', 'cta']);
    expect(participation.enter).toEqual(['dashboard', 'sidebar']);
  });

  it('treats a reused element name as the same component without an explicit identity', () => {
    const plans = planScenes(
      [
        spec('a', { duration: 4, members: [{ id: 'logo' }, { id: 'hero' }] }),
        spec('b', { duration: 4, members: [{ id: 'logo' }, { id: 'panel' }] }),
      ],
      options
    );
    const participation = plans[1]!.transition!.participation;
    expect(participation.shared).toEqual([{ identity: 'logo', from: 'logo', to: 'logo' }]);
    expect(participation.exit).toEqual(['hero']);
    expect(participation.enter).toEqual(['panel']);
  });

  it('defaults a boundary with a shared component to a shared-element handoff', () => {
    expect(storyboard[1]!.transition!.kind).toBe('sharedElement');
    expect(storyboard[0]!.transition).toBeNull();
  });

  it('defaults a reframe with nothing shared to a camera move, otherwise continuity', () => {
    const reframed = planScenes(
      [spec('a', { duration: 4 }), spec('b', { duration: 4, zoom: 1.4 })],
      options
    );
    expect(reframed[1]!.transition!.kind).toBe('cameraMove');
    const held = planScenes([spec('a', { duration: 4 }), spec('b', { duration: 4 })], options);
    expect(held[1]!.transition!.kind).toBe('continuous');
  });

  it('lets the author override the inferred kind', () => {
    const plans = planScenes(
      [spec('a', { duration: 4 }), spec('b', { duration: 4, transition: 'cut' })],
      options
    );
    expect(plans[1]!.transition!.kind).toBe('cut');
  });

  it('classifies every declared kind and rejects a frame fade', () => {
    for (const kind of SCENE_TRANSITION_KINDS) expect(isSceneTransitionKind(kind)).toBe(true);
    expect(isSceneTransitionKind('fade')).toBe(false);
    expect(isSceneTransitionKind('crossfade')).toBe(false);
  });

  it('gives each kind a purposeful default curve', () => {
    const empty = { shared: [], exit: [], enter: [] };
    expect(
      planSceneTransition({
        kind: 'sharedElement',
        at: 0,
        participation: empty,
        cameraChanged: false,
      }).easing
    ).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(
      planSceneTransition({ kind: 'cameraMove', at: 0, participation: empty, cameraChanged: true })
        .easing
    ).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
  });
});

describe('lowering', () => {
  const storyboard = planScenes(
    [
      spec('intro', {
        duration: 5,
        background: '#05060a',
        members: [
          { id: 'logo', identity: 'brand' },
          { id: 'hero', animated: true },
        ],
      }),
      spec('demo', {
        duration: 5,
        zoom: 1.2,
        members: [
          { id: 'logoSmall', identity: 'brand' },
          { id: 'dashboard' },
          { id: 'sidebar' },
          { id: 'caption', animated: true },
        ],
      }),
    ],
    options
  );

  it('patches authored scene blocks with absolute timing and camera framing', () => {
    const nodes = new Map<string, ElementNode>([
      [
        'intro',
        {
          type: 'Element',
          kind: 'scene',
          name: 'intro',
          properties: { duration: '5s', background: '#05060a', transition: 'continuous' },
        },
      ],
      [
        'demo',
        { type: 'Element', kind: 'scene', name: 'demo', properties: { duration: '5s', zoom: 1.2 } },
      ],
    ]);
    const roots = lowerSceneRoots(storyboard, nodes);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.kind).toBe('scene');
    expect(roots[0]!.properties['start']).toBe('0s');
    expect(roots[0]!.properties['background']).toBe('#05060a');
    // Storyboard-only properties never reach the scene graph.
    expect(roots[0]!.properties['transition']).toBeUndefined();
    expect(roots[1]!.properties['start']).toBe('5s');
    expect(roots[1]!.properties['cameraZoom']).toBe(1.2);
    expect(roots[1]!.properties['zoom']).toBeUndefined();
  });

  it('lowers a shared component to the engine transition mechanism', () => {
    const nodes = lowerSceneTransitions(storyboard);
    const handoffs = nodes.filter((node) => node.type === 'Element' && node.kind === 'transition');
    expect(handoffs).toHaveLength(1);
    const handoff = handoffs[0]!;
    if (handoff.type !== 'Element') throw new Error('expected an element');
    expect(handoff.properties['from']).toBe('logo');
    expect(handoff.properties['to']).toBe('logoSmall');
    expect(handoff.properties['at']).toBe('5s');
  });

  it('moves complete continuous shots without resetting their child animations', () => {
    const plans = planScenes(
      [
        spec('one', { duration: 4, transition: 'cut', members: [{ id: 'title', animated: true }] }),
        spec('two', {
          duration: 4,
          transition: 'continuous',
          members: [{ id: 'panel', animated: true }],
        }),
      ],
      options
    );
    const animations = lowerSceneTransitions(plans).filter(
      (node): node is Extract<ASTNode, { type: 'Animation' }> => node.type === 'Animation'
    );
    expect(animations.map((animation) => animation.target)).toEqual(['one', 'two']);
    expect(animations[0]!.to?.x).toBe(-2200);
    expect(animations[1]!.from?.x).toBe(2200);
  });

  it('animates only genuine exits, and moves them rather than fading the frame', () => {
    const exits = lowerSceneTransitions(storyboard).filter(
      (node) => node.type === 'Animation' && node.target === 'hero'
    );
    expect(exits).toHaveLength(1);
    const exit = exits[0]!;
    if (exit.type !== 'Animation') throw new Error('expected an animation');
    expect(exit.to!['y']).not.toBe(0);
    expect(exit.delay as number).toBeLessThan(5);
  });

  it('never emits an exit for a shared component', () => {
    const targets = lowerSceneTransitions(storyboard)
      .filter(
        (node) =>
          node.type === 'Animation' &&
          (node.to?.['y'] !== undefined || node.to?.['scale'] !== undefined)
      )
      .map((node) => (node.type === 'Animation' ? node.target : ''));
    expect(targets).not.toContain('logo');
    expect(targets).not.toContain('logoSmall');
  });

  it('enters arrivals as a wave and skips anything that already has motion', () => {
    const arriving = new Set(['dashboard', 'sidebar', 'caption']);
    const enters = lowerSceneTransitions(storyboard).filter(
      (node) => node.type === 'Animation' && arriving.has(node.target)
    );
    const targets = enters.map((node) => (node.type === 'Animation' ? node.target : ''));
    expect(targets).toEqual(['dashboard', 'sidebar']);
    expect(targets).not.toContain('caption');
    const [first, second] = enters;
    if (first?.type !== 'Animation' || second?.type !== 'Animation') {
      throw new Error('expected animations');
    }
    expect(second.delay as number).toBeGreaterThan(first.delay as number);
    // Arrivals reveal binary: opacity snaps on, motion carries the entrance.
    expect(first.from!['opacity']).toBe(0);
    expect(first.from!['y']).not.toBe(0);
  });

  it('rebases exits and entrances onto the scene that owns them', () => {
    // A member is evaluated in its own scene's local time, so an absolute boundary
    // delay would fire a whole scene late.
    const nodes = lowerSceneTransitions(storyboard).filter((node) => node.type === 'Animation');
    const exit = nodes.find((node) => node.type === 'Animation' && node.target === 'hero');
    if (exit?.type !== 'Animation') throw new Error('expected an exit');
    // Boundary is at 5s and `hero` lives in a scene starting at 0s.
    expect(exit.delay as number).toBeLessThan(5);

    const enter = nodes.find((node) => node.type === 'Animation' && node.target === 'dashboard');
    if (enter?.type !== 'Animation') throw new Error('expected an entrance');
    // `dashboard` lives in the scene that starts at the boundary, so local zero.
    expect(enter.delay).toBe(0);
  });

  it('emits nothing for a cut boundary', () => {
    const plans = planScenes(
      [
        spec('a', { duration: 4, members: [{ id: 'one' }] }),
        spec('b', { duration: 4, transition: 'cut', members: [{ id: 'two' }] }),
      ],
      options
    );
    expect(lowerSceneTransitions(plans)).toEqual([]);
  });

  it('reframes both scene roots for a camera boundary instead of swapping layers', () => {
    const plans = planScenes(
      [
        spec('a', { duration: 4, members: [{ id: 'one' }] }),
        spec('b', { duration: 4, transition: 'cameraMove', members: [{ id: 'two' }] }),
      ],
      options
    );
    const animations = lowerSceneTransitions(plans).filter(
      (node): node is Extract<ASTNode, { type: 'Animation' }> => node.type === 'Animation'
    );
    expect(animations.map((animation) => animation.target)).toEqual(['a', 'b']);
    expect(animations[0]!.delay).toBe(4);
    expect(Math.abs(Number(animations[0]!.to?.x))).toBe(96);
    expect(Number(animations[0]!.to?.rotationY)).not.toBe(0);
    expect(Number(animations[1]!.from?.rotationY)).not.toBe(0);
  });

  it('preserves shared-element participation on an explicit camera boundary', () => {
    const plans = planScenes(
      [
        spec('a', {
          duration: 4,
          members: [{ id: 'hero', identity: 'product' }, { id: 'oldCopy' }],
        }),
        spec('b', {
          duration: 4,
          transition: 'cameraMove',
          zoom: 1.15,
          members: [{ id: 'heroDetail', identity: 'product' }, { id: 'newCopy' }],
        }),
      ],
      options
    );
    const nodes = lowerSceneTransitions(plans);
    expect(
      nodes.some(
        (node) =>
          node.type === 'Element' &&
          node.kind === 'transition' &&
          node.properties['from'] === 'hero' &&
          node.properties['to'] === 'heroDetail'
      )
    ).toBe(true);
    const animationTargets = nodes
      .filter((node): node is Extract<ASTNode, { type: 'Animation' }> => node.type === 'Animation')
      .map((node) => node.target);
    expect(animationTargets).toContain('hero');
    expect(animationTargets).toContain('oldCopy');
    expect(animationTargets).toContain('newCopy');
    expect(animationTargets).not.toContain('a');
    expect(animationTargets).not.toContain('b');
  });

  it('uses depth when the authored camera zoom changes', () => {
    const plans = planScenes(
      [
        spec('a', { duration: 4, zoom: 1, members: [{ id: 'one' }] }),
        spec('b', {
          duration: 4,
          zoom: 1.2,
          transition: 'cameraMove',
          members: [{ id: 'two' }],
        }),
      ],
      options
    );
    const animations = lowerSceneTransitions(plans).filter(
      (node): node is Extract<ASTNode, { type: 'Animation' }> => node.type === 'Animation'
    );
    expect(Number(animations[0]!.to?.scale)).toBeGreaterThan(1);
    expect(Number(animations[1]!.from?.scale)).toBeLessThan(1);
  });

  it('reports members that would sit still for the whole storyboard', () => {
    const plans = planScenes(
      [
        spec('a', {
          duration: 4,
          members: [{ id: 'moving', animated: true }, { id: 'frozen' }],
        }),
      ],
      options
    );
    expect(staticMembers(plans)).toEqual(['frozen']);
  });
});

describe('scene prompt', () => {
  it('teaches storyboard-first generation and forbids fades', () => {
    const prompt = scenePrompt();
    expect(prompt).toMatch(/storyboard/i);
    expect(prompt).toMatch(/identity/);
    expect(prompt).toMatch(/There is no fade/);
    expect(prompt).toMatch(/organizational boundaries, NOT animation boundaries/);
  });
});
