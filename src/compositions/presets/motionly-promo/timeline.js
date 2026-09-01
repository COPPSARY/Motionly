import gsap from "gsap";
import {
  ambientWaves,
  blurReveal,
  charSpringBounce,
  continuousTextGradient,
  gradientSweep,
  morph,
  textReveal,
  wordSlideRotate,
} from "../../../composition/presets";
import { MOTIONLY_PROMO_TIME_SCALE } from "./timing";

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
  const { root, timeline: callerTimeline } = context;
  const timeline = gsap.timeline();
  timeline.timeScale(MOTIONLY_PROMO_TIME_SCALE);
  callerTimeline.add(timeline, 0);

  // Background layers & dynamic lighting
  const world = target(root, "[data-edit='world']");
  const wittyBgCurtain = target(root, "[data-edit='witty-bg-curtain']");
  const burnRedFlash = target(root, "[data-edit='burn-red-flash']");
  const grid = target(root, ".grid");
  const ambient = target(root, "[data-edit='ambient-gradient']");
  const auroraA = target(root, ".aurora-a");
  const auroraB = target(root, ".aurora-b");
  const auroraC = target(root, "[data-edit='aurora-c']");
  const ambientBurst = target(root, "[data-edit='ambient-burst']");

  // Ambient fluid waves
  const wave1 = target(root, ".wave-1");
  const wave2 = target(root, ".wave-2");
  const wave3 = target(root, ".wave-3");

  // Floating Rising Cost Parallax Arrows (Beat 3)
  const costArrowsStage = target(root, "[data-edit='cost-arrows-stage']");
  const arrow1 = target(root, "[data-edit='arrow-1']");
  const arrow2 = target(root, "[data-edit='arrow-2']");
  const arrow3 = target(root, "[data-edit='arrow-3']");
  const arrow4 = target(root, "[data-edit='arrow-4']");
  const arrow5 = target(root, "[data-edit='arrow-5']");

  // Problem liquid glass morph frame & bespoke morph faces
  const problemMorphFrame = target(root, "[data-edit='problem-morph-frame']");
  const coinInnerDetails = target(root, "[data-edit='coin-inner-details']");
  const coinContentLockup = target(root, "[data-edit='coin-content-lockup']");
  const coinPriceText = target(root, "[data-edit='coin-price-text']");
  const coinPriceDigits = target(root, "[data-edit='coin-price-digits']");
  const dollarPath = target(root, ".dollar-path");

  // 3D Mystery Box Elements
  const boxInnerDetails = target(root, "[data-edit='box-inner-details']");
  const box3dSvg = target(root, "[data-edit='box-3d-svg']");
  const boxLidGroup = target(root, "[data-edit='box-lid-group']");
  const boxScanBeam = target(root, "[data-edit='box-scan-beam']");
  const failureStage = target(root, "[data-edit='failure-stage']");
  const failureChips = Array.from(root.querySelectorAll(".failure-chip"));
  const failureRipples = Array.from(root.querySelectorAll(".failure-ripple"));
  const failureParticles = Array.from(
    root.querySelectorAll(".failure-particle"),
  );

  // Dedicated Post-Text Credit Burn Scene (Pure Typography, Zero Cards)
  const creditBurnStage = target(root, "[data-edit='credit-burn-stage']");
  const burnCounter = target(root, "[data-edit='burn-counter']");
  const burnFire = target(root, "[data-edit='burn-fire']");

  // Editorial Beats
  const beat1 = target(root, "[data-edit='editorial-beat-1']");
  const beat2 = target(root, "[data-edit='editorial-beat-2']");
  const beat3 = target(root, "[data-edit='editorial-beat-3']");
  const beat4 = target(root, "[data-edit='editorial-beat-4']");
  const beat5a = target(root, "[data-edit='editorial-beat-5a']");
  const beat5b = target(root, "[data-edit='editorial-beat-5b']");
  const beat6 = target(root, "[data-edit='editorial-beat-6']");
  const solBeat2 = target(root, "[data-edit='editorial-sol-2']");
  const beatSeriously = target(root, "[data-edit='editorial-seriously']");
  const beatUiPromise = target(root, "[data-edit='editorial-ui-promise']");
  const beatOr = target(root, "[data-edit='editorial-or']");
  const beatKeepPrompting = target(
    root,
    "[data-edit='editorial-keep-prompting']",
  );

  const editorialBeats = [
    beat1,
    beat2,
    beat3,
    beat4,
    beat5a,
    beat5b,
    beat6,
    solBeat2,
    beatSeriously,
    beatUiPromise,
    beatOr,
    beatKeepPrompting,
  ];

  // 100% Single Continuous Hero Intro & Sentence Element
  const introHeroBeat = target(root, "[data-edit='intro-hero-beat']");
  const introAccentStage = target(root, "[data-edit='intro-accent-stage']");
  const introAccentRings = Array.from(
    root.querySelectorAll(".intro-accent-ring"),
  );
  const introAccentLines = Array.from(
    root.querySelectorAll(".intro-accent-line"),
  );
  const introAccentParticles = Array.from(
    root.querySelectorAll(".intro-accent-particle"),
  );
  const introLogoBox = target(root, "[data-edit='intro-logo-box']");
  const introLogoOuter = target(root, ".intro-logo-outer");
  const introLogoInner = target(root, ".intro-logo-inner");
  const introWordPrefix = target(root, "[data-edit='intro-word-prefix']");
  const introBrandName = target(root, "[data-edit='intro-brand-name']");
  const introRestStatement = target(root, "[data-edit='intro-rest-statement']");

  // Persistent Hero Morph Object: Prompt Pill ➔ Product Window ➔ Brand Token
  const morphShell = target(root, "[data-edit='morph-shell']");
  const facePrompt = target(root, "[data-edit='face-prompt']");
  const promptText = target(root, "[data-edit='build-question']");
  const promptFill = target(root, ".prompt-fill");
  const typingCaret = target(root, ".typing-caret");
  const generateButton = target(root, ".generate-button");
  const productScreenshot = target(root, "[data-edit='product-screenshot']");
  const faceBrandToken = target(root, "[data-edit='face-brand-token']");
  const logoOuter = target(root, ".logo-outer-path");
  const logoInner = target(root, ".logo-inner-path");

  // Outro CTA Scene
  const ctaScene = target(root, ".cta-scene");
  const ctaContent = target(root, ".cta-content");
  const finalHeadline = target(root, "[data-edit='final-headline']");
  const finalCta = target(root, "[data-edit='final-cta']");

  // ── Initial State at 0s (Strict Mathematical Centering) ──

  timeline.set(
    [
      ctaScene,
      morphShell,
      introHeroBeat,
      introAccentStage,
      problemMorphFrame,
      coinInnerDetails,
      boxInnerDetails,
      failureStage,
      wittyBgCurtain,
      burnRedFlash,
      creditBurnStage,
      costArrowsStage,
    ],
    { autoAlpha: 0 },
    0,
  );
  timeline.set(coinContentLockup, { gap: 0 }, 0);
  timeline.set(coinPriceText, { autoAlpha: 0, width: 0, display: "none" }, 0);
  timeline.set(
    introRestStatement,
    { autoAlpha: 0, width: 0, display: "none" },
    0,
  );
  timeline.set(
    [ctaContent, introHeroBeat, creditBurnStage],
    { xPercent: -50, yPercent: -50 },
    0,
  );

  editorialBeats.forEach((beat) => {
    timeline.set(beat, { xPercent: -50, yPercent: -50, autoAlpha: 0, x: 0 }, 0);
  });

  timeline.set(beat1, { autoAlpha: 1, scale: 1.5 }, 0);

  timeline.set(
    morphShell,
    {
      left: 350,
      top: 421,
      width: 1220,
      height: 210,
      borderRadius: "28px",
      background: "rgba(252, 252, 250, 0.96)",
      transformOrigin: "50% 50%",
    },
    0,
  );

  timeline.set(facePrompt, { autoAlpha: 0 }, 0);
  timeline.set(productScreenshot, { autoAlpha: 0 }, 0);
  timeline.set(faceBrandToken, { autoAlpha: 0 }, 0);

  // ── Ambient Background & Wave Motion (39s Deterministic) ──

  timeline.to(
    world,
    { x: -44, y: 24, scale: 1.045, duration: 39, ease: "none" },
    0,
  );
  timeline.to(
    grid,
    { backgroundPosition: "96px 48px", duration: 39, ease: "none" },
    0,
  );
  timeline.to(
    ambient,
    { rotation: 9, scale: 1.04, duration: 39, ease: "none" },
    0,
  );
  timeline.fromTo(
    auroraA,
    { x: -130, y: 90, scale: 0.84, rotation: -8 },
    {
      x: 220,
      y: -110,
      scale: 1.15,
      rotation: 22,
      duration: 39,
      ease: "sine.inOut",
    },
    0,
  );
  timeline.fromTo(
    auroraB,
    { x: 110, y: -70, scale: 1.08, rotation: 10 },
    {
      x: -220,
      y: 150,
      scale: 0.85,
      rotation: -24,
      duration: 39,
      ease: "sine.inOut",
    },
    0,
  );

  // Ambient fluid waves animation
  ambientWaves(timeline, [wave1, wave2, wave3], {
    totalDuration: 39,
    yOffset: -30,
    scaleXOffset: 1.3,
    at: 0,
  });

  // ── ACT 1: THE PROBLEM ──

  // Liquid Glass Frame forms around Beat 1
  timeline.set(problemMorphFrame, { autoAlpha: 1 }, 0.04);
  timeline.fromTo(
    problemMorphFrame,
    {
      width: 1480,
      height: 240,
      scale: 0.88,
      filter: "blur(12px)",
      autoAlpha: 0,
    },
    {
      width: 1360,
      height: 200,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.65,
      ease: "power3.out",
    },
    0.04,
  );

  // Beat 1: "Startups need great launch videos."
  timeline.fromTo(
    beat1,
    { scale: 1.8, filter: "blur(12px)", autoAlpha: 0 },
    {
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.75,
      ease: "back.out(1.35)",
    },
    0.04,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-beat-1'] .editorial-text"),
    {
      duration: 0.46,
      stagger: 0.05,
      rotation: 3,
      ease: "back.out(1.35)",
      at: 0.08,
    },
  );
  continuousTextGradient(
    target(root, "[data-edit='editorial-beat-1'] .sentence-gradient"),
  );

  // Exit 1: Slide Up smoothly
  timeline.to(
    beat1,
    {
      y: -65,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.4,
      ease: "power3.inOut",
    },
    1.35,
  );

  // Shape Morph 1: Liquid glass frame morphs to 1120px
  timeline.to(
    problemMorphFrame,
    {
      width: 1120,
      height: 150,
      borderRadius: "32px",
      duration: 0.45,
      ease: "power3.inOut",
    },
    1.4,
  );

  // Beat 2: "But making them is way too hard." + Warning Coral Aurora
  timeline.to(
    auroraC,
    { autoAlpha: 0.7, scale: 1.2, duration: 0.8, ease: "power2.out" },
    1.75,
  );
  timeline.set(beat2, { autoAlpha: 1 }, 1.75);
  timeline.fromTo(
    beat2,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.55,
      ease: "power4.out",
    },
    1.75,
  );
  charSpringBounce(
    timeline,
    target(root, "[data-edit='editorial-beat-2'] .editorial-text"),
    {
      duration: 0.42,
      stagger: 0.02,
      at: 1.8,
    },
  );

  // Exit 2: Slide Up
  timeline.to(
    beat2,
    {
      y: -65,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.4,
      ease: "power3.inOut",
    },
    2.75,
  );

  // Shape Morph 2: Liquid glass frame morphs to 1220px for Beat 3
  timeline.to(
    problemMorphFrame,
    {
      width: 1220,
      height: 150,
      borderRadius: "32px",
      duration: 0.45,
      ease: "power3.inOut",
    },
    2.8,
  );

  // Beat 3: editorial thought morphs into a coin, then an explicit agency quote.

  // 1. Text plays first cleanly inside the frame (3.0s – 3.9s)
  timeline.set(beat3, { autoAlpha: 1 }, 3.0);
  timeline.fromTo(
    beat3,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.55,
      ease: "power4.out",
    },
    3.0,
  );
  textReveal(
    timeline,
    target(root, "[data-edit='editorial-beat-3'] .editorial-text"),
    {
      unit: "words",
      duration: 0.42,
      stagger: 0.04,
      at: 3.05,
    },
  );

  // Text exits at 3.9s
  timeline.to(
    beat3,
    {
      y: -50,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.32,
      ease: "power3.in",
    },
    3.9,
  );

  // Floating Rising Cost Parallax Arrows activate (3.85s – 6.4s)
  timeline.set(costArrowsStage, { autoAlpha: 1 }, 3.85);
  timeline.fromTo(
    arrow1,
    { y: 60, scale: 0.6, autoAlpha: 0, rotation: -12 },
    {
      y: -160,
      scale: 1.05,
      autoAlpha: 0.85,
      rotation: 6,
      duration: 2.6,
      ease: "power1.out",
    },
    3.85,
  );
  timeline.fromTo(
    arrow2,
    { y: 80, scale: 0.7, autoAlpha: 0, rotation: 10 },
    {
      y: -200,
      scale: 1.15,
      autoAlpha: 0.9,
      rotation: -8,
      duration: 2.75,
      ease: "power1.out",
    },
    3.95,
  );
  timeline.fromTo(
    arrow3,
    { y: 50, scale: 0.5, autoAlpha: 0 },
    { y: -130, scale: 0.9, autoAlpha: 0.5, duration: 2.8, ease: "power1.out" },
    3.9,
  );
  timeline.fromTo(
    arrow4,
    { y: 70, scale: 0.6, autoAlpha: 0 },
    {
      y: -150,
      scale: 0.95,
      autoAlpha: 0.55,
      duration: 2.65,
      ease: "power1.out",
    },
    4.0,
  );
  timeline.fromTo(
    arrow5,
    { y: 90, scale: 0.4, autoAlpha: 0 },
    { y: -170, scale: 0.8, autoAlpha: 0.4, duration: 2.9, ease: "power1.out" },
    4.1,
  );

  // 2. CONTINUOUS MORPH: Frame -> Gold & Emerald Currency Coin ONLY (No 3D Spin, Pure Clean 2D Morph)
  timeline.to(
    problemMorphFrame,
    {
      width: 150,
      height: 150,
      borderRadius: "50%",
      rotationY: 0,
      rotationX: 0,
      background:
        "radial-gradient(135% 100% at 50% 0%, #FFD700 0%, #FF9500 48%, #38EF7D 100%)",
      borderColor: "rgba(255, 255, 255, 0.95)",
      boxShadow: "0 28px 70px rgba(255, 140, 0, 0.55)",
      duration: 0.6,
      ease: "power3.inOut",
    },
    3.95,
  );

  timeline.set(coinInnerDetails, { autoAlpha: 1 }, 4.25);
  timeline.fromTo(
    coinInnerDetails,
    { autoAlpha: 0, scale: 0.6 },
    { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" },
    4.25,
  );
  timeline.to(
    dollarPath,
    { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" },
    4.3,
  );

  // 3. GENEROUS 1-SECOND HOLD ON JUST THE CURRENCY COIN ICON ($) (Holds from 4.2s to 5.2s with gentle breath)
  timeline.to(
    problemMorphFrame,
    { scale: 1.05, duration: 0.85, ease: "sine.inOut" },
    4.35,
  );

  // After one second, expand into the agency quote and count up to $1,000+.
  timeline.to(
    problemMorphFrame,
    {
      width: 600,
      borderRadius: "75px",
      rotationY: 0,
      duration: 0.55,
      ease: "back.out(1.4)",
    },
    5.2,
  );
  timeline.to(
    coinContentLockup,
    { gap: 16, duration: 0.45, ease: "power3.out" },
    5.2,
  );

  timeline.set(
    coinPriceText,
    { display: "flex", autoAlpha: 1, width: "auto" },
    5.25,
  );
  timeline.fromTo(
    coinPriceText,
    { scale: 0.6, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.35, ease: "back.out(1.6)" },
    5.25,
  );

  const priceObj = { val: 250 };
  timeline.to(
    priceObj,
    {
      val: 1000,
      duration: 0.52,
      ease: "power2.out",
      onUpdate: () => {
        coinPriceDigits.textContent = `$${Math.round(priceObj.val).toLocaleString()}+`;
      },
    },
    5.28,
  );

  // Hold on the completed quote until 6.6s.
  timeline.to(
    coinPriceText,
    { scale: 1.01, duration: 0.75, ease: "sine.inOut" },
    5.75,
  );

  // Smoothly fade out rising arrows as transition approaches
  timeline.to(
    costArrowsStage,
    { autoAlpha: 0, duration: 0.45, ease: "power2.in" },
    6.25,
  );

  // 6. DIRECT ZERO-SPIN MORPH BACK TO RECTANGLE FRAME (6.6s – 7.7s)
  timeline.to(
    coinInnerDetails,
    { autoAlpha: 0, scale: 0.5, duration: 0.35, ease: "power2.in" },
    6.55,
  );
  timeline.set(coinContentLockup, { gap: 0 }, 6.9);
  timeline.set(coinPriceText, { display: "none" }, 6.9);
  timeline.to(
    problemMorphFrame,
    {
      scale: 1.0,
      width: 1280,
      height: 150,
      borderRadius: "32px",
      rotationY: 0, // NO SPIN, DIRECT SHAPE MORPH
      rotationX: 0,
      background:
        "radial-gradient(135% 100% at 50% 0%, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.12) 100%)",
      borderColor: "rgba(255, 255, 255, 0.75)",
      boxShadow: "0 30px 80px rgba(17, 19, 24, 0.06)",
      duration: 1.1,
      ease: "power3.out",
    },
    6.6,
  );

  // ── BEAT 4: "Current AI video tools are a mystery box." ➔ 3D ISOMETRIC HOLOGRAPHIC UNBOXING ──

  timeline.set(beat4, { autoAlpha: 1 }, 7.75);
  timeline.fromTo(
    beat4,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.58,
      ease: "power4.out",
    },
    7.75,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-beat-4'] .editorial-text"),
    {
      duration: 0.42,
      stagger: 0.035,
      rotation: -2,
      at: 7.8,
    },
  );

  // Text exits at 8.7s
  timeline.to(
    beat4,
    {
      y: -50,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.32,
      ease: "power3.in",
    },
    8.7,
  );

  // 7. BESPOKE MORPH: Frame -> 3D Isometric Holographic Mystery Box (8.75s – 9.95s)
  timeline.to(
    problemMorphFrame,
    {
      width: 170,
      height: 170,
      borderRadius: "32px",
      background:
        "radial-gradient(135% 100% at 50% 0%, #7657FF 0%, #4B2CBF 50%, #5CE0D0 100%)",
      borderColor: "rgba(255, 255, 255, 0.95)",
      boxShadow: "0 28px 70px rgba(118, 87, 255, 0.55)",
      duration: 0.65,
      ease: "power3.inOut",
    },
    8.75,
  );

  timeline.set(boxInnerDetails, { autoAlpha: 1 }, 9.1);
  timeline.fromTo(
    boxInnerDetails,
    { autoAlpha: 0, scale: 0.6 },
    { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" },
    9.1,
  );

  // 3D tilt
  timeline.to(
    problemMorphFrame,
    {
      scale: 1.45,
      rotationX: 18,
      rotationY: -22,
      duration: 0.85,
      ease: "power2.out",
    },
    9.2,
  );

  // 3D Box LID POPS OPEN!
  timeline.to(
    boxLidGroup,
    {
      y: -26,
      rotationX: -35,
      duration: 0.45,
      ease: "back.out(1.8)",
    },
    9.3,
  );

  timeline.set(failureStage, { autoAlpha: 1 }, 9.2);

  failureRipples.forEach((ripple, index) => {
    timeline.fromTo(
      ripple,
      { scale: 0.45, rotation: -12 + index * 12, autoAlpha: 0.65 },
      {
        scale: 5.2,
        rotation: 18 + index * 16,
        autoAlpha: 0,
        duration: 1.45,
        ease: "power2.out",
      },
      9.2 + index * 0.17,
    );
  });

  const particleDestinations = [
    [-540, -260],
    [500, -220],
    [-430, 240],
    [480, 200],
    [-200, -390],
    [180, -420],
    [-650, 40],
    [650, 20],
  ];
  failureParticles.forEach((particle, index) => {
    const [x = 0, y = 0] = particleDestinations[index] ?? [];
    timeline.fromTo(
      particle,
      { x: 0, y: 0, scale: 0.2, autoAlpha: 0 },
      { x, y, scale: 1, autoAlpha: 0.72, duration: 1.35, ease: "power2.out" },
      9.22 + index * 0.045,
    );
    timeline.to(
      particle,
      {
        x: x * 1.35,
        y: y * 1.35,
        scale: 0.25,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power2.in",
      },
      10.35 + index * 0.025,
    );
  });

  // Laser scanner sweeps across the box
  timeline.fromTo(
    boxScanBeam,
    { autoAlpha: 0, y: 10 },
    {
      autoAlpha: 1,
      y: -10,
      duration: 0.5,
      repeat: 1,
      yoyo: true,
      ease: "sine.inOut",
    },
    9.4,
  );

  // Motion-design failures burst from one source, then physically disperse.
  const chipDestinations = [
    { x: -340, y: -155, rotation: -7 },
    { x: 245, y: -265, rotation: 6 },
    { x: 285, y: 95, rotation: -3 },
  ];
  failureChips.forEach((chip, index) => {
    const destination = chipDestinations[index];
    timeline.fromTo(
      chip,
      { x: -70, y: 24, scale: 0.35, autoAlpha: 0, rotation: 0 },
      {
        ...destination,
        scale: 1,
        autoAlpha: 1,
        duration: 0.72,
        ease: "back.out(1.55)",
      },
      9.3 + index * 0.18,
    );
    timeline.to(
      chip,
      {
        x: (destination?.x ?? 0) * 1.75,
        y: (destination?.y ?? 0) - 145,
        rotation: (destination?.rotation ?? 0) * 2.2,
        scale: 0.55,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.in",
      },
      10.22 + index * 0.06,
    );
  });

  // Box snaps shut with tension
  timeline.to(
    boxLidGroup,
    { y: 0, rotationX: 0, duration: 0.25, ease: "power3.in" },
    10.15,
  );

  // Dissolve mystery box cleanly
  timeline.to(
    [boxInnerDetails, problemMorphFrame],
    {
      scale: 0.2,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power2.in",
    },
    10.3,
  );
  timeline.to(failureStage, { autoAlpha: 0, duration: 0.25 }, 11.15);

  // ── BEAT 5A (Strictly Centered): "You can't edit anything." ──

  // ── BEAT 5A (Strictly Centered): "You can't edit anything." ➔ KINETIC ZOOM OUT + CHAR SPRING WAVE (NO SLIDE UP) ──

  timeline.set(beat5a, { autoAlpha: 1, x: 0, y: 0 }, 10.45);
  timeline.fromTo(
    beat5a,
    { scale: 1.85, filter: "blur(14px)", autoAlpha: 0, y: 0 },
    {
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      y: 0,
      duration: 0.65,
      ease: "power3.out",
    },
    10.45,
  );
  charSpringBounce(
    timeline,
    target(root, "[data-edit='editorial-beat-5a'] .editorial-text"),
    {
      duration: 0.48,
      stagger: 0.025,
      distance: 28,
      at: 10.5,
    },
  );

  // Exit 5A: Pure Kinetic Zoom-Out Dissolve (Zero Slide Up!)
  timeline.to(
    beat5a,
    {
      scale: 0.85,
      filter: "blur(10px)",
      autoAlpha: 0,
      y: 0,
      duration: 0.35,
      ease: "power2.in",
    },
    11.55,
  );

  // ── BEAT 5B (Strictly Centered): "You need to reprompt." ──

  timeline.set(beat5b, { autoAlpha: 1 }, 11.8);
  timeline.fromTo(
    beat5b,
    { y: 55, scale: 0.92, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.55,
      ease: "power4.out",
    },
    11.8,
  );
  charSpringBounce(
    timeline,
    target(root, "[data-edit='editorial-beat-5b'] .editorial-text"),
    {
      duration: 0.42,
      stagger: 0.02,
      at: 11.85,
    },
  );

  // Exit 5B: Slide Up
  timeline.to(
    beat5b,
    {
      y: -50,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.35,
      ease: "power3.inOut",
    },
    12.9,
  );

  // ── BEAT 6 (Strictly Centered Clean Text): "Wasting hours and burning credits." ──

  timeline.set(beat6, { autoAlpha: 1 }, 13.15);
  timeline.fromTo(
    beat6,
    { y: 55, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.58,
      ease: "power4.out",
    },
    13.15,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-beat-6'] .editorial-text"),
    {
      duration: 0.44,
      stagger: 0.04,
      rotation: -3,
      at: 13.2,
    },
  );

  // Exit Beat 6 Text cleanly before the credit burn animation!
  timeline.to(
    beat6,
    {
      y: -50,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.35,
      ease: "power3.inOut",
    },
    14.1,
  );

  // ── DEDICATED POST-TEXT CREDIT BURN MOMENT (PURE TYPOGRAPHY, ROCK-SOLID WIDTH, ZERO CARDS) ──

  timeline.set(creditBurnStage, { autoAlpha: 1 }, 14.25);
  timeline.fromTo(
    creditBurnStage,
    { scale: 0.75, filter: "blur(10px)", autoAlpha: 0 },
    {
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.45,
      ease: "back.out(1.5)",
    },
    14.25,
  );

  // Dynamic rapid credit burn countdown: 500 -> 320 -> 90 -> 0! (Fixed width ensures zero text wobble!)
  const creditObj = { val: 500 };
  timeline.to(
    creditObj,
    {
      val: 0,
      duration: 0.8,
      ease: "power2.in",
      onUpdate: () => {
        burnCounter.textContent = `${Math.round(creditObj.val)}`;
      },
    },
    14.35,
  );

  // Fire flare and pulse as credits hit zero!
  timeline.to(
    burnFire,
    {
      scale: 1.6,
      rotation: 18,
      duration: 0.28,
      yoyo: true,
      repeat: 1,
      ease: "back.out(2.0)",
    },
    15.0,
  );

  // SUBTLE RED SCREEN FLASH as credits hit zero!
  timeline.set(burnRedFlash, { autoAlpha: 1 }, 15.0);
  timeline.fromTo(
    burnRedFlash,
    { autoAlpha: 0, scale: 0.85 },
    { autoAlpha: 0.85, scale: 1.25, duration: 0.22, ease: "power2.out" },
    15.0,
  );
  timeline.to(
    burnRedFlash,
    { autoAlpha: 0, duration: 0.45, ease: "power2.in" },
    15.22,
  );

  // ── GENEROUS 1.0-SECOND PAUSE/HOLD ON "⚡ 0 CREDITS 🔥" (from 15.0s to 16.1s so the punchline lands!) ──
  timeline.to(
    creditBurnStage,
    { scale: 1.03, duration: 1.1, ease: "sine.inOut" },
    15.0,
  );

  // Dissolve credit burn scene cleanly into radiant ambient burst
  timeline.to(
    creditBurnStage,
    {
      y: -50,
      filter: "blur(14px)",
      autoAlpha: 0,
      duration: 0.42,
      ease: "power3.in",
    },
    16.1,
  );

  // ── ACT 2: RADIANT AMBIENT LIGHT ACCENT ➔ SOLID INK "INTRODUCING MOTIONLY" ──

  timeline.fromTo(
    ambientBurst,
    { autoAlpha: 0, scale: 0.5 },
    { autoAlpha: 0.85, scale: 2.8, duration: 0.75, ease: "power3.out" },
    16.25,
  );
  timeline.to(
    ambientBurst,
    { autoAlpha: 0, duration: 0.9, ease: "power2.inOut" },
    17.0,
  );

  timeline.set(introAccentStage, { autoAlpha: 1 }, 16.35);
  timeline.fromTo(
    introAccentRings,
    { scale: 0.45, rotation: -12, autoAlpha: 0 },
    {
      scale: 1,
      rotation: 0,
      autoAlpha: 0.65,
      duration: 1.15,
      stagger: 0.14,
      ease: "power3.out",
    },
    16.35,
  );
  timeline.to(
    introAccentRings,
    {
      scale: 1.24,
      rotation: 8,
      duration: 6.8,
      stagger: 0.12,
      ease: "none",
    },
    16.9,
  );
  timeline.to(
    introAccentRings,
    {
      y: (index) => (index % 2 === 0 ? -18 : 14),
      duration: 2.7,
      stagger: 0.14,
      repeat: 1,
      yoyo: true,
      ease: "sine.inOut",
    },
    16.55,
  );
  timeline.fromTo(
    introAccentLines,
    { scaleX: 0.25, autoAlpha: 0 },
    {
      scaleX: 1,
      autoAlpha: 0.7,
      duration: 1.1,
      stagger: 0.18,
      ease: "power3.out",
    },
    16.6,
  );
  timeline.to(
    introAccentLines,
    { rotation: "+=10", scaleX: 1.08, duration: 6.4, ease: "none" },
    17.1,
  );
  timeline.fromTo(
    introAccentParticles,
    { y: 18, scale: 0.55, autoAlpha: 0 },
    {
      y: (index) => (index % 2 === 0 ? -24 : -10),
      x: (index) => ((index % 3) - 1) * 14,
      scale: 1,
      autoAlpha: 0.55,
      duration: 2.8,
      stagger: 0.16,
      repeat: 1,
      yoyo: true,
      ease: "sine.inOut",
    },
    16.7,
  );

  // Step 1: "Introducing" enters MASSIVE (scale: 4.8, x: 260) and PAUSES on screen in CRISP SOLID INK!
  timeline.set(introHeroBeat, { autoAlpha: 1, x: 0, y: 0 }, 16.45);
  timeline.fromTo(
    introHeroBeat,
    { scale: 4.8, x: 260, filter: "blur(14px)", autoAlpha: 0 },
    {
      scale: 4.8,
      x: 260,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.65,
      ease: "power4.out",
    },
    16.45,
  );

  // PAUSE ON BIG "INTRODUCING" for 1.1s so the user digests it completely!
  timeline.to(
    introHeroBeat,
    { scale: 4.85, duration: 1.1, ease: "sine.inOut" },
    16.45,
  );

  // Step 2: SLOW, GLORIOUS CINEMATIC ZOOM OUT & PAN (1.7s duration) pulling back to scale: 1.0, x: 0
  timeline.to(
    introHeroBeat,
    {
      scale: 1.0,
      x: 0,
      duration: 1.7,
      ease: "power3.inOut",
    },
    17.55,
  );

  // Live SVG logo path draw as camera pulls back into full view
  timeline.to(
    introLogoOuter,
    { strokeDashoffset: 0, duration: 0.78, ease: "power3.inOut" },
    18.1,
  );
  timeline.to(
    introLogoInner,
    { strokeDashoffset: 0, duration: 0.62, ease: "power3.inOut" },
    18.35,
  );

  // Radiant brand shimmer sweeps across "Motionly." and settles to solid ink
  gradientSweep(timeline, introBrandName, {
    fromPosition: "200% 0",
    toPosition: "0% 0",
    duration: 1.4,
    at: 18.2,
  });

  // Step 3: PAUSE & HOLD ON COMPLETED TITLE in centered glory (1.0s hold)
  timeline.to(
    introHeroBeat,
    { scale: 1.02, duration: 1.0, ease: "sine.inOut" },
    19.25,
  );

  // ── ACT 3: BIG "Motionly." (SCALE: 1.0 AT 86px) ➔ SLIDE LEFT ➔ CAMERA DRIFT PAN ACROSS GIANT TEXT ──

  // 1. Logo and "Introducing" collapse their width & slide upward (The exact same "Motionly." is in dead center!)
  timeline.to(
    [introLogoBox, introWordPrefix],
    {
      y: -40,
      width: 0,
      autoAlpha: 0,
      duration: 0.48,
      ease: "power3.inOut",
    },
    20.25,
  );

  // 2. Center hold on big "Motionly." in the middle of the screen (1.35s hold!)
  timeline.to(
    introBrandName,
    { scale: 1.05, duration: 1.35, ease: "sine.inOut" },
    20.3,
  );

  // 3. Keep text BIG (86px)! Slide "Motionly." left, reveal "delivers on-demand launch videos.", and camera-pan!
  timeline.set(
    introRestStatement,
    { display: "inline-block", autoAlpha: 1 },
    21.65,
  );
  timeline.fromTo(
    introRestStatement,
    { width: 0, x: 60, autoAlpha: 0 },
    { width: "auto", x: 0, autoAlpha: 1, duration: 0.65, ease: "power4.out" },
    21.65,
  );
  wordSlideRotate(timeline, introRestStatement, {
    duration: 0.46,
    stagger: 0.045,
    rotation: 3,
    at: 21.75,
  });

  // Smooth cinematic camera pan drift so the entire big sentence is framed and read comfortably!
  timeline.fromTo(
    introHeroBeat,
    { x: 0 },
    { x: -360, duration: 1.6, ease: "power2.inOut" },
    21.65,
  );

  // Exit Solution 1: Whole giant sentence slides up smoothly
  timeline.to(
    introHeroBeat,
    {
      y: -65,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.42,
      ease: "power3.inOut",
    },
    23.75,
  );
  timeline.to(
    introAccentStage,
    { scale: 1.08, autoAlpha: 0, duration: 0.48, ease: "power2.in" },
    23.55,
  );

  // ── Solution 2: "Prompt like AI. Edit every layer." (Solid Ink Text, Zero Gradient Washout!) ──
  timeline.set(solBeat2, { autoAlpha: 1 }, 24.0);
  timeline.fromTo(
    solBeat2,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    {
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.6,
      ease: "power4.out",
    },
    24.0,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-sol-2'] .editorial-text"),
    {
      duration: 0.46,
      stagger: 0.045,
      rotation: 2,
      at: 24.05,
    },
  );

  // Exit Solution 2: Slide Up
  timeline.to(
    solBeat2,
    {
      y: -65,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.38,
      ease: "power3.inOut",
    },
    25.6,
  );

  // ── BACKGROUND COLOR MORPH ON "Seriously." (Fresh Mint / Emerald Wash) ──
  timeline.set(wittyBgCurtain, { autoAlpha: 1 }, 25.75);
  timeline.fromTo(
    wittyBgCurtain,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: 0.65, ease: "power2.inOut" },
    25.75,
  );

  // ── Beat: "Seriously." (Solid bold ink text, NO GRADIENT, dead center punch!) ──
  timeline.set(beatSeriously, { autoAlpha: 1 }, 25.85);
  timeline.fromTo(
    beatSeriously,
    { scale: 1.4, filter: "blur(12px)", autoAlpha: 0 },
    {
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.52,
      ease: "back.out(1.5)",
    },
    25.85,
  );

  // Exit "Seriously."
  timeline.to(
    beatSeriously,
    {
      y: -55,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.35,
      ease: "power3.inOut",
    },
    27.1,
  );

  // ── Beat: "We have a UI for you to edit everything." (Solid bold text) ──
  timeline.set(beatUiPromise, { autoAlpha: 1 }, 27.35);
  timeline.fromTo(
    beatUiPromise,
    { x: 150, y: 0, scale: 2.15, filter: "blur(12px)", autoAlpha: 0 },
    {
      x: 0,
      y: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.68,
      ease: "back.out(1.35)",
    },
    27.35,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-ui-promise'] .editorial-text"),
    {
      duration: 0.42,
      stagger: 0.038,
      rotation: 2,
      ease: "back.out(1.35)",
      at: 27.4,
    },
  );

  // Exit "We have a UI for you to edit everything."
  timeline.to(
    beatUiPromise,
    {
      y: -65,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.38,
      ease: "power3.inOut",
    },
    28.8,
  );

  // ── Beat: "Or..." (Solid bold text, cheeky short pause) ──
  timeline.set(beatOr, { autoAlpha: 1 }, 29.0);
  timeline.fromTo(
    beatOr,
    { x: 120, scale: 2.35, filter: "blur(12px)", autoAlpha: 0 },
    {
      x: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.58,
      ease: "back.out(1.4)",
    },
    29.0,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-or'] .editorial-text"),
    {
      duration: 0.42,
      stagger: 0.05,
      distance: 28,
      ease: "back.out(1.35)",
      at: 29.04,
    },
  );

  // Exit "Or..."
  timeline.to(
    beatOr,
    {
      y: -50,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.32,
      ease: "power3.inOut",
    },
    29.85,
  );

  // ── Beat: "...keep prompting." ➔ PHYSICAL SEAMLESS MORPH INTO PROMPT PILL ──

  timeline.set(beatKeepPrompting, { autoAlpha: 1 }, 30.1);
  timeline.fromTo(
    beatKeepPrompting,
    { x: 140, scale: 2.2, filter: "blur(12px)", autoAlpha: 0 },
    {
      x: 0,
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.62,
      ease: "back.out(1.4)",
    },
    30.1,
  );
  wordSlideRotate(
    timeline,
    target(root, "[data-edit='editorial-keep-prompting'] .editorial-text"),
    {
      duration: 0.44,
      stagger: 0.045,
      distance: 30,
      ease: "back.out(1.35)",
      at: 30.14,
    },
  );

  // At 30.8s: The text "...keep prompting." physically collapses as the Prompt Pill capsule forms around it!
  timeline.to(
    beatKeepPrompting,
    {
      scale: 0.7,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.35,
      ease: "power3.in",
    },
    30.9,
  );
  timeline.to(
    wittyBgCurtain,
    { autoAlpha: 0, duration: 0.45, ease: "power2.in" },
    30.9,
  );

  // ── ACT 4: PROMPT PILL ➔ PRODUCT WINDOW WORKSPACE MORPH ──

  // Prompt Pill expands smoothly from center directly around where "...keep prompting." stood!
  timeline.set(morphShell, { autoAlpha: 1 }, 30.95);
  timeline.fromTo(
    morphShell,
    {
      left: 600,
      top: 495,
      width: 720,
      height: 110,
      borderRadius: "28px",
      scale: 0.85,
      filter: "blur(10px)",
      autoAlpha: 0,
    },
    {
      left: 350,
      top: 421,
      width: 1220,
      height: 210,
      borderRadius: "28px",
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.55,
      ease: "power4.out",
    },
    30.95,
  );

  timeline.set(facePrompt, { autoAlpha: 1 }, 31.2);
  timeline.fromTo(
    facePrompt,
    { autoAlpha: 0, filter: "blur(6px)" },
    { autoAlpha: 1, filter: "blur(0px)", duration: 0.32, ease: "power4.out" },
    31.2,
  );

  // A restrained camera push follows the typing, then settles before the morph.
  timeline.to(
    morphShell,
    { scale: 1.12, duration: 0.9, ease: "power2.inOut" },
    31.2,
  );

  // Typing caret blinks
  timeline.fromTo(
    typingCaret,
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration: 0.18,
      repeat: 3,
      yoyo: true,
      ease: "power2.inOut",
    },
    31.35,
  );

  // Character typing: "Create a 20-second launch film for our product"
  textReveal(timeline, promptText, {
    unit: "chars",
    duration: 0.09,
    stagger: 0.015,
    at: 31.4,
  });

  // Prompt fill sweep & tactile button click
  timeline.to(
    promptFill,
    { scaleX: 1, duration: 0.4, ease: "power3.inOut" },
    32.3,
  );
  timeline.to(
    generateButton,
    { scale: 0.93, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" },
    32.3,
  );
  // Prompt Pill expands directly into dark Product Window
  timeline.to(
    facePrompt,
    {
      y: -16,
      filter: "blur(8px)",
      autoAlpha: 0,
      duration: 0.32,
      ease: "power3.in",
    },
    32.75,
  );

  // Morph Shape: Pill expands into 1728x960 Dark Workspace
  morph(
    timeline,
    morphShell,
    {
      left: 96,
      top: 60,
      width: 1728,
      height: 960,
      borderRadius: "34px",
      background: "#15171d",
      borderColor: "rgba(255, 255, 255, 0.14)",
      boxShadow: "0 54px 150px rgba(0, 0, 0, 0.55)",
    },
    { duration: 0.82, ease: "power3.inOut", at: 32.8 },
  );

  // Real product UI screenshot reveals crisply inside expanding shell
  timeline.fromTo(
    productScreenshot,
    { autoAlpha: 0, scale: 0.95, filter: "blur(8px)" },
    {
      autoAlpha: 1,
      scale: 1,
      filter: "blur(0px)",
      duration: 0.62,
      ease: "power3.out",
    },
    33.08,
  );

  // Hold the close prompt framing, then make one continuous slow pullback.
  timeline.to(
    morphShell,
    { scale: 1, x: 0, y: 0, duration: 1.65, ease: "power2.inOut" },
    33.45,
  );

  // ── ACT 5: BRAND TOKEN MORPH & REFINED MINIMAL OUTRO (PURE CLEAN TYPOGRAPHY) ──

  // Screenshot fades as shell shrinks to brand token
  timeline.to(
    productScreenshot,
    {
      autoAlpha: 0,
      scale: 0.88,
      filter: "blur(12px)",
      duration: 0.35,
      ease: "power3.in",
    },
    35.25,
  );

  // Morph Shape: 1728x960 window collapses into centered 76x76 brand token
  morph(
    timeline,
    morphShell,
    {
      left: 904,
      top: 292,
      width: 112,
      height: 112,
      borderRadius: "28px",
      background: "#111318",
      borderColor: "rgba(255, 255, 255, 0.14)",
      boxShadow: "0 14px 32px rgba(17, 19, 24, 0.14)",
      backdropFilter: "none",
    },
    { duration: 0.65, ease: "power3.inOut", at: 35.3 },
  );

  // SVG logo draws live inside brand token
  timeline.set(faceBrandToken, { autoAlpha: 1 }, 35.6);
  timeline.set(productScreenshot, { display: "none" }, 35.6);
  timeline.to(
    logoOuter,
    { strokeDashoffset: 0, duration: 0.45, ease: "power3.inOut" },
    35.65,
  );
  timeline.to(
    logoInner,
    { strokeDashoffset: 0, duration: 0.38, ease: "power3.inOut" },
    35.75,
  );

  // Outro CTA Scene typography
  timeline.set(ctaScene, { autoAlpha: 1 }, 35.5);
  timeline.set(ctaContent, { autoAlpha: 1 }, 35.5);
  timeline.fromTo(
    finalHeadline,
    { x: 180, scale: 2.2, filter: "blur(14px)", autoAlpha: 0 },
    {
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.78,
      ease: "back.out(1.35)",
    },
    35.55,
  );

  wordSlideRotate(timeline, finalHeadline, {
    duration: 0.46,
    stagger: 0.045,
    rotation: 3,
    at: 35.58,
  });
  gradientSweep(timeline, target(root, ".cta-headline .shimmer-word"), {
    fromPosition: "200% 0",
    toPosition: "0% 0",
    duration: 0.9,
    at: 35.7,
  });

  // Website line springs in from the left after the headline settles.
  timeline.fromTo(
    finalCta,
    { x: -170, scale: 0.88, filter: "blur(6px)", autoAlpha: 0 },
    {
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.62,
      ease: "back.out(1.55)",
    },
    36.15,
  );

  // Hold cleanly to resolve at 39.0s
  timeline.to({}, { duration: 0.01 }, 38.99);
  timeline.timeScale(MOTIONLY_PROMO_TIME_SCALE);
}
