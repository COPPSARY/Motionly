import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { migrateLegacyAudioNode } from '../../src/ui/legacy-audio';

const legacy = `canvas { size 1920x1080 fps 30 duration 12s background #000000 }
audio "./music.mp3" { start 2s }
text title { value "Hello" center }`;

describe('legacy audio projects', () => {
  it('reads a legacy audio node as an ordinary audio clip', () => {
    const scene = buildSceneGraph(parseMotion(legacy));
    const audio = scene.clips.filter((clip) => clip.asset?.type === 'audio');

    expect(audio).toHaveLength(1);
    expect(audio[0]).toMatchObject({ start: 2, duration: 10, volume: 1, fadeIn: 0, speed: 1 });
    expect(scene.imports.some((asset) => asset.path === './music.mp3')).toBe(true);
    // It must land on an audio-role track so the timeline groups it correctly.
    const track = scene.tracks.find((item) => item.id === String(audio[0]!.track));
    expect(track?.role).toBe('audio');
  });

  it('rewrites the node into an import and a clip that survive a round trip', () => {
    const program = parseMotion(legacy);
    expect(migrateLegacyAudioNode(program, { canvasDuration: 12 })).toEqual({
      name: 'audio',
      track: 'legacy-audio',
    });

    const source = serializeProgram(program);
    expect(source).toContain('import "./music.mp3" as audio');
    expect(source).not.toContain('audio "./music.mp3"');

    const scene = buildSceneGraph(parseMotion(source));
    const clip = scene.clips.find((item) => item.asset?.type === 'audio');
    expect(clip).toMatchObject({ assetName: 'audio', start: 2, duration: 10 });
  });

  it('prefers the decoded source length over filling the project', () => {
    const program = parseMotion(legacy);
    migrateLegacyAudioNode(program, { canvasDuration: 12, sourceDuration: 3.5 });
    expect(serializeProgram(program)).toContain('duration 3.500s');
  });

  it('reuses a declared audio track and avoids clashing import names', () => {
    const program = parseMotion(`canvas { size 1920x1080 fps 30 duration 8s background #000 }
track score { role audio content audio label "Score" }
import "./logo.png" as audio
audio "./music.mp3"`);
    expect(migrateLegacyAudioNode(program, { canvasDuration: 8 })).toEqual({
      name: 'audio_2',
      track: 'score',
    });
  });

  it('accepts the audio track the editor declares when a clip is dropped', () => {
    // The editor writes this shape via ensureLayerTrack. An audio-role track
    // with any other content throws, so a mismatch here breaks the whole editor.
    const scene = buildSceneGraph(
      parseMotion(`canvas { size 1920x1080 fps 30 duration 8s background #000 }
track legacy-audio { label "Audio" role audio content audio hidden false muted false order 1 }
import "./music.mp3" as music
clip music { track legacy-audio start 0s duration 8s }`)
    );
    const track = scene.tracks.find((item) => item.id === 'legacy-audio');
    expect(track).toMatchObject({ role: 'audio', content: 'audio', declared: true });
    expect(scene.clips[0]?.asset?.type).toBe('audio');
  });

  it('does nothing to a project that already uses audio clips', () => {
    const program = parseMotion(`canvas { size 1920x1080 fps 30 duration 8s background #000 }
import "./music.mp3" as music
clip music { track legacy-audio start 0s duration 8s }`);
    expect(migrateLegacyAudioNode(program, { canvasDuration: 8 })).toBeNull();
  });
});
