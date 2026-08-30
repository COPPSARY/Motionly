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

export function sceneHandoff(
  timeline: gsap.core.Timeline,
  outgoing: Target,
  incoming: Target,
  options: SceneHandoffOptions = {},
): gsap.core.Timeline {
  const direction = options.direction ?? "left";
  const distance = options.distance ?? 120;
  const duration = options.duration ?? 0.78;
  const incomingClip =
    direction === "left"
      ? "inset(0 0 0 100%)"
      : direction === "right"
        ? "inset(0 100% 0 0)"
        : direction === "up"
          ? "inset(100% 0 0 0)"
          : "inset(0 0 100% 0)";
  const outgoingClip =
    direction === "left"
      ? "inset(0 100% 0 0)"
      : direction === "right"
        ? "inset(0 0 0 100%)"
        : direction === "up"
          ? "inset(0 0 100% 0)"
          : "inset(100% 0 0 0)";
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const incomingOffset =
    direction === "left" || direction === "up" ? distance : -distance;
  const outgoingOffset = -incomingOffset * 0.42;
  const handoff = gsap.timeline();

  handoff
    .set(incoming, { autoAlpha: 1, zIndex: 2 }, 0)
    .set(outgoing, { zIndex: 1 }, 0)
    .fromTo(
      incoming,
      { clipPath: incomingClip, [axis]: incomingOffset, scale: 0.985 },
      {
        clipPath: "inset(0 0 0 0)",
        [axis]: 0,
        scale: 1,
        duration,
        ease: options.ease ?? "power3.inOut",
      },
      0,
    )
    .fromTo(
      outgoing,
      { clipPath: "inset(0 0 0 0)", [axis]: 0, scale: 1 },
      {
        clipPath: outgoingClip,
        [axis]: outgoingOffset,
        scale: 1.025,
        duration,
        ease: options.ease ?? "power3.inOut",
      },
      0,
    )
    .set(outgoing, {
      autoAlpha: 0,
      clipPath: "inset(0 0 0 0)",
      x: 0,
      y: 0,
      scale: 1,
      zIndex: 0,
    })
    .set(incoming, { zIndex: 1 });

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
  const value = element.textContent ?? "";
  const pieces = unit === "words" ? value.split(/(\s+)/) : Array.from(value);
  element.replaceChildren();
  return pieces.map((piece) => {
    const span = document.createElement("span");
    span.textContent = piece;
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
