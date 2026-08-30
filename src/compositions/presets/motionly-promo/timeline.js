import gsap from "gsap";
import {
  blurReveal,
  maskWipe,
  slide,
  staggerEntrance,
  textReveal,
} from "../../../composition/presets";

function registerAll(context) {
  context.root.querySelectorAll("[data-edit]").forEach((element) => {
    const id = element.dataset.edit;
    if (id) context.register(id, element);
  });
}

function target(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing promo element: ${selector}`);
  return element;
}

export function buildPromoTimeline(context) {
  registerAll(context);
  const { root, timeline } = context;
  const intro = target(root, ".intro-scene");
  const codeScene = target(root, ".code-scene");
  const studioScene = target(root, ".studio-scene");
  const labScene = target(root, ".lab-scene");
  const ctaScene = target(root, ".cta-scene");
  const product = target(root, ".product-stage");
  const token = target(root, ".brand-token");
  const codeView = target(root, ".code-view");
  const studioView = target(root, ".studio-view");
  const labView = target(root, ".lab-view");
  const speedPanel = target(root, ".speed-panel");
  const introOne = target(root, ".intro-one");
  const introTwo = target(root, ".intro-two");
  const introThree = target(root, ".intro-three");

  timeline.set(
    [codeScene, studioScene, labScene, ctaScene, product, speedPanel],
    { autoAlpha: 0 },
    0,
  );
  timeline.set(
    [codeView, studioView, labView, token],
    { autoAlpha: 0 },
    0,
  );
  timeline.to(
    target(root, ".world"),
    { x: -54, y: 30, scale: 1.07, duration: 27, ease: "none" },
    0,
  );
  timeline.to(
    target(root, ".grid"),
    { backgroundPosition: "52px 26px", duration: 27, ease: "none" },
    0,
  );

  const introTl = gsap.timeline();
  const introOneWords = textReveal(
    introTl,
    target(root, ".everything-word"),
    {
      unit: "words",
      duration: 0.62,
      stagger: 0.055,
      at: 0.12,
    },
  );
  introTl.fromTo(
    target(root, ".everything-word"),
    { scale: 0.94, filter: "blur(10px)" },
    { scale: 1, filter: "blur(0px)", duration: 0.82, ease: "power3.out" },
    0.04,
  );
  introTl.fromTo(
    target(root, ".one-place"),
    { yPercent: 120, autoAlpha: 0 },
    { yPercent: 0, autoAlpha: 1, duration: 0.68, ease: "power4.out" },
    0.82,
  );
  introTl.to(
    introOneWords,
    {
      y: -28,
      scale: 0.9,
      filter: "blur(10px)",
      autoAlpha: 0,
      duration: 0.68,
      stagger: 0.025,
      ease: "power3.inOut",
    },
    1.72,
  );
  introTl.to(
    target(root, ".one-place"),
    {
      y: -24,
      scale: 0.9,
      filter: "blur(10px)",
      autoAlpha: 0,
      duration: 0.66,
      ease: "power3.inOut",
    },
    1.78,
  );
  introTl.set(introOne, { autoAlpha: 0 }, 2.38);
  introTl.set(introTwo, { autoAlpha: 1 }, 1.84);
  const introTwoWords = textReveal(
    introTl,
    target(root, "[data-edit='manifesto-web-line']"),
    { unit: "words", duration: 0.58, stagger: 0.05, at: 1.94 },
  );
  introTl.fromTo(
    target(root, "[data-edit='manifesto-direct']"),
    { yPercent: 120, autoAlpha: 0 },
    { yPercent: 0, autoAlpha: 1, duration: 0.64, ease: "power4.out" },
    2.54,
  );
  introTl.to(
    introTwoWords,
    {
      x: -42,
      scale: 0.9,
      filter: "blur(10px)",
      autoAlpha: 0,
      duration: 0.68,
      stagger: 0.03,
      ease: "power3.inOut",
    },
    3.46,
  );
  introTl.to(
    target(root, "[data-edit='manifesto-direct']"),
    {
      x: 42,
      scale: 0.9,
      filter: "blur(10px)",
      autoAlpha: 0,
      duration: 0.68,
      ease: "power3.inOut",
    },
    3.5,
  );
  introTl.set(introTwo, { autoAlpha: 0 }, 4.08);
  introTl.set(introThree, { autoAlpha: 1 }, 3.58);
  const introThreeWords = textReveal(
    introTl,
    target(root, "[data-edit='manifesto-stack-line']"),
    { unit: "words", duration: 0.58, stagger: 0.07, at: 3.68 },
  );
  introTl.fromTo(
    target(root, "[data-edit='manifesto-timeline']"),
    { yPercent: 120, autoAlpha: 0 },
    { yPercent: 0, autoAlpha: 1, duration: 0.64, ease: "power4.out" },
    4.34,
  );
  introTl.to(
    introThreeWords,
    {
      y: -18,
      scale: 0.88,
      filter: "blur(11px)",
      autoAlpha: 0,
      duration: 0.76,
      stagger: 0.035,
      ease: "power3.inOut",
    },
    5.42,
  );
  introTl.to(
    target(root, "[data-edit='manifesto-timeline']"),
    {
      y: 18,
      scale: 1.12,
      filter: "blur(12px)",
      autoAlpha: 0,
      duration: 0.8,
      ease: "power3.inOut",
    },
    5.38,
  );
  timeline.add(introTl, 0);

  timeline.set(codeScene, { autoAlpha: 1 }, 5.72);
  timeline.fromTo(
    product,
    {
      y: 54,
      scale: 0.7,
      filter: "blur(14px)",
      clipPath: "inset(12% 5% 12% 5% round 0px)",
      autoAlpha: 0,
    },
    {
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      clipPath: "inset(0% 0% 0% 0% round 0px)",
      autoAlpha: 1,
      duration: 1.16,
      ease: "power3.inOut",
    },
    5.62,
  );
  timeline.set(intro, { autoAlpha: 0 }, 6.42);

  const codeTl = gsap.timeline();
  codeTl.set(codeView, { autoAlpha: 1 }, 0);
  codeTl.set(target(root, ".code-card"), { x: 448, scale: 1.02 }, 0);
  maskWipe(codeTl, target(root, ".code-card"), {
    direction: "right",
    duration: 0.7,
    at: 0.08,
  });
  codeTl.from(
    root.querySelectorAll(".code-line"),
    { y: 20, autoAlpha: 0, duration: 0.4, stagger: 0.07, ease: "power3.out" },
    0.36,
  );
  codeTl.to(
    target(root, ".code-scan"),
    { y: 320, duration: 1.3, ease: "power2.inOut" },
    0.62,
  );
  codeTl.to(
    target(root, ".code-card"),
    { x: 0, scale: 0.92, duration: 0.82, ease: "power3.inOut" },
    0.86,
  );
  codeTl.fromTo(
    target(root, ".compile-rail"),
    { scaleX: 0.2, autoAlpha: 0 },
    { scaleX: 1, autoAlpha: 1, duration: 0.42, ease: "power3.out" },
    1.2,
  );
  codeTl.to(
    target(root, ".compile-rail span"),
    { width: "100%", duration: 0.82, ease: "expo.inOut" },
    1.38,
  );
  codeTl.fromTo(
    target(root, ".live-card"),
    { x: 72, scale: 0.97, autoAlpha: 0 },
    { x: 0, scale: 1, autoAlpha: 1, duration: 0.72, ease: "power4.out" },
    1.24,
  );
  maskWipe(codeTl, target(root, ".visual-hero"), {
    direction: "up",
    duration: 0.64,
    at: 1.28,
  });
  textReveal(codeTl, target(root, ".visual-title"), {
    unit: "words",
    duration: 0.5,
    stagger: 0.035,
    at: 1.36,
  });
  textReveal(codeTl, target(root, ".visual-subtitle"), {
    unit: "chars",
    duration: 0.5,
    stagger: 0.028,
    at: 1.46,
  });
  codeTl.from(
    root.querySelectorAll(".live-head > *"),
    { y: 10, autoAlpha: 0, duration: 0.4, stagger: 0.07, ease: "power3.out" },
    1.3,
  );
  staggerEntrance(codeTl, root.querySelectorAll(".metric"), {
    distance: 42,
    duration: 0.54,
    stagger: 0.08,
    at: 1.52,
  });
  codeTl.from(
    root.querySelectorAll(".metric b, .metric span"),
    { y: 9, autoAlpha: 0, duration: 0.36, stagger: 0.035, ease: "power3.out" },
    1.66,
  );
  codeTl.to(
    root.querySelectorAll(".metric"),
    {
      y: (index) => (index === 1 ? -12 : -5),
      borderColor: (index) => (index === 1 ? "#8b6cffaa" : "#4a4653"),
      duration: 0.56,
      stagger: 0.08,
      ease: "power3.inOut",
    },
    2.36,
  );
  codeTl.to(
    target(root, ".visual-hero strong"),
    { scale: 1.06, duration: 1.05, ease: "power3.inOut" },
    2.58,
  );
  codeTl.to(
    product,
    { x: -82, scale: 1.07, duration: 1.0, ease: "power3.inOut" },
    2.86,
  );
  codeTl.to(
    target(root, ".code-card"),
    { x: -110, scale: 0.95, autoAlpha: 0, duration: 0.76, ease: "power3.inOut" },
    4.22,
  );
  codeTl.to(
    target(root, ".live-card"),
    {
      x: -180,
      scale: 1.28,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.82,
      ease: "power3.inOut",
    },
    4.22,
  );
  timeline.add(codeTl, 5.72);

  timeline.set(
    speedPanel,
    { autoAlpha: 0, scale: 1.035 },
    10.08,
  );
  timeline.to(
    product,
    { x: 0, scale: 1.025, duration: 0.9, ease: "power3.inOut" },
    10.2,
  );
  timeline.to(
    speedPanel,
    { autoAlpha: 1, scale: 1, duration: 0.68, ease: "power3.inOut" },
    10.16,
  );
  timeline.fromTo(
    target(root, ".speed-copy"),
    { y: 30, scale: 0.95, filter: "blur(9px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.68,
      ease: "power4.out",
    },
    10.24,
  );
  timeline.to(
    target(root, ".speed-copy"),
    {
      y: -20,
      scale: 0.84,
      filter: "blur(12px)",
      autoAlpha: 0,
      duration: 0.76,
      ease: "power3.inOut",
    },
    11.08,
  );

  timeline.set(
    studioView,
    { scale: 1.055, filter: "blur(11px)", autoAlpha: 1 },
    11.3,
  );
  timeline.to(
    studioView,
    {
      scale: 1,
      filter: "blur(0px)",
      duration: 0.82,
      ease: "power3.inOut",
    },
    11.3,
  );
  timeline.to(
    speedPanel,
    {
      scale: 0.94,
      filter: "blur(10px)",
      autoAlpha: 0,
      duration: 0.64,
      ease: "power3.inOut",
    },
    11.08,
  );
  timeline.to(
    codeView,
    {
      scale: 0.96,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.62,
      ease: "power3.inOut",
    },
    11.12,
  );
  timeline.to(
    codeScene,
    { x: -46, autoAlpha: 0, duration: 0.38, ease: "power3.in" },
    11.46,
  );
  timeline.to(
    product,
    { x: 0, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "power3.inOut" },
    11.28,
  );
  timeline.set(studioScene, { autoAlpha: 1 }, 11.46);

  const studioTl = gsap.timeline();
  studioTl.fromTo(
    target(root, ".editability-field"),
    { y: 34, scale: 0.94, filter: "blur(12px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.76,
      ease: "power4.out",
    },
    0.1,
  );
  textReveal(studioTl, target(root, ".editable-lead"), {
    unit: "words",
    duration: 0.54,
    stagger: 0.04,
    at: 0.18,
  });
  textReveal(studioTl, target(root, ".editable-word"), {
    unit: "words",
    duration: 0.58,
    stagger: 0.04,
    at: 0.32,
  });
  studioTl.from(
    root.querySelectorAll(".editable-proof span"),
    { y: 18, autoAlpha: 0, duration: 0.48, stagger: 0.08, ease: "power3.out" },
    0.74,
  );
  studioTl.to(
    target(root, ".editable-lead"),
    { x: -24, duration: 0.72, ease: "power3.inOut" },
    1.72,
  );
  studioTl.to(
    target(root, ".editable-word"),
    { x: 24, scale: 1.06, backgroundPosition: "100% 50%", duration: 0.72, ease: "power3.inOut" },
    1.72,
  );
  studioTl.to(
    root.querySelectorAll(".editable-proof span"),
    {
      color: (index) => (index === 1 ? "#f6f5f1" : "#85808e"),
      borderColor: (index) => (index === 1 ? "#5eead488" : "#393542"),
      backgroundColor: (index) => (index === 1 ? "#14231f" : "#111018"),
      duration: 0.54,
      ease: "power2.inOut",
    },
    2.12,
  );
  studioTl.to(
    target(root, ".editability-field"),
    { scale: 1.1, x: -52, duration: 1.08, ease: "power3.inOut" },
    2.46,
  );
  studioTl.to(
    root.querySelectorAll(".editable-proof span"),
    {
      color: (index) => (index === 2 ? "#f6f5f1" : "#85808e"),
      borderColor: (index) => (index === 2 ? "#d8ff5588" : "#393542"),
      backgroundColor: (index) => (index === 2 ? "#1c2214" : "#111018"),
      duration: 0.54,
      ease: "power2.inOut",
    },
    3.18,
  );
  studioTl.to(
    target(root, ".editability-field"),
    { scale: 0.9, filter: "blur(10px)", autoAlpha: 0, duration: 0.82, ease: "power3.inOut" },
    4.0,
  );
  timeline.add(studioTl, 11.12);

  timeline.set(
    labView,
    { xPercent: 9, scale: 1.035, filter: "blur(7px)", autoAlpha: 0 },
    15.18,
  );
  timeline.to(
    product,
    { x: 0, y: 0, scale: 1, duration: 0.88, ease: "power3.inOut" },
    15.14,
  );
  timeline.to(
    labView,
    {
      xPercent: 0,
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.68,
      ease: "power3.inOut",
    },
    15.18,
  );
  timeline.to(
    studioView,
    {
      xPercent: -8,
      scale: 0.97,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.68,
      ease: "power3.inOut",
    },
    15.22,
  );
  timeline.to(
    studioScene,
    { x: -46, autoAlpha: 0, duration: 0.4, ease: "power3.in" },
    15.72,
  );
  timeline.set(labScene, { autoAlpha: 1 }, 15.32);

  const labTl = gsap.timeline();
  textReveal(labTl, target(root, ".lab-copy [data-edit='lab-one']"), {
    unit: "words",
    duration: 0.58,
    stagger: 0.04,
    at: 0.2,
  });
  textReveal(labTl, target(root, ".lab-copy [data-edit='lab-timeline']"), {
    unit: "words",
    duration: 0.62,
    stagger: 0.04,
    at: 0.34,
  });
  labTl.from(
    target(root, ".signal-card"),
    { y: 52, rotationY: -14, autoAlpha: 0, duration: 0.72, ease: "power4.out" },
    0.22,
  );
  const signalPath = target(root, ".signal path");
  const length =
    typeof signalPath.getTotalLength === "function"
      ? signalPath.getTotalLength()
      : 720;
  labTl.set(
    signalPath,
    { strokeDasharray: length, strokeDashoffset: length },
    0.24,
  );
  labTl.from(
    root.querySelectorAll(".signal-card header > *"),
    { y: 10, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: "power3.out" },
    0.46,
  );
  labTl.to(
    signalPath,
    { strokeDashoffset: 0, duration: 1.38, ease: "power2.inOut" },
    0.38,
  );
  staggerEntrance(labTl, root.querySelectorAll(".layer-card"), {
    distance: 64,
    duration: 0.62,
    stagger: 0.09,
    at: 0.86,
  });
  slide(labTl, target(root, ".export-dock"), {
    direction: "left",
    distance: 58,
    duration: 0.66,
    at: 1.46,
  });
  labTl.from(
    root.querySelectorAll(".export-dock h3, .export-facts span"),
    { y: 9, autoAlpha: 0, duration: 0.38, stagger: 0.045, ease: "power3.out" },
    1.68,
  );
  labTl.to(
    target(root, ".export-progress i"),
    { width: "100%", duration: 2.0, ease: "power2.inOut" },
    1.72,
  );
  labTl.to(
    product,
    { scale: 1.04, x: -38, duration: 1.25, ease: "power3.inOut" },
    1.76,
  );
  labTl.to(
    root.querySelectorAll(".layer-card"),
    {
      y: (index) => [-22, 16, -12][index] ?? 0,
      rotation: (index) => [-2, 2, -1][index] ?? 0,
      duration: 1.16,
      stagger: 0.055,
      ease: "power2.inOut",
    },
    2.92,
  );
  labTl.to(
    target(root, ".signal-card"),
    { x: -48, y: 20, scale: 1.06, duration: 0.78, ease: "power3.inOut" },
    3.0,
  );
  timeline.add(labTl, 15.22);

  timeline.set(ctaScene, { autoAlpha: 1 }, 20.95);
  timeline.set(
    token,
    { x: -16, y: 198, scale: 0.74, rotation: 0, autoAlpha: 0 },
    20.95,
  );
  timeline.to(
    labScene,
    { x: -48, autoAlpha: 0, duration: 0.42, ease: "power3.in" },
    20.96,
  );
  timeline.to(
    product,
    {
      x: 570,
      y: 12,
      scale: 0.38,
      filter: "blur(12px)",
      autoAlpha: 0,
      duration: 1.0,
      ease: "power3.inOut",
    },
    20.98,
  );
  timeline.to(
    token,
    {
      x: -16,
      y: 198,
      scale: 1.05,
      rotation: 3,
      autoAlpha: 1,
      duration: 1.0,
      ease: "power3.inOut",
    },
    20.96,
  );

  const ctaTl = gsap.timeline();
  slide(ctaTl, target(root, ".final-index"), {
    direction: "right",
    distance: 36,
    at: 0.08,
  });
  root.querySelectorAll(".final-copy h2 span").forEach((line, index) =>
    textReveal(ctaTl, line, {
      unit: "chars",
      duration: 0.64,
      stagger: 0.034,
      at: 0.2 + index * 0.14,
    }),
  );
  blurReveal(ctaTl, target(root, ".final-subtitle"), {
    duration: 0.6,
    at: 0.84,
  });
  slide(ctaTl, target(root, ".final-cta"), {
    direction: "up",
    distance: 32,
    duration: 0.56,
    at: 1.12,
  });
  staggerEntrance(ctaTl, root.querySelectorAll(".final-chip"), {
    distance: 28,
    duration: 0.5,
    stagger: 0.085,
    at: 1.02,
  });
  ctaTl.to(
    root.querySelectorAll(".final-chip"),
    {
      rotation: (index) => [-2, 2, -1][index] ?? 0,
      duration: 1.25,
      stagger: 0.055,
      ease: "power2.inOut",
    },
    1.45,
  );
  ctaTl.to(token, { scale: 1.1, duration: 1.25, ease: "power3.inOut" }, 2.28);
  ctaTl.to(
    target(root, ".final-cta"),
    { x: 9, backgroundColor: "#d8ff55", duration: 0.66, ease: "power2.inOut" },
    3.36,
  );
  timeline.add(ctaTl, 20.98);
}
