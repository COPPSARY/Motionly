import { describe, expect, it } from 'vitest';
import {
  BEAT_ROUTES,
  beatStarts,
  isBeatRoute,
  lowerBeats,
  planBeats,
} from '../../src/motion-system/beats';
import {
  BEAT_TRANSITION_KINDS,
  isBeatTransitionKind,
  lowerBeatTransition,
  planBeatTransition,
  requiresEndpoints,
} from '../../src/motion-system/transitions';

const options = { canvasDuration: 20, camera: { x: 0, y: 0, zoom: 1 } };

describe('beats', () => {
  it('runs beats back to back when no start is given', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 4 },
        { name: 'b', duration: 6 },
        { name: 'c', duration: 5 },
      ],
      options
    );
    expect(plans.map((plan) => plan.start)).toEqual([0, 4, 10]);
    expect(plans.map((plan) => plan.end)).toEqual([4, 10, 15]);
  });

  it('splits leftover canvas time between beats that declare no duration', () => {
    const plans = planBeats([{ name: 'a', duration: 8 }, { name: 'b' }, { name: 'c' }], options);
    expect(plans[1]!.duration).toBe(6);
    expect(plans[2]!.duration).toBe(6);
    expect(plans[2]!.end).toBe(20);
  });

  it('honors an explicit start', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 2 },
        { name: 'b', start: 9 },
      ],
      options
    );
    expect(plans[1]!.start).toBe(9);
  });

  it('never emits a scene root, so the composition persists across beats', () => {
    const nodes = lowerBeats(
      planBeats(
        [
          { name: 'a', duration: 5, zoom: 1.2 },
          { name: 'b', duration: 5 },
        ],
        options
      ),
      options
    );
    for (const node of nodes) {
      expect(node.type === 'Element' && node.kind === 'scene').toBe(false);
    }
  });

  it('reframes the persistent composition with a camera move', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 5 },
        { name: 'b', duration: 5, focus: 'hero', zoom: 1.4 },
      ],
      options
    );
    const moves = lowerBeats(plans, options).filter(
      (node) => node.type === 'Animation' && node.target === 'camera'
    );
    expect(moves).toHaveLength(1);
    const move = moves[0]!;
    if (move.type !== 'Animation') throw new Error('expected animation');
    expect(move.delay).toBe(5);
    expect(move.from!['zoom']).toBe(1);
    expect(move.to!['zoom']).toBe(1.4);
  });

  it('emits no camera move when the framing is unchanged', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 5 },
        { name: 'b', duration: 5 },
      ],
      options
    );
    expect(lowerBeats(plans, options).filter((node) => node.type === 'Animation')).toHaveLength(0);
  });

  it('inherits the previous camera framing instead of snapping back', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 5, zoom: 1.3 },
        { name: 'b', duration: 5, focus: 'other' },
      ],
      options
    );
    expect(plans[1]!.camera.zoom).toBe(1.3);
  });

  it('defaults a focus change to a camera move and a held focus to continuity', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 4, focus: 'one' },
        { name: 'b', duration: 4, focus: 'two' },
        { name: 'c', duration: 4, focus: 'two' },
      ],
      options
    );
    expect(plans[0]!.transition).toBeNull();
    expect(plans[1]!.transition!.kind).toBe('cameraMove');
    expect(plans[2]!.transition!.kind).toBe('continuous');
  });

  it('rejects a paired transition that is missing an endpoint', () => {
    expect(() =>
      planBeats(
        [
          { name: 'a', duration: 4 },
          { name: 'b', transition: 'sharedElement' },
        ],
        options
      )
    ).toThrow(/needs both from and to/);
    expect(() =>
      planBeats(
        [
          { name: 'a', duration: 4 },
          { name: 'b', transition: 'layoutMorph', from: 'x' },
        ],
        options
      )
    ).toThrow(/needs both from and to/);
  });

  it('exposes beat starts for pacing attached content', () => {
    const starts = beatStarts(
      planBeats(
        [
          { name: 'intro', duration: 3 },
          { name: 'reveal', duration: 4 },
        ],
        options
      )
    );
    expect(starts.get('intro')).toBe(0);
    expect(starts.get('reveal')).toBe(3);
  });

  it('keeps the storyboard label for the editor', () => {
    const plans = planBeats([{ name: 'a', duration: 4, label: 'Product reveal' }], options);
    expect(plans[0]!.label).toBe('Product reveal');
  });

  it('returns nothing for an empty storyboard', () => {
    expect(planBeats([], options)).toEqual([]);
  });
});

describe('sustained-motion routes', () => {
  it('infers cameraIntent when the beat moves the camera', () => {
    const plans = planBeats(
      [
        { name: 'a', duration: 4 },
        { name: 'b', duration: 4, zoom: 1.3 },
      ],
      options
    );
    expect(plans[1]!.route).toBe('cameraIntent');
  });

  it('infers stagedReveals when several blocks attach to the beat', () => {
    const plans = planBeats([{ name: 'a', duration: 4, attachments: 3 }], options);
    expect(plans[0]!.route).toBe('stagedReveals');
  });

  it('falls back to an explicit hold rather than pretending to perform', () => {
    const plans = planBeats([{ name: 'a', duration: 4, attachments: 1 }], options);
    expect(plans[0]!.route).toBe('hold');
  });

  it('rejects a cameraIntent claim the beat cannot back up', () => {
    expect(() =>
      planBeats([{ name: 'still', duration: 4, route: 'cameraIntent' }], options)
    ).toThrow(/never moves the camera/);
  });

  it('rejects a stagedReveals claim with nothing to stage', () => {
    expect(() =>
      planBeats([{ name: 'thin', duration: 4, route: 'stagedReveals', attachments: 1 }], options)
    ).toThrow(/only 1 block attaches to it/);
  });

  it('accepts every declared route name', () => {
    for (const route of BEAT_ROUTES) {
      const spec = {
        name: 'b',
        duration: 4,
        route,
        attachments: 3,
        ...(route === 'cameraIntent' ? { zoom: 1.2 } : {}),
      };
      expect(planBeats([spec], options)[0]!.route, route).toBe(route);
    }
    expect(isBeatRoute('wobble')).toBe(false);
  });
});

describe('beat transitions', () => {
  it('classifies every kind and knows which need endpoints', () => {
    for (const kind of BEAT_TRANSITION_KINDS) {
      expect(isBeatTransitionKind(kind)).toBe(true);
    }
    expect(isBeatTransitionKind('crossfade')).toBe(false);
    expect(requiresEndpoints('sharedElement')).toBe(true);
    expect(requiresEndpoints('objectMorph')).toBe(true);
    expect(requiresEndpoints('layoutMorph')).toBe(true);
    expect(requiresEndpoints('cameraMove')).toBe(false);
    expect(requiresEndpoints('continuous')).toBe(false);
  });

  it('lowers a shared element handoff to the engine transition mechanism', () => {
    const plan = planBeatTransition({
      kind: 'sharedElement',
      from: 'card',
      to: 'detail',
      at: 6,
      focusChanged: true,
    });
    const [node] = lowerBeatTransition(plan, 'reveal__transition');
    if (!node || node.type !== 'Element') throw new Error('expected a transition element');
    expect(node.kind).toBe('transition');
    expect(node.properties['from']).toBe('card');
    expect(node.properties['to']).toBe('detail');
    expect(node.properties['at']).toBe('6s');
  });

  it('lowers a layout morph to paired group animations, never a frame fade', () => {
    const plan = planBeatTransition({
      kind: 'layoutMorph',
      from: 'gridA',
      to: 'gridB',
      at: 8,
      duration: 1,
      focusChanged: true,
    });
    const nodes = lowerBeatTransition(plan, 'features__transition');
    expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      expect(node.type).toBe('Animation');
    }
    const [outgoing, incoming] = nodes;
    if (outgoing?.type !== 'Animation' || incoming?.type !== 'Animation') {
      throw new Error('expected animations');
    }
    expect(outgoing.target).toBe('gridA');
    expect(outgoing.to!['scale']).toBeLessThan(1);
    expect(incoming.target).toBe('gridB');
    expect(incoming.from!['scale']).toBeGreaterThan(1);
    expect(incoming.delay).toBeGreaterThan(outgoing.delay as number);
  });

  it('emits nothing for camera, continuous, and cut transitions', () => {
    for (const kind of ['cameraMove', 'continuous', 'cut'] as const) {
      const plan = planBeatTransition({ kind, at: 3, focusChanged: true, from: 'a', to: 'b' });
      expect(lowerBeatTransition(plan, 'x'), kind).toEqual([]);
    }
  });

  it('gives each kind a purposeful default curve', () => {
    expect(planBeatTransition({ kind: 'sharedElement', at: 0, focusChanged: true }).easing).toBe(
      'cubic-bezier(0.22, 1, 0.36, 1)'
    );
    expect(planBeatTransition({ kind: 'objectMorph', at: 0, focusChanged: true }).easing).toBe(
      'cubic-bezier(0.22, 1, 0.36, 1)'
    );
    expect(
      planBeatTransition({ kind: 'cameraMove', at: 0, focusChanged: true, easing: 'power1.out' })
        .easing
    ).toBe('power1.out');
  });
});
