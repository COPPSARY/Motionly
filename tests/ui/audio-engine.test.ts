import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../../src/ui/audio-engine';
import type { AudioCue } from '../../src/ui/audio-clips';

class FakeAudio {
  src = '';
  preload = '';
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  paused = true;
  loads = 0;
  plays = 0;

  load(): void {
    this.loads += 1;
  }
  play(): Promise<void> {
    this.plays += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  removeAttribute(): void {
    this.src = '';
  }
}

function engineWith(sources: Record<string, string>, muted = false) {
  const created: FakeAudio[] = [];
  const engine = new AudioEngine({
    source: (name) => sources[name],
    muted: () => muted,
    create: () => {
      const element = new FakeAudio();
      created.push(element);
      return element as unknown as HTMLAudioElement;
    },
  });
  return { engine, created };
}

const cue = (overrides: Partial<AudioCue> = {}): AudioCue => ({
  id: 'clip_music_0',
  assetName: 'music',
  active: true,
  sourceTime: 3,
  gain: 1,
  speed: 1,
  ...overrides,
});

describe('audio engine', () => {
  it('gives every clip its own element so one file can play twice at once', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ id: 'a' }), cue({ id: 'b', sourceTime: 8 })], true);

    expect(created).toHaveLength(2);
    expect(created[0]?.currentTime).toBe(3);
    expect(created[1]?.currentTime).toBe(8);
    expect(created.every((element) => element.plays === 1)).toBe(true);
  });

  it('applies gain and speed, and pauses a silent or inactive clip', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ gain: 0.25, speed: 1.5 })], true);
    expect(created[0]).toMatchObject({ volume: 0.25, playbackRate: 1.5, paused: false });

    engine.sync([cue({ gain: 0 })], true);
    expect(created[0]?.paused).toBe(true);

    engine.sync([cue({ active: false })], true);
    expect(created[0]?.paused).toBe(true);
  });

  it('never boosts past source level even when gain exceeds one', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ gain: 4 })], true);
    expect(created[0]?.volume).toBe(1);
  });

  it('parks elements at their cue while stopped and plays nothing', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ sourceTime: 12 })], false);
    expect(created[0]).toMatchObject({ currentTime: 12, paused: true, plays: 0 });
  });

  it('tolerates small drift while playing but corrects a real seek', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ sourceTime: 3 })], true);
    const element = created[0]!;

    element.currentTime = 3.1; // the element advanced on its own
    engine.sync([cue({ sourceTime: 3.15 })], true);
    expect(element.currentTime).toBe(3.1);

    engine.sync([cue({ sourceTime: 30 })], true);
    expect(element.currentTime).toBe(30);
  });

  it('silences everything when globally muted', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' }, true);
    engine.sync([cue()], true);
    expect(created[0]?.paused).toBe(true);
    expect(created[0]?.plays).toBe(0);
  });

  it('drops elements for clips that no longer exist', () => {
    const { engine, created } = engineWith({ music: 'music.mp3' });
    engine.sync([cue({ id: 'a' }), cue({ id: 'b' })], true);
    engine.sync([cue({ id: 'a' })], true);

    expect(created[1]?.paused).toBe(true);
    expect(created[1]?.src).toBe('');
    // The surviving clip keeps its element instead of being rebuilt.
    expect(created).toHaveLength(2);
    expect(created[0]?.loads).toBe(1);
  });

  it('skips clips whose asset has not loaded yet', () => {
    const { engine, created } = engineWith({});
    engine.sync([cue()], true);
    expect(created).toHaveLength(0);
  });
});
