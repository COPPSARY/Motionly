import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('persistent timeline tracks', () => {
  it('round-trips declared role tracks and bare/explicit flags', () => {
    const ast = parseMotion(`
      track main {
        label "Main Track"
        role main
        content primary
        hidden false
        muted
        order 0
      }
      track titles {
        label "Titles"
        role overlay
        content text
        order 1
      }
    `);
    const scene = buildSceneGraph(ast);
    expect(scene.tracks).toMatchObject([
      { id: 'main', role: 'main', content: 'primary', hidden: false, muted: true },
      { id: 'titles', role: 'overlay', content: 'text', hidden: false, muted: false },
    ]);
    expect(buildSceneGraph(parseMotion(serializeProgram(ast))).tracks).toMatchObject([
      { id: 'main', role: 'main', muted: true },
      { id: 'titles', role: 'overlay', content: 'text' },
    ]);
  });

  it('round-trips an element layer assignment and edited timeline window', () => {
    const source = `
      track titles { role overlay content text }
      text title {
        value "Saved title"
        track titles
        start 1.25s
        duration 3.5s
      }
    `;
    const scene = buildSceneGraph(parseMotion(serializeProgram(parseMotion(source))));
    expect(scene.elements[0]?.properties).toMatchObject({
      track: 'titles',
      start: 1.25,
      duration: 3.5,
    });
  });

  it('preserves an asset alias named track and synthesizes legacy/default tracks', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        import "/track.svg" as track
        track { center }
        clip track {
          track 1
          start 0s
          duration 2s
        }
      `)
    );
    expect(scene.elements.some((element) => element.id === 'track')).toBe(true);
    expect(scene.tracks).toMatchObject([{ id: '1', role: 'main', declared: false }]);
  });

  it('rejects duplicate tracks, multiple main tracks, and invalid roles', () => {
    expect(() =>
      buildSceneGraph(parseMotion('track one { role overlay }\ntrack one { role overlay }'))
    ).toThrow(/Duplicate track/);
    expect(() =>
      buildSceneGraph(parseMotion('track one { role main }\ntrack two { role main }'))
    ).toThrow(/Only one main track/);
    expect(() => buildSceneGraph(parseMotion('track one { role captions }'))).toThrow(
      /unsupported role/
    );
  });

  it('uses track visibility, visual order, audio exclusion, and additive mute', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        track main { role main content primary order 0 }
        track hiddenOverlay { role overlay content image hidden order 1 }
        track upperOverlay { role overlay content image muted order 2 }
        track sound { role audio content audio order 3 }
        import "/main.svg" as mainAsset
        import "/hidden.svg" as hiddenAsset
        import "/upper.svg" as upperAsset
        import "/sound.svg" as soundAsset
        mainAsset { center }
        hiddenAsset { center }
        upperAsset { center }
        soundAsset { center }
        clip upperAsset { track upperOverlay start 0s duration 2s }
        clip mainAsset { track main start 0s duration 2s }
        clip hiddenAsset { track hiddenOverlay start 0s duration 2s }
        clip soundAsset { track sound start 0s duration 2s }
      `)
    );
    const evaluated = evaluateScene(scene, 1);
    expect(evaluated.elements.map((element) => element.assetName)).toEqual([
      'mainAsset',
      'upperAsset',
    ]);
    expect(evaluated.elements[1]?.render.mediaMuted).toBe(true);
  });
});

describe('project audio track binding', () => {
  it('uses a declared audio role for top-level audio without synthesizing legacy-audio', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        track soundtrack {
          role audio
          content audio
          muted
        }
        audio "/song.mp3" {
          start 1.5s
        }
      `)
    );
    expect(scene.tracks.filter((track) => track.role === 'audio')).toMatchObject([
      { id: 'soundtrack', muted: true, declared: true },
    ]);
    expect(scene.tracks.some((track) => track.id === 'legacy-audio')).toBe(false);
    expect(scene.audioStart).toBe(1.5);
    expect(
      buildSceneGraph(parseMotion(serializeProgram(parseMotion('audio "/legacy.mp3"')))).audioStart
    ).toBe(0);
  });
});
