import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { evaluateScene } from '../../src/animation/evaluator';
import { migrateToScenes } from '../../src/motion-system/scene-migration';

/**
 * Migration must be a reorganization, not a retiming.
 *
 * A scene evaluates its children in parent-local time, so moving an object into a
 * scene that starts at 5s silently pushes an animation authored at 5s out to 10s.
 * Lifting a project into a storyboard therefore has to rebase every member's own
 * timing — otherwise "organize into scenes" quietly breaks the film it organized.
 */

const flat = `
canvas { size 320x180 fps 30 duration 12s background #000000 }

text early {
  value "Early"
  center
  size 40
  color #ffffff
  opacity 0
}

text late {
  value "Late"
  center
  size 40
  color #ffffff
  opacity 0
}

animate early {
  from { opacity 0 }
  to { opacity 1 }
  delay 0s
  duration 0.5s
}

animate late {
  from { opacity 0 }
  to { opacity 1 }
  delay 6s
  duration 0.5s
}
`;

function opacityAt(source: string, id: string, time: number): number {
  const graph = buildSceneGraph(parseMotion(source));
  const element = evaluateScene(graph, time).elements.find((entry) => entry.id === id);
  return element ? Number(element.render.opacity) : -1;
}

/**
 * Visible opacity at a moment. An element culled because its scene has not opened
 * and an element sitting at `opacity 0` are indistinguishable on screen, so both
 * count as 0 — the comparison is about what the viewer sees.
 */
function sample(program: Parameters<typeof buildSceneGraph>[0], id: string, time: number): number {
  const graph = buildSceneGraph(program);
  const element = evaluateScene(graph, time).elements.find((entry) => entry.id === id);
  return element ? Number(element.render.opacity) : 0;
}

describe('migration preserves timing', () => {
  it('splits this project into two scenes', () => {
    const result = migrateToScenes(parseMotion(flat));
    expect(result.strategy).toBe('segment');
    expect(result.scenes).toEqual(['scene1', 'scene2']);
  });

  it('keeps every arrival landing at the same moment it did before', () => {
    const before = parseMotion(flat);
    const after = migrateToScenes(before).program;

    // Sampled inside each member's own scene, around its entrance. This is the
    // property the rebase exists to protect.
    for (const [id, times] of [
      ['early', [0.1, 0.6, 3]],
      ['late', [6.1, 6.6, 9]],
    ] as const) {
      for (const time of times) {
        expect(sample(after, id, time), `${id} @ ${time}s`).toBeCloseTo(
          sample(before, id, time),
          3
        );
      }
    }
  });

  it('keeps scene members visible across boundaries unless a scene is cleared', () => {
    const after = migrateToScenes(parseMotion(flat)).program;
    // Scenes are organizational by default: members stay visible after their source scene
    // unless a scene is explicitly marked `clear`.
    expect(sample(after, 'early', 5.99)).toBe(sample(after, 'early', 3));
    expect(sample(parseMotion(flat), 'early', 5.99)).toBe(1);
  });

  it('rebases the late animation into scene-local time', () => {
    const after = migrateToScenes(parseMotion(flat)).program;
    const animation = after.body.find(
      (node) => node.type === 'Animation' && node.target === 'late'
    );
    if (!animation || animation.type !== 'Animation') throw new Error('expected an animation');
    // Scene 2 starts at 6s, so an animation authored at an absolute 6s is now 0s.
    expect(animation.delay).toBe('0s');
  });

  it('leaves the first scene alone, because it already starts at zero', () => {
    const after = migrateToScenes(parseMotion(flat)).program;
    const animation = after.body.find(
      (node) => node.type === 'Animation' && node.target === 'early'
    );
    if (!animation || animation.type !== 'Animation') throw new Error('expected an animation');
    expect(animation.delay).toBe('0s');
  });

  it('preserves timing when promoting beats to scenes', () => {
    const beaten = `
canvas { size 320x180 fps 30 duration 10s background #000000 }

beat intro { duration 4s label "Intro" }
beat reveal { duration 6s label "Reveal" }

text a { beat intro value "A" center size 40 color #ffffff opacity 0 }
text b { beat reveal value "B" center size 40 color #ffffff opacity 0 }

animate a {
  from { opacity 0 }
  to { opacity 1 }
  delay 0.2s
  duration 0.4s
}

animate b {
  from { opacity 0 }
  to { opacity 1 }
  delay 4.2s
  duration 0.4s
}
`;
    const before = parseMotion(beaten);
    const after = migrateToScenes(before).program;
    for (const [id, times] of [
      ['a', [0.3, 0.7, 2]],
      ['b', [4.3, 4.7, 8]],
    ] as const) {
      for (const time of times) {
        expect(sample(after, id, time), `${id} @ ${time}s`).toBeCloseTo(
          sample(before, id, time),
          3
        );
      }
    }
  });

  it('leaves a single-scene migration byte-for-byte equivalent in timing', () => {
    const tight = `
canvas { size 320x180 fps 30 duration 4s background #000000 }
text a { value "A" center size 40 color #ffffff opacity 0 }
animate a { from { opacity 0 } to { opacity 1 } delay 1s duration 0.5s }
`;
    const after = migrateToScenes(parseMotion(tight)).program;
    expect(opacityAt(tight, 'a', 1.2)).toBeCloseTo(sample(after, 'a', 1.2), 3);
  });
});
