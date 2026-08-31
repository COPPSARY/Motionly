import gsap from "gsap";

export interface MotionOptions {
  at?: gsap.Position;
  duration?: number;
  ease?: string;
}

export interface SlideOptions extends MotionOptions {
  direction?: "up" | "right" | "down" | "left";
  distance?: number;
}

export interface StaggerOptions extends SlideOptions {
  stagger?: number;
}

export interface SceneHandoffOptions extends MotionOptions {
  direction?: "up" | "right" | "down" | "left";
  distance?: number;
}

export interface CameraZoomPanOptions extends MotionOptions {
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
}

export interface WaveOptions extends MotionOptions {
  totalDuration?: number;
  yOffset?: number;
  scaleXOffset?: number;
}

export interface GiantCropOptions extends MotionOptions {
  startScale?: number;
  endScale?: number;
  panX?: number;
}

type Target = gsap.TweenTarget;

export function reveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { autoAlpha: 0, y: 18 },
    {
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.55,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

export function slide(
  timeline: gsap.core.Timeline,
  target: Target,
  options: SlideOptions = {},
): gsap.core.Timeline {
  const distance = options.distance ?? 56;
  const from = {
    x:
      options.direction === "left"
        ? distance
        : options.direction === "right"
          ? -distance
          : 0,
    y:
      options.direction === "down"
        ? -distance
        : options.direction === "up"
          ? distance
          : 0,
    autoAlpha: 0,
  };
  return timeline.fromTo(
    target,
    from,
    {
      x: 0,
      y: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.68,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function scalePop(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { scale: 0.82, autoAlpha: 0 },
    {
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.62,
      ease: options.ease ?? "back.out(1.35)",
    },
    options.at,
  );
}

export function spring(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { y: 70, scale: 0.92 },
    {
      y: 0,
      scale: 1,
      duration: options.duration ?? 0.85,
      ease: options.ease ?? "elastic.out(1, .72)",
    },
    options.at,
  );
}

export function blurReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { filter: "blur(18px)", autoAlpha: 0, y: 24 },
    {
      filter: "blur(0px)",
      autoAlpha: 1,
      y: 0,
      duration: options.duration ?? 0.72,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

export function maskWipe(
  timeline: gsap.core.Timeline,
  target: Target,
  options: SlideOptions = {},
): gsap.core.Timeline {
  const direction = options.direction ?? "right";
  const hidden =
    direction === "left"
      ? "inset(0 0 0 100%)"
      : direction === "up"
        ? "inset(100% 0 0)"
        : direction === "down"
          ? "inset(0 0 100%)"
          : "inset(0 100% 0 0)";
  return timeline.fromTo(
    target,
    { clipPath: hidden },
    {
      clipPath: "inset(0 0 0 0)",
      duration: options.duration ?? 0.78,
      ease: options.ease ?? "expo.out",
    },
    options.at,
  );
}

export function gradientSweep(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { fromPosition?: string; toPosition?: string } = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { backgroundPosition: options.fromPosition ?? "200% 0" },
    {
      backgroundPosition: options.toPosition ?? "0% 0",
      duration: options.duration ?? 1.4,
      ease: options.ease ?? "power2.inOut",
    },
    options.at,
  );
}

export function rotateReveal(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    { rotation: -7, scale: 0.78, autoAlpha: 0 },
    {
      rotation: 0,
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.7,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function staggerEntrance(
  timeline: gsap.core.Timeline,
  targets: Target,
  options: StaggerOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    targets,
    { y: options.distance ?? 52, autoAlpha: 0, scale: 0.96 },
    {
      y: 0,
      autoAlpha: 1,
      scale: 1,
      duration: options.duration ?? 0.58,
      stagger: options.stagger ?? 0.09,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
}

export function staggerExit(
  timeline: gsap.core.Timeline,
  targets: Target,
  options: StaggerOptions = {},
): gsap.core.Timeline {
  return timeline.to(
    targets,
    {
      y: -(options.distance ?? 34),
      autoAlpha: 0,
      duration: options.duration ?? 0.42,
      stagger: options.stagger ?? 0.055,
      ease: options.ease ?? "power3.in",
    },
    options.at,
  );
}

export function cameraPush(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { scale?: number; x?: number; y?: number } = {},
): gsap.core.Timeline {
  return timeline.to(
    target,
    {
      scale: options.scale ?? 1.18,
      x: options.x ?? 0,
      y: options.y ?? 0,
      duration: options.duration ?? 1.35,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function cameraPull(
  timeline: gsap.core.Timeline,
  target: Target,
  options: MotionOptions & { scale?: number; x?: number; y?: number } = {},
): gsap.core.Timeline {
  return timeline.to(
    target,
    {
      scale: options.scale ?? 1,
      x: options.x ?? 0,
      y: options.y ?? 0,
      duration: options.duration ?? 1.25,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function cameraZoomPan(
  timeline: gsap.core.Timeline,
  target: Target,
  options: CameraZoomPanOptions = {},
): gsap.core.Timeline {
  return timeline.fromTo(
    target,
    {
      scale: options.startScale ?? 2.6,
      x: options.startX ?? 0,
      y: options.startY ?? 0,
      filter: "blur(12px)",
      autoAlpha: 0,
    },
    {
      scale: options.endScale ?? 1.0,
      x: options.endX ?? 0,
      y: options.endY ?? 0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: options.duration ?? 0.95,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
}

export function giantKineticCrop(
  timeline: gsap.core.Timeline,
  element: HTMLElement,
  options: GiantCropOptions = {},
): HTMLElement[] {
  const chars = splitText(element, "chars");
  const startScale = options.startScale ?? 2.8;
  const endScale = options.endScale ?? 1.0;
  const duration = options.duration ?? 0.88;

  timeline.fromTo(
    element,
    {
      scale: startScale,
      x: options.panX ?? 240,
      filter: "blur(14px)",
      autoAlpha: 0,
    },
    {
      scale: endScale,
      x: 0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );

  chars.forEach((char, i) => {
    const microOffset = i % 3 === 0 ? -16 : i % 3 === 1 ? 12 : -6;
    timeline.fromTo(
      char,
      { y: microOffset * 2.5, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: duration * 0.7,
        ease: "back.out(1.5)",
      },
      ((options.at as number) ?? 0) + i * 0.02,
    );
  });

  return chars;
}

export function ambientWaves(
  timeline: gsap.core.Timeline,
  waves: Target[],
  options: WaveOptions = {},
): gsap.core.Timeline {
  const totalDuration = options.totalDuration ?? 24;
  const at = options.at ?? 0;

  waves.forEach((wave, i) => {
    timeline.fromTo(
      wave,
      {
        y: (options.yOffset ?? -20) + i * 14,
        x: i % 2 === 0 ? -40 : 40,
        scaleX: options.scaleXOffset ?? 1.2,
        scaleY: 1.05,
        opacity: 0.32,
      },
      {
        y: (options.yOffset ?? -20) - i * 14,
        x: i % 2 === 0 ? 40 : -40,
        scaleX: (options.scaleXOffset ?? 1.2) * 1.08,
        scaleY: 1.12,
        opacity: 0.46,
        duration: totalDuration,
        ease: "sine.inOut",
      },
      at,
    );
  });

  return timeline;
}

export function sceneHandoff(
  timeline: gsap.core.Timeline,
  outgoing: Target,
  incoming: Target,
  options: SceneHandoffOptions = {},
): gsap.core.Timeline {
  const direction = options.direction ?? "left";
  const duration = options.duration ?? 0.82;
  const axis =
    direction === "left" || direction === "right" ? "xPercent" : "yPercent";
  const incomingOffset =
    direction === "left" || direction === "up" ? 100 : -100;
  const outgoingOffset = -incomingOffset * 0.18;
  const handoff = gsap.timeline();

  handoff
    .set(
      incoming,
      {
        autoAlpha: 1,
        zIndex: 2,
        [axis]: incomingOffset,
        scale: 1,
      },
      0,
    )
    .set(outgoing, { zIndex: 1, transformOrigin: "50% 50%" }, 0)
    .fromTo(
      incoming,
      {
        [axis]: incomingOffset,
        scale: 1,
      },
      {
        [axis]: 0,
        scale: 1,
        duration,
        ease: options.ease ?? "power3.inOut",
        immediateRender: false,
      },
      0,
    )
    .to(
      outgoing,
      {
        [axis]: outgoingOffset,
        scale: 1.035,
        duration,
        ease: options.ease ?? "power3.inOut",
      },
      0,
    )
    .set(outgoing, {
      autoAlpha: 0,
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      scale: 1,
      zIndex: 0,
    })
    .set(incoming, { xPercent: 0, yPercent: 0, zIndex: 1 });

  return timeline.add(handoff, options.at);
}

export function morph(
  timeline: gsap.core.Timeline,
  target: Target,
  styles: gsap.TweenVars,
  options: MotionOptions = {},
): gsap.core.Timeline {
  return timeline.to(
    target,
    {
      ...styles,
      duration: options.duration ?? 0.8,
      ease: options.ease ?? "power3.inOut",
    },
    options.at,
  );
}

export function splitText(
  element: HTMLElement,
  unit: "words" | "chars",
): HTMLElement[] {
  if (element.dataset["motionlySplitUnit"] === unit) {
    return Array.from(element.querySelectorAll(".motionly-split-item"));
  }

  const childElements = Array.from(element.children) as HTMLElement[];
  if (childElements.length > 0) {
    const allPieces: HTMLElement[] = [];
    childElements.forEach((child) => {
      const childPieces = splitText(child, unit);
      allPieces.push(...childPieces);
    });
    element.dataset["motionlySplitUnit"] = unit;
    return allPieces;
  }

  const value = element.textContent ?? "";
  const pieces = unit === "words" ? value.split(/(\s+)/) : Array.from(value);
  element.dataset["motionlySplitUnit"] = unit;
  element.replaceChildren();
  return pieces.map((piece) => {
    const span = document.createElement("span");
    span.textContent = piece;
    span.className = "motionly-split-item";
    span.style.display = piece.trim() ? "inline-block" : "inline";
    element.append(span);
    return span;
  });
}

export function textReveal(
  timeline: gsap.core.Timeline,
  element: HTMLElement,
  options: StaggerOptions & { unit?: "words" | "chars" } = {},
): HTMLElement[] {
  const pieces = splitText(element, options.unit ?? "words");
  timeline.fromTo(
    pieces,
    { yPercent: 115, rotateX: -24, autoAlpha: 0 },
    {
      yPercent: 0,
      rotateX: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.62,
      stagger: options.stagger ?? 0.045,
      ease: options.ease ?? "power4.out",
    },
    options.at,
  );
  return pieces;
}

export function wordSlideRotate(
  timeline: gsap.core.Timeline,
  element: HTMLElement,
  options: StaggerOptions & { rotation?: number } = {},
): HTMLElement[] {
  const words = splitText(element, "words");
  timeline.fromTo(
    words,
    {
      y: options.distance ?? 42,
      rotation: options.rotation ?? 4,
      autoAlpha: 0,
    },
    {
      y: 0,
      rotation: 0,
      autoAlpha: 1,
      duration: options.duration ?? 0.58,
      stagger: options.stagger ?? 0.045,
      ease: options.ease ?? "power3.out",
    },
    options.at,
  );
  return words;
}

export function charSpringBounce(
  timeline: gsap.core.Timeline,
  element: HTMLElement,
  options: StaggerOptions = {},
): HTMLElement[] {
  const chars = splitText(element, "chars");
  timeline.fromTo(
    chars,
    { y: options.distance ?? 30, scale: 0.82, autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: options.duration ?? 0.48,
      stagger: options.stagger ?? 0.025,
      ease: options.ease ?? "back.out(1.7)",
    },
    options.at,
  );
  return chars;
}
