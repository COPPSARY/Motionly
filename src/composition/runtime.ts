import gsap from "gsap";
import type {
  CompositionDefinition,
  ElementOverride,
  RuntimeSnapshot,
} from "./types";

export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

export class CompositionRuntime {
  readonly timeline: gsap.core.Timeline;
  readonly elements = new Map<string, HTMLElement>();
  private readonly context: gsap.Context;
  private readonly listeners = new Set<RuntimeListener>();
  private readonly overrides = new Map<string, ElementOverride>();
  private playing = false;
  private lastPlaybackNotification = 0;

  constructor(
    readonly definition: CompositionDefinition,
    readonly root: HTMLElement,
  ) {
    // Editor playback follows wall-clock time. Deterministic export and scrubbing
    // use explicit seeks, so silently slowing the live timeline after a heavy
    // render frame only makes the preview feel disconnected from its playhead.
    gsap.ticker.lagSmoothing(0);
    root.replaceChildren();
    root.classList.add("composition-root");
    root.style.width = `${definition.width}px`;
    root.style.height = `${definition.height}px`;
    this.timeline = gsap.timeline({
      paused: true,
      smoothChildTiming: true,
      onUpdate: () => {
        this.applyOverrides();
        this.emitPlaybackFrame();
      },
      onComplete: () => {
        this.playing = false;
        this.emit();
      },
    });
    this.context = gsap.context(() => {
      definition.build({
        root,
        timeline: this.timeline,
        register: (id, element) => {
          element.dataset["motionlyId"] = id;
          this.elements.set(id, element);
          return element;
        },
      });
      if (this.timeline.duration() < definition.duration) {
        this.timeline.to(
          {},
          { duration: definition.duration - this.timeline.duration() },
        );
      }
    }, root);
    this.seek(0);
  }

  play(): void {
    if (this.time >= this.definition.duration - 1 / this.definition.fps)
      this.seek(0);
    this.playing = true;
    this.timeline.play();
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.timeline.pause();
    this.emit();
  }

  restart(): void {
    this.playing = true;
    this.timeline.restart();
    this.emit();
  }

  seek(time: number): void {
    const frame = Math.round(
      Math.max(0, Math.min(this.definition.duration, time)) *
        this.definition.fps,
    );
    this.timeline.pause(frame / this.definition.fps, false);
    this.playing = false;
    this.applyOverrides();
    this.emit();
  }

  setOverride(id: string, patch: ElementOverride): void {
    this.overrides.set(id, { ...this.overrides.get(id), ...patch });
    this.applyOverrides();
    this.emit();
  }

  getOverride(id: string): ElementOverride {
    return { ...this.overrides.get(id) };
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.timeline.kill();
    this.context.revert();
    this.listeners.clear();
    this.elements.clear();
    this.root.replaceChildren();
    this.root.classList.remove("composition-root");
  }

  get time(): number {
    return Math.min(this.definition.duration, this.timeline.time());
  }

  get snapshot(): RuntimeSnapshot {
    const scene = [...this.definition.scenes]
      .reverse()
      .find((candidate) => this.time >= candidate.start);
    return {
      time: this.time,
      playing: this.playing,
      sceneId: scene?.id ?? this.definition.scenes[0]?.id ?? "",
    };
  }

  private applyOverrides(): void {
    for (const [id, override] of this.overrides) {
      const element = this.elements.get(id);
      if (!element) continue;
      if (override.text !== undefined)
        this.applyTextOverride(element, override.text);
      gsap.set(element, {
        x: override.x,
        y: override.y,
        scale: override.scale,
        rotation: override.rotation,
        opacity: override.opacity,
      });
    }
  }

  private applyTextOverride(element: HTMLElement, value: string): void {
    const unit = element.dataset["motionlySplitUnit"];
    if (unit !== "words" && unit !== "chars") {
      element.textContent = value;
      return;
    }

    const pieces = unit === "words" ? value.split(/(\s+)/) : Array.from(value);
    const spans = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (!spans.length) {
      element.textContent = value;
      return;
    }

    spans.forEach((span, index) => {
      span.textContent = pieces[index] ?? "";
    });
    if (pieces.length > spans.length) {
      const tail = pieces.slice(spans.length).join("");
      const last = spans.at(-1);
      if (last) last.textContent = `${last.textContent ?? ""}${tail}`;
    }
  }

  private emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  private emitPlaybackFrame(): void {
    const now = globalThis.performance?.now() ?? Date.now();
    if (now - this.lastPlaybackNotification < 40) return;
    this.lastPlaybackNotification = now;
    this.emit();
  }
}
