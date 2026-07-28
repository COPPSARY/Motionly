import type { AudioCue } from './audio-clips';

/**
 * Drives one `<audio>` element per clip so the same file can play at several
 * places on the timeline at once, and overlapping clips are audible together.
 *
 * Scheduling decisions live in `audio-clips.ts`; this only applies them to the
 * DOM. Element volume is clamped to 0–1, so a clip cannot boost above source
 * level — the export path is capped the same way to keep preview honest.
 */
export interface AudioEngineOptions {
  /** Resolve an asset name to a playable URL, or undefined while it loads. */
  source: (assetName: string) => string | undefined;
  /** Silences everything without changing per-clip gain (track/global mute). */
  muted?: () => boolean;
  create?: () => HTMLAudioElement;
}

/** Correction threshold while playing; below this, drift is inaudible. */
const DRIFT_TOLERANCE = 0.25;

export class AudioEngine {
  private readonly elements = new Map<string, HTMLAudioElement>();
  private readonly sources = new Map<string, string>();
  private readonly options: AudioEngineOptions;
  private pending = new Set<HTMLAudioElement>();

  constructor(options: AudioEngineOptions) {
    this.options = options;
  }

  /**
   * Bring every clip's element in line with its cue. `playing` decides whether
   * active clips run or just sit at the right offset for scrubbing.
   */
  sync(cues: readonly AudioCue[], playing: boolean): void {
    const live = new Set<string>();
    const globallyMuted = this.options.muted?.() ?? false;

    for (const cue of cues) {
      const url = this.options.source(cue.assetName);
      if (!url) continue;
      live.add(cue.id);
      const element = this.elementFor(cue.id, url);

      const audible = cue.active && cue.gain > 0 && !globallyMuted;
      element.volume = Math.min(1, Math.max(0, cue.gain));
      element.playbackRate = cue.speed;
      // While stopped, park every element at its cue so starting playback
      // mid-clip is immediate. While playing, only touch what is audible.
      if (audible || !playing) this.seek(element, cue.sourceTime, playing && audible);
      if (audible && playing) this.play(element);
      else this.pause(element);
    }

    for (const [id, element] of this.elements) {
      if (live.has(id)) continue;
      this.pause(element);
      element.removeAttribute('src');
      this.elements.delete(id);
      this.sources.delete(id);
    }
  }

  /** Stop everything without discarding elements, so playback can resume. */
  pauseAll(): void {
    for (const element of this.elements.values()) this.pause(element);
  }

  dispose(): void {
    for (const element of this.elements.values()) {
      this.pause(element);
      element.removeAttribute('src');
    }
    this.elements.clear();
    this.sources.clear();
    this.pending.clear();
  }

  private elementFor(id: string, url: string): HTMLAudioElement {
    const existing = this.elements.get(id);
    if (existing && this.sources.get(id) === url) return existing;

    const element = existing ?? this.options.create?.() ?? new Audio();
    element.preload = 'auto';
    element.src = url;
    element.load();
    this.elements.set(id, element);
    this.sources.set(id, url);
    return element;
  }

  private seek(element: HTMLAudioElement, time: number, playing: boolean): void {
    const target = Math.max(0, time);
    // While playing the element advances on its own; correcting every frame
    // would stutter, so only pull it back when it has genuinely drifted.
    if (playing && Math.abs(element.currentTime - target) < DRIFT_TOLERANCE) return;
    try {
      element.currentTime = target;
    } catch {
      // Seeking before metadata arrives throws; the next sync will retry.
    }
  }

  private play(element: HTMLAudioElement): void {
    if (!element.paused || this.pending.has(element)) return;
    const started = element.play();
    if (!started) return;
    this.pending.add(element);
    void started
      .catch((error: unknown) => {
        // Autoplay is blocked until the page has been interacted with; the next
        // play attempt after a click succeeds.
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Audio playback was blocked:', message);
      })
      .finally(() => this.pending.delete(element));
  }

  private pause(element: HTMLAudioElement): void {
    if (element.paused) return;
    element.pause();
  }
}
