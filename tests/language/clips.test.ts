import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('timeline clips', () => {
  it('normalizes time units and renders visual tracks back-to-front', () => {
    const ast = parseMotion(`
      canvas {
        duration 8s
      }
      import "/back.svg" as back
      import "/front.svg" as front
      back {
        center
        width 200
      }
      front {
        center
        width 200
      }
      clip front {
        track 2
        start 1.25s
        duration 3s
        trimIn 250ms
        trimOut 0s
      }
      clip back {
        track 1
        start 1s
        duration 4s
        trimIn 0s
        trimOut 500ms
      }
    `);
    const scene = buildSceneGraph(ast);

    expect(
      scene.clips.map(({ start, duration, trimIn, trimOut }) => ({
        start,
        duration,
        trimIn,
        trimOut,
      }))
    ).toEqual([
      { start: 1.25, duration: 3, trimIn: 0.25, trimOut: 0 },
      { start: 1, duration: 4, trimIn: 0, trimOut: 0.5 },
    ]);
    const evaluated = evaluateScene(scene, 2);
    expect(evaluated.elements.map((element) => element.assetName)).toEqual(['back', 'front']);
    expect(evaluated.elements.map((element) => element.render.mediaTime)).toEqual([1, 1]);
    expect(evaluated.elements.map((element) => element.render.mediaTrimOut)).toEqual([0.5, 0]);
    expect(evaluateScene(scene, 0).elements).toHaveLength(0);
    expect(buildSceneGraph(parseMotion(serializeProgram(ast))).clips).toHaveLength(2);
  });

  it('keeps authored source order for overlapping clips on the same track', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        import "/one.mp4" as one
        import "/two.mp4" as two
        one { center }
        two { center }
        clip two {
          track 3
          start 0s
          duration 2s
        }
        clip one {
          track 3
          start 0s
          duration 2s
        }
      `)
    );

    expect(scene.clips.map((clip) => clip.sourceOrder)).toEqual([0, 1]);
    expect(evaluateScene(scene, 1).elements.map((element) => element.assetName)).toEqual([
      'two',
      'one',
    ]);
  });

  it('keeps timeline-only media at natural size instead of covering the canvas', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        import "/video.mp4" as video
        clip video { track 1 start 0s duration 2s }
      `)
    );

    expect(evaluateScene(scene, 1).elements[0]?.render).toMatchObject({
      center: true,
      cover: false,
      scale: 1,
    });
  });

  it('round-trips paired crossfades and evaluates both sides of the cut', () => {
    const ast = parseMotion(`
      import "/outgoing.svg" as outgoing
      import "/incoming.svg" as incoming
      outgoing {
        center
        opacity 0.8
      }
      incoming {
        center
        opacity 0.8
      }
      clip outgoing {
        track 1
        start 0s
        duration 2s
        transitionOut crossfade
        transitionOutDuration 500ms
      }
      clip incoming {
        track 1
        start 2s
        duration 2s
        transitionIn crossfade
        transitionInDuration 500ms
      }
    `);
    const scene = buildSceneGraph(ast);
    expect(scene.clips).toMatchObject([
      { transitionOut: 'crossfade', transitionOutDuration: 0.5 },
      { transitionIn: 'crossfade', transitionInDuration: 0.5 },
    ]);

    const atCut = evaluateScene(scene, 2).elements;
    expect(atCut.map((element) => element.assetName)).toEqual(['outgoing', 'incoming']);
    expect(atCut.map((element) => element.render.opacity)).toEqual([0.8, 0]);

    const midpoint = evaluateScene(scene, 2.25).elements;
    expect(midpoint.map((element) => element.render.opacity)).toEqual([0.4, 0.4]);
    expect(evaluateScene(scene, 2.5).elements.map((element) => element.assetName)).toEqual([
      'incoming',
    ]);

    const reparsed = buildSceneGraph(parseMotion(serializeProgram(ast)));
    expect(reparsed.clips).toMatchObject([
      { transitionOut: 'crossfade', transitionOutDuration: 0.5 },
      { transitionIn: 'crossfade', transitionInDuration: 0.5 },
    ]);
  });
});
