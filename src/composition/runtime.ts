import gsap from "gsap";
import type {
  AnimationOverride,
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
  private readonly animationOverrides = new Map<
    string,
    Pick<AnimationOverride, "speed" | "ease">
  >();
  private readonly tweenBaselines = new WeakMap<
    gsap.core.Tween,
    { timeScale: number; ease: gsap.EaseString | gsap.EaseFunction | undefined }
  >();
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
        element: root,
        container: root,
        timeline: this.timeline,
        register: (first: unknown, second?: unknown) => {
          const targetId: string =
            typeof first === "string"
              ? first
              : typeof second === "string"
                ? second
                : "";
          const targetEl: HTMLElement | null =
            first && typeof first === "object" && "dataset" in first
              ? (first as HTMLElement)
              : second && typeof second === "object" && "dataset" in second
                ? (second as HTMLElement)
                : null;
          if (targetEl) {
            if (targetId) {
              targetEl.dataset["motionlyId"] = targetId;
              this.elements.set(targetId, targetEl);
            }
            return targetEl;
          }
          return (first as HTMLElement) || root;
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
    // A range input can issue many forward and reverse seeks before Play.
    // Re-render the exact current frame before unpausing so GSAP flushes every
    // nested timeline/set from that scrub position instead of resuming from a
    // partially evaluated lazy render.
    const resumeTime = this.time;
    this.timeline.pause();
    this.timeline.totalTime(resumeTime, false);
    this.applyOverrides();
    this.playing = true;
    this.timeline.reversed(false).paused(false);
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
    const frameTime = frame / this.definition.fps;
    this.timeline.pause();
    // GSAP set/from tweens can retain a later rendered value after a large
    // reverse jump. Re-render the origin first so every scene and child is
    // reconstructed from the authored timeline before applying the new frame.
    if (frameTime < this.timeline.totalTime()) {
      this.timeline.totalTime(0, false);
    }
    this.timeline.totalTime(frameTime, false);
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

  getAnimationOverride(id: string): AnimationOverride {
    const override = this.animationOverrides.get(id);
    return {
      speed: override?.speed ?? 1,
      ease: override?.ease ?? "power3.inOut",
      tweenCount: this.elementTweens(id).length,
    };
  }

  setAnimationOverride(
    id: string,
    patch: Partial<Pick<AnimationOverride, "speed" | "ease">>,
  ): void {
    const current = this.getAnimationOverride(id);
    const next = {
      speed: Math.max(0.25, Math.min(2, patch.speed ?? current.speed)),
      ease: patch.ease ?? current.ease,
    };
    this.animationOverrides.set(id, next);
    for (const tween of this.elementTweens(id)) {
      let baseline = this.tweenBaselines.get(tween);
      if (!baseline) {
        baseline = {
          timeScale: tween.timeScale(),
          ease: tween.vars.ease,
        };
        this.tweenBaselines.set(tween, baseline);
      }
      tween.timeScale(baseline.timeScale * next.speed);
      tween.vars.ease = next.ease;
      tween.invalidate();
    }
    this.seek(this.time);
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
      this.applyVisualOverride(element, override);
    }
  }

  private applyVisualOverride(
    element: HTMLElement,
    override: ElementOverride,
  ): void {
    // Editor transforms intentionally use the independent CSS transform
    // properties. GSAP keeps ownership of `transform`, so authored entrances,
    // camera moves, and exits continue to render after a visual edit.
    if (override.x !== undefined || override.y !== undefined) {
      element.style.translate = `${override.x ?? 0}px ${override.y ?? 0}px`;
    }
    if (override.scale !== undefined)
      element.style.scale = String(override.scale);
    if (override.rotation !== undefined)
      element.style.rotate = `${override.rotation}deg`;
    if (override.opacity !== undefined)
      element.style.opacity = String(override.opacity);
    if (override.color !== undefined) element.style.color = override.color;
    if (override.backgroundColor !== undefined)
      element.style.backgroundColor = override.backgroundColor;
    if (override.fill !== undefined) element.style.fill = override.fill;
    if (override.stroke !== undefined) element.style.stroke = override.stroke;
    if (override.fontSize !== undefined)
      element.style.fontSize = `${override.fontSize}px`;
    if (override.borderRadius !== undefined)
      element.style.borderRadius = `${override.borderRadius}px`;
    if (override.hidden !== undefined)
      element.style.visibility = override.hidden ? "hidden" : "";
  }

  private elementTweens(id: string): gsap.core.Tween[] {
    const element = this.elements.get(id);
    if (!element) return [];
    const targets = [element, ...Array.from(element.querySelectorAll("*"))];
    return Array.from(new Set(this.timeline.getTweensOf(targets))).filter(
      (tween) => tween.duration() > 0,
    );
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
