import gsap from "gsap";
import {
  ambientWaves,
  blurReveal,
  cameraPull,
  cameraPush,
  charSpringBounce,
  gradientSweep,
  morph,
  textReveal,
  wordSlideRotate,
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

  // Background layers & dynamic lighting
  const world = target(root, "[data-edit='world']");
  const wittyBgCurtain = target(root, "[data-edit='witty-bg-curtain']");
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

  // Problem liquid glass morph frame & bespoke morph faces
  const problemMorphFrame = target(root, "[data-edit='problem-morph-frame']");
  const coinInnerDetails = target(root, "[data-edit='coin-inner-details']");
  const coinPriceText = target(root, "[data-edit='coin-price-text']");
  const coinPriceDigits = target(root, "[data-edit='coin-price-digits']");
  const questionMarkConfused = target(root, ".question-mark-confused");
  const dollarPath = target(root, ".dollar-path");

  // 3D Mystery Box Elements
  const boxInnerDetails = target(root, "[data-edit='box-inner-details']");
  const box3dSvg = target(root, "[data-edit='box-3d-svg']");
  const boxLidGroup = target(root, "[data-edit='box-lid-group']");
  const boxScanBeam = target(root, "[data-edit='box-scan-beam']");
  const hologramBeam = target(root, "[data-edit='hologram-beam']");
  const slotText = target(root, "[data-edit='slot-text']");

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
  const beatKeepPrompting = target(root, "[data-edit='editorial-keep-prompting']");

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
      problemMorphFrame,
      coinInnerDetails,
      boxInnerDetails,
      hologramBeam,
      wittyBgCurtain,
      creditBurnStage,
    ],
    { autoAlpha: 0 },
    0,
  );
  timeline.set(coinPriceText, { autoAlpha: 0, width: 0 }, 0);
  timeline.set(introRestStatement, { autoAlpha: 0, width: 0, display: "none" }, 0);
  timeline.set([ctaContent, introHeroBeat, creditBurnStage], { xPercent: -50, yPercent: -50 }, 0);

  editorialBeats.forEach((beat) => {
    timeline.set(beat, { xPercent: -50, yPercent: -50, autoAlpha: 0, x: 0 }, 0);
  });

  timeline.set(beat1, { autoAlpha: 1, scale: 1.5 }, 0);

  timeline.set(morphShell, {
    left: 350,
    top: 481,
    width: 1220,
    height: 118,
    borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 248, 242, 0.88) 100%)",
    transformOrigin: "50% 50%",
  }, 0);

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
    { x: 220, y: -110, scale: 1.15, rotation: 22, duration: 39, ease: "sine.inOut" },
    0,
  );
  timeline.fromTo(
    auroraB,
    { x: 110, y: -70, scale: 1.08, rotation: 10 },
    { x: -220, y: 150, scale: 0.85, rotation: -24, duration: 39, ease: "sine.inOut" },
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
    { width: 1480, height: 240, scale: 0.88, filter: "blur(12px)", autoAlpha: 0 },
    { width: 1360, height: 200, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.65, ease: "power3.out" },
    0.04,
  );

  // Beat 1: "Startups need great launch videos."
  timeline.fromTo(
    beat1,
    { scale: 1.5, filter: "blur(12px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.75, ease: "power3.out" },
    0.04,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-beat-1'] .editorial-text"), {
    duration: 0.46,
    stagger: 0.05,
    rotation: 3,
    at: 0.08,
  });
  gradientSweep(timeline, target(root, "[data-edit='editorial-beat-1'] .shimmer-word"), {
    fromPosition: "200% 0",
    toPosition: "0% 0",
    duration: 1.2,
    at: 0.2,
  });

  // Exit 1: Slide Up smoothly
  timeline.to(
    beat1,
    { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.4, ease: "power3.inOut" },
    1.35,
  );

  // Shape Morph 1: Liquid glass frame morphs to 1120px
  timeline.to(
    problemMorphFrame,
    { width: 1120, height: 150, borderRadius: "32px", duration: 0.45, ease: "power3.inOut" },
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
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.55, ease: "power4.out" },
    1.75,
  );
  charSpringBounce(timeline, target(root, "[data-edit='editorial-beat-2'] .editorial-text"), {
    duration: 0.42,
    stagger: 0.02,
    at: 1.8,
  });

  // Exit 2: Slide Up
  timeline.to(
    beat2,
    { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.4, ease: "power3.inOut" },
    2.75,
  );

  // Shape Morph 2: Liquid glass frame morphs to 1220px for Beat 3
  timeline.to(
    problemMorphFrame,
    { width: 1220, height: 150, borderRadius: "32px", duration: 0.45, ease: "power3.inOut" },
    2.8,
  );

  // ── BEAT 3: TEXT FIRST ➔ MORPH TO [ $ ] [ 1000$? ] CONFUSED CAPSULE ──

  // 1. Text plays first cleanly inside the frame (3.0s – 3.9s)
  timeline.set(beat3, { autoAlpha: 1 }, 3.0);
  timeline.fromTo(
    beat3,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.55, ease: "power4.out" },
    3.0,
  );
  textReveal(timeline, target(root, "[data-edit='editorial-beat-3'] .editorial-text"), {
    unit: "words",
    duration: 0.42,
    stagger: 0.04,
    at: 3.05,
  });

  // Text exits at 3.9s
  timeline.to(
    beat3,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.32, ease: "power3.in" },
    3.9,
  );

  // 2. CONTINUOUS MORPH: Frame -> Gold & Emerald Currency Coin (3.95s – 4.55s)
  timeline.to(
    problemMorphFrame,
    {
      width: 150,
      height: 150,
      borderRadius: "50%",
      background: "radial-gradient(135% 100% at 50% 0%, #FFD700 0%, #FF9500 48%, #38EF7D 100%)",
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
  timeline.to(dollarPath, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, 4.3);

  // Coin spins in 3D
  timeline.to(
    problemMorphFrame,
    {
      rotationY: 360,
      duration: 0.75,
      ease: "power2.out",
    },
    4.35,
  );

  // 3. MORPH EXPANSION: Coin capsule expands horizontally and reveals "1000$?" with proportional ?
  timeline.to(
    problemMorphFrame,
    {
      width: 460,
      borderRadius: "75px",
      rotationY: 0,
      duration: 0.52,
      ease: "back.out(1.4)",
    },
    4.65,
  );

  timeline.set(coinPriceText, { autoAlpha: 1, width: "auto" }, 4.7);
  timeline.fromTo(
    coinPriceText,
    { scale: 0.6, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.35, ease: "back.out(1.6)" },
    4.7,
  );

  const priceObj = { val: 250 };
  timeline.to(priceObj, {
    val: 1000,
    duration: 0.52,
    ease: "power2.out",
    onUpdate: () => {
      coinPriceDigits.textContent = `${Math.round(priceObj.val)}$`;
    },
  }, 4.72);

  // Proportional Question mark bounces with disbelief
  timeline.fromTo(
    questionMarkConfused,
    { scale: 0, rotation: -15 },
    { scale: 1.15, rotation: 8, duration: 0.32, yoyo: true, repeat: 1, ease: "back.out(1.8)" },
    5.15,
  );

  // 4. GENEROUS HOLD on 1000$? (Holds until 5.9s)
  timeline.to(coinPriceText, { scale: 1.01, duration: 0.75, ease: "sine.inOut" }, 5.25);

  // 5. DIRECT ZERO-SPIN MORPH BACK TO RECTANGLE FRAME (5.9s – 7.0s)
  timeline.to(
    coinInnerDetails,
    { autoAlpha: 0, scale: 0.5, duration: 0.35, ease: "power2.in" },
    5.85,
  );
  timeline.to(
    problemMorphFrame,
    {
      scale: 1.0,
      width: 1280,
      height: 150,
      borderRadius: "32px",
      rotationY: 0, // NO SPIN, DIRECT SHAPE MORPH
      rotationX: 0,
      background: "radial-gradient(135% 100% at 50% 0%, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.12) 100%)",
      borderColor: "rgba(255, 255, 255, 0.75)",
      boxShadow: "0 30px 80px rgba(17, 19, 24, 0.06)",
      duration: 1.1,
      ease: "power3.out",
    },
    5.9,
  );

  // ── BEAT 4: "Current AI video tools are a mystery box." ➔ 3D ISOMETRIC HOLOGRAPHIC UNBOXING ──

  timeline.set(beat4, { autoAlpha: 1 }, 7.1);
  timeline.fromTo(
    beat4,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.58, ease: "power4.out" },
    7.1,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-beat-4'] .editorial-text"), {
    duration: 0.42,
    stagger: 0.035,
    rotation: -2,
    at: 7.15,
  });

  // Text exits at 8.05s
  timeline.to(
    beat4,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.32, ease: "power3.in" },
    8.05,
  );

  // 6. BESPOKE MORPH: Frame -> 3D Isometric Holographic Mystery Box (8.1s – 9.3s)
  timeline.to(
    problemMorphFrame,
    {
      width: 170,
      height: 170,
      borderRadius: "32px",
      background: "radial-gradient(135% 100% at 50% 0%, #7657FF 0%, #4B2CBF 50%, #5CE0D0 100%)",
      borderColor: "rgba(255, 255, 255, 0.95)",
      boxShadow: "0 28px 70px rgba(118, 87, 255, 0.55)",
      duration: 0.65,
      ease: "power3.inOut",
    },
    8.1,
  );

  timeline.set(boxInnerDetails, { autoAlpha: 1 }, 8.45);
  timeline.fromTo(
    boxInnerDetails,
    { autoAlpha: 0, scale: 0.6 },
    { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(1.5)" },
    8.45,
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
    8.55,
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
    8.65,
  );

  // Hologram beam shoots upward out of the open box!
  timeline.set(hologramBeam, { autoAlpha: 1 }, 8.7);
  timeline.fromTo(
    hologramBeam,
    { y: 15, scale: 0.7, autoAlpha: 0 },
    { y: -10, scale: 1.0, autoAlpha: 1, duration: 0.4, ease: "back.out(1.5)" },
    8.7,
  );

  // Laser scanner sweeps across the box
  timeline.fromTo(
    boxScanBeam,
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: -10, duration: 0.5, repeat: 1, yoyo: true, ease: "sine.inOut" },
    8.75,
  );

  // Slot roulette rapidly cycles unpredictable AI results:
  timeline.to({}, {
    duration: 0.25,
    onStart: () => {
      slotText.innerHTML = `<span class="slot-item-emoji">🎬</span> Expected Video`;
    },
  }, 8.75);
  timeline.to({}, {
    duration: 0.25,
    onStart: () => {
      slotText.innerHTML = `<span class="slot-item-emoji">👾</span> 6 Weird Fingers`;
    },
  }, 9.0);
  timeline.to({}, {
    duration: 0.35,
    onStart: () => {
      slotText.innerHTML = `<span class="slot-item-emoji">❓</span> Glitch Artifacts`;
    },
  }, 9.25);

  // Box snaps shut with tension
  timeline.to(
    boxLidGroup,
    { y: 0, rotationX: 0, duration: 0.25, ease: "power3.in" },
    9.5,
  );

  // Dissolve mystery box cleanly
  timeline.to(
    [boxInnerDetails, hologramBeam, problemMorphFrame],
    {
      scale: 0.2,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power2.in",
    },
    9.65,
  );

  // ── BEAT 5A (Strictly Centered): "You can't edit anything." ──

  timeline.set(beat5a, { autoAlpha: 1 }, 9.75);
  timeline.fromTo(
    beat5a,
    { y: 55, scale: 0.92, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.55, ease: "power4.out" },
    9.75,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-beat-5a'] .editorial-text"), {
    duration: 0.42,
    stagger: 0.04,
    rotation: 2,
    at: 9.8,
  });

  // Exit 5A: Slide Up
  timeline.to(
    beat5a,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.35, ease: "power3.inOut" },
    10.85,
  );

  // ── BEAT 5B (Strictly Centered): "You need to reprompt." ──

  timeline.set(beat5b, { autoAlpha: 1 }, 11.1);
  timeline.fromTo(
    beat5b,
    { y: 55, scale: 0.92, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.55, ease: "power4.out" },
    11.1,
  );
  charSpringBounce(timeline, target(root, "[data-edit='editorial-beat-5b'] .editorial-text"), {
    duration: 0.42,
    stagger: 0.02,
    at: 11.15,
  });

  // Exit 5B: Slide Up
  timeline.to(
    beat5b,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.35, ease: "power3.inOut" },
    12.2,
  );

  // ── BEAT 6 (Strictly Centered Clean Text): "Wasting hours and burning credits." ──

  timeline.set(beat6, { autoAlpha: 1 }, 12.45);
  timeline.fromTo(
    beat6,
    { y: 55, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.58, ease: "power4.out" },
    12.45,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-beat-6'] .editorial-text"), {
    duration: 0.44,
    stagger: 0.04,
    rotation: -3,
    at: 12.5,
  });

  // Exit Beat 6 Text cleanly before the credit burn animation!
  timeline.to(
    beat6,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.35, ease: "power3.inOut" },
    13.4,
  );

  // ── DEDICATED POST-TEXT CREDIT BURN MOMENT (PURE TYPOGRAPHY, ZERO CARDS) ──

  timeline.set(creditBurnStage, { autoAlpha: 1 }, 13.55);
  timeline.fromTo(
    creditBurnStage,
    { scale: 0.75, filter: "blur(10px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.45, ease: "back.out(1.5)" },
    13.55,
  );

  // Dynamic rapid credit burn countdown: 500 -> 320 -> 90 -> 0!
  const creditObj = { val: 500 };
  timeline.to(creditObj, {
    val: 0,
    duration: 0.85,
    ease: "power2.in",
    onUpdate: () => {
      burnCounter.textContent = `${Math.round(creditObj.val)}`;
    },
  }, 13.65);

  // Fire flare and pulse as credits hit zero!
  timeline.to(
    burnFire,
    { scale: 1.55, rotation: 16, duration: 0.25, yoyo: true, repeat: 1, ease: "back.out(2.0)" },
    14.25,
  );

  // Dissolve credit burn scene into radiant ambient burst
  timeline.to(
    creditBurnStage,
    {
      y: -50,
      filter: "blur(14px)",
      autoAlpha: 0,
      duration: 0.4,
      ease: "power3.in",
    },
    14.75,
  );

  // ── ACT 2: RADIANT AMBIENT LIGHT ACCENT ➔ SOLID INK "INTRODUCING MOTIONLY" ──

  timeline.fromTo(
    ambientBurst,
    { autoAlpha: 0, scale: 0.5 },
    { autoAlpha: 0.85, scale: 2.8, duration: 0.75, ease: "power3.out" },
    14.8,
  );
  timeline.to(
    ambientBurst,
    { autoAlpha: 0, duration: 0.9, ease: "power2.inOut" },
    15.55,
  );

  // Step 1: "Introducing" enters MASSIVE (scale: 4.8, x: 260) and PAUSES on screen in CRISP SOLID INK!
  timeline.set(introHeroBeat, { autoAlpha: 1, x: 0, y: 0 }, 15.0);
  timeline.fromTo(
    introHeroBeat,
    { scale: 4.8, x: 260, filter: "blur(14px)", autoAlpha: 0 },
    { scale: 4.8, x: 260, filter: "blur(0px)", autoAlpha: 1, duration: 0.65, ease: "power4.out" },
    15.0,
  );

  // PAUSE ON BIG "INTRODUCING" for 1.2s so the user digests it completely!
  timeline.to(introHeroBeat, { scale: 4.85, duration: 1.2, ease: "sine.inOut" }, 15.0);

  // Step 2: SLOW, GLORIOUS CINEMATIC ZOOM OUT & PAN (1.8s duration) pulling back to scale: 1.0, x: 0
  timeline.to(
    introHeroBeat,
    {
      scale: 1.0,
      x: 0,
      duration: 1.8,
      ease: "power3.inOut",
    },
    16.2,
  );

  // Live SVG logo path draw as camera pulls back into full view
  timeline.to(
    introLogoOuter,
    { strokeDashoffset: 0, duration: 0.78, ease: "power3.inOut" },
    16.8,
  );
  timeline.to(
    introLogoInner,
    { strokeDashoffset: 0, duration: 0.62, ease: "power3.inOut" },
    17.05,
  );

  // Radiant brand shimmer sweeps across "Motionly." and settles to solid ink
  gradientSweep(timeline, introBrandName, {
    fromPosition: "200% 0",
    toPosition: "0% 0",
    duration: 1.4,
    at: 16.9,
  });

  // Step 3: PAUSE & HOLD ON COMPLETED TITLE in centered glory (1.1s hold)
  timeline.to(introHeroBeat, { scale: 1.02, duration: 1.1, ease: "sine.inOut" }, 18.0);

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
    19.1,
  );

  // 2. Center hold on big "Motionly." in the middle of the screen (1.35s hold!)
  timeline.to(introBrandName, { scale: 1.05, duration: 1.35, ease: "sine.inOut" }, 19.15);

  // 3. Keep text BIG (86px)! Slide "Motionly." left, reveal "delivers on-demand launch videos.", and camera-pan!
  timeline.set(introRestStatement, { display: "inline-block", autoAlpha: 1 }, 20.5);
  timeline.fromTo(
    introRestStatement,
    { width: 0, x: 60, autoAlpha: 0 },
    { width: "auto", x: 0, autoAlpha: 1, duration: 0.65, ease: "power4.out" },
    20.5,
  );
  wordSlideRotate(timeline, introRestStatement, {
    duration: 0.46,
    stagger: 0.045,
    rotation: 3,
    at: 20.6,
  });

  // Smooth cinematic camera pan drift so the entire big sentence is framed and read comfortably!
  timeline.fromTo(
    introHeroBeat,
    { x: 0 },
    { x: -360, duration: 1.6, ease: "power2.inOut" },
    20.5,
  );

  // Exit Solution 1: Whole giant sentence slides up smoothly
  timeline.to(
    introHeroBeat,
    { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.42, ease: "power3.inOut" },
    22.65,
  );

  // ── Solution 2: "Prompt like AI. Edit every layer." (Solid Ink Text, Zero Gradient Washout!) ──
  timeline.set(solBeat2, { autoAlpha: 1 }, 22.9);
  timeline.fromTo(
    solBeat2,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.6, ease: "power4.out" },
    22.9,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-sol-2'] .editorial-text"), {
    duration: 0.46,
    stagger: 0.045,
    rotation: 2,
    at: 22.95,
  });

  // Exit Solution 2: Slide Up
  timeline.to(
    solBeat2,
    { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.38, ease: "power3.inOut" },
    24.8,
  );

  // ── BACKGROUND COLOR MORPH ON "Seriously." (Fresh Mint / Emerald Wash) ──
  timeline.set(wittyBgCurtain, { autoAlpha: 1 }, 24.95);
  timeline.fromTo(
    wittyBgCurtain,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: 0.65, ease: "power2.inOut" },
    24.95,
  );

  // ── Beat: "Seriously." (Solid bold ink text, NO GRADIENT, dead center punch!) ──
  timeline.set(beatSeriously, { autoAlpha: 1 }, 25.05);
  timeline.fromTo(
    beatSeriously,
    { scale: 1.4, filter: "blur(12px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.52, ease: "back.out(1.5)" },
    25.05,
  );

  // Exit "Seriously."
  timeline.to(
    beatSeriously,
    { y: -55, filter: "blur(8px)", autoAlpha: 0, duration: 0.35, ease: "power3.inOut" },
    26.5,
  );

  // ── Beat: "We have a UI for you to edit everything." (Solid bold text) ──
  timeline.set(beatUiPromise, { autoAlpha: 1 }, 26.75);
  timeline.fromTo(
    beatUiPromise,
    { y: 50, scale: 0.95, filter: "blur(10px)", autoAlpha: 0 },
    { y: 0, scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.58, ease: "power4.out" },
    26.75,
  );
  wordSlideRotate(timeline, target(root, "[data-edit='editorial-ui-promise'] .editorial-text"), {
    duration: 0.42,
    stagger: 0.038,
    rotation: 2,
    at: 26.8,
  });

  // Exit "We have a UI for you to edit everything."
  timeline.to(
    beatUiPromise,
    { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.38, ease: "power3.inOut" },
    28.5,
  );

  // ── Beat: "Or..." (Solid bold text, cheeky short pause) ──
  timeline.set(beatOr, { autoAlpha: 1 }, 28.75);
  timeline.fromTo(
    beatOr,
    { scale: 1.3, filter: "blur(10px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.45, ease: "back.out(1.3)" },
    28.75,
  );

  // Exit "Or..."
  timeline.to(
    beatOr,
    { y: -50, filter: "blur(8px)", autoAlpha: 0, duration: 0.32, ease: "power3.inOut" },
    29.7,
  );

  // ── Beat: "...keep prompting." ➔ PHYSICAL SEAMLESS MORPH INTO PROMPT PILL ──

  timeline.set(beatKeepPrompting, { autoAlpha: 1 }, 29.95);
  timeline.fromTo(
    beatKeepPrompting,
    { scale: 1.3, filter: "blur(10px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.48, ease: "back.out(1.4)" },
    29.95,
  );

  // At 30.8s: The text "...keep prompting." physically collapses as the Prompt Pill capsule forms around it!
  timeline.to(
    beatKeepPrompting,
    { scale: 0.7, filter: "blur(8px)", autoAlpha: 0, duration: 0.35, ease: "power3.in" },
    30.8,
  );
  timeline.to(
    wittyBgCurtain,
    { autoAlpha: 0, duration: 0.45, ease: "power2.in" },
    30.8,
  );

  // ── ACT 4: PROMPT PILL ➔ PRODUCT WINDOW WORKSPACE MORPH ──

  // Prompt Pill expands smoothly from center directly around where "...keep prompting." stood!
  timeline.set(morphShell, { autoAlpha: 1 }, 30.85);
  timeline.fromTo(
    morphShell,
    {
      left: 600,
      top: 510,
      width: 720,
      height: 90,
      borderRadius: "28px",
      scale: 0.85,
      filter: "blur(10px)",
      autoAlpha: 0,
    },
    {
      left: 350,
      top: 481,
      width: 1220,
      height: 118,
      borderRadius: "28px",
      scale: 1,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.55,
      ease: "power4.out",
    },
    30.85,
  );

  timeline.set(facePrompt, { autoAlpha: 1 }, 31.1);
  timeline.fromTo(
    facePrompt,
    { autoAlpha: 0, filter: "blur(6px)" },
    { autoAlpha: 1, filter: "blur(0px)", duration: 0.32, ease: "power4.out" },
    31.1,
  );

  // Typing caret blinks
  timeline.fromTo(
    typingCaret,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: 0.18, repeat: 3, yoyo: true, ease: "power2.inOut" },
    31.25,
  );

  // Character typing: "Make me a product launch ad"
  textReveal(timeline, promptText, {
    unit: "chars",
    duration: 0.09,
    stagger: 0.015,
    at: 31.3,
  });

  // Prompt fill sweep & tactile button click
  timeline.to(
    promptFill,
    { scaleX: 1, duration: 0.4, ease: "power3.inOut" },
    32.2,
  );
  timeline.to(
    generateButton,
    { scale: 0.93, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" },
    32.2,
  );

  // Prompt Pill expands directly into dark Product Window
  timeline.to(
    facePrompt,
    { y: -16, filter: "blur(8px)", autoAlpha: 0, duration: 0.32, ease: "power3.in" },
    32.65,
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
    { duration: 0.82, ease: "power3.inOut", at: 32.7 },
  );

  // Real product UI screenshot reveals crisply inside expanding shell
  timeline.fromTo(
    productScreenshot,
    { autoAlpha: 0, scale: 0.95, filter: "blur(8px)" },
    { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.62, ease: "power3.out" },
    32.97,
  );

  // Dynamic Camera Cinematography over real UI
  timeline.to(
    morphShell,
    { scale: 1.02, duration: 0.6, ease: "power2.out" },
    33.3,
  );

  // Move 1: Push in on preview canvas
  cameraPush(timeline, morphShell, {
    scale: 1.35,
    x: -60,
    y: -40,
    duration: 0.85,
    at: 33.5,
  });

  // Move 2: Pull back to full overview
  cameraPull(timeline, morphShell, {
    scale: 1,
    x: 0,
    y: 0,
    duration: 0.65,
    at: 34.2,
  });

  // ── ACT 5: BRAND TOKEN MORPH & REFINED MINIMAL OUTRO ──

  // Screenshot fades as shell shrinks to brand token
  timeline.to(
    productScreenshot,
    { autoAlpha: 0, scale: 0.88, filter: "blur(12px)", duration: 0.35, ease: "power3.in" },
    35.25,
  );

  // Morph Shape: 1728x960 window collapses into centered 76x76 brand token
  morph(
    timeline,
    morphShell,
    {
      left: 922,
      top: 310,
      width: 76,
      height: 76,
      borderRadius: "22px",
      background: "#111318",
      borderColor: "rgba(255, 255, 255, 0.14)",
      boxShadow: "0 20px 50px rgba(17, 19, 24, 0.18)",
    },
    { duration: 0.65, ease: "power3.inOut", at: 35.3 },
  );

  // SVG logo draws live inside brand token
  timeline.set(faceBrandToken, { autoAlpha: 1 }, 35.6);
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
  timeline.fromTo(
    ctaContent,
    { y: 28, filter: "blur(12px)", autoAlpha: 0 },
    { y: 0, filter: "blur(0px)", autoAlpha: 1, duration: 0.45, ease: "power4.out" },
    35.55,
  );

  wordSlideRotate(timeline, finalHeadline, {
    duration: 0.38,
    stagger: 0.035,
    rotation: 3,
    at: 35.6,
  });
  gradientSweep(timeline, target(root, ".cta-headline .shimmer-word"), {
    fromPosition: "200% 0",
    toPosition: "0% 0",
    duration: 0.9,
    at: 35.7,
  });

  timeline.fromTo(
    finalCta,
    { y: 16, scale: 0.92, autoAlpha: 0 },
    { y: 0, scale: 1, autoAlpha: 1, duration: 0.35, ease: "back.out(1.3)" },
    35.83,
  );

  // Final subtle pulse & CTA highlight
  timeline.to(
    finalCta,
    {
      backgroundColor: "#caff45",
      color: "#111318",
      scale: 1.04,
      duration: 0.25,
      ease: "power2.inOut",
    },
    36.0,
  );

  // Hold cleanly to resolve at 39.0s
  timeline.to({}, { duration: 0.01 }, 38.99);
}
