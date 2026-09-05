import gsap from "gsap";
import {
  wordSlideRotate,
  cutTheCurve,
  zoomThrough,
  inverseZoomThrough,
  stepSurgeCounter,
  ambientBreathing,
  impactShake,
} from "../../../composition/presets";

export function buildAiNotesTimeline(context) {
  const { root, timeline } = context;

  // Auto-register all data-edit elements
  root.querySelectorAll("[data-edit]").forEach((el) => {
    const id = el.dataset.edit;
    if (id) context.register(id, el);
  });

  // Query elements
  const notesStage = root.querySelector("[data-edit='notesStage']");
  const notesCanvas = root.querySelector("[data-edit='notesCanvas']");
  const auroraMesh = root.querySelector("[data-edit='auroraMesh']");
  const bloom1 = root.querySelector("[data-edit='bloom1']");
  const bloom2 = root.querySelector("[data-edit='bloom2']");
  const techDots = root.querySelector("[data-edit='techDots']");

  // Scene 1: Hook Elements
  const hookStage = root.querySelector("[data-edit='hookStage']");
  const hookThought1 = root.querySelector("[data-edit='hookThought1']");
  const hookThought2 = root.querySelector("[data-edit='hookThought2']");

  // Scene 2 & 3: App Stage & Window
  const appStage = root.querySelector("[data-edit='appStage']");
  const appWindow = root.querySelector("[data-edit='appWindow']");
  const recPill = root.querySelector("[data-edit='recPill']");
  const meetingMeta = root.querySelector("[data-edit='meetingMeta']");
  const audioStreamSection = root.querySelector("[data-edit='audioStreamSection']");
  const waveformCard = root.querySelector("[data-edit='waveformCard']");
  const waveformBars = root.querySelectorAll(".wave-bar");
  const transcriptBubble = root.querySelector("[data-edit='transcriptBubble']");
  const transcriptText = root.querySelector("[data-edit='transcriptText']");
  const synthesizeBtn = root.querySelector("[data-edit='synthesizeBtn']");
  const btnShockwave = root.querySelector("[data-edit='btnShockwave']");

  // Scene 3: Synthesized Notes
  const synthesizedNotesSection = root.querySelector("[data-edit='synthesizedNotesSection']");
  const decisionsCard = root.querySelector("[data-edit='decisionsCard']");
  const actionsCard = root.querySelector("[data-edit='actionsCard']");
  const statHeroCard = root.querySelector("[data-edit='statHeroCard']");
  const accuracyCounter = root.querySelector("[data-edit='accuracyCounter']");
  const sentimentCard = root.querySelector("[data-edit='sentimentCard']");

  // Scene 2/3 Cursor
  const scribeCursor = root.querySelector("[data-edit='scribeCursor']");

  // Scene 4: Payoff
  const payoffWrap = root.querySelector("[data-edit='payoffWrap']");
  const payoffThought = root.querySelector("[data-edit='payoffThought']");

  // ── Initial State Setup ──
  timeline.set(notesStage, { perspective: 1400 });
  timeline.set(hookStage, { autoAlpha: 1, x: 0, y: 0 });
  timeline.set(hookThought1, { autoAlpha: 0, scale: 2.0 });
  timeline.set(hookThought2, { autoAlpha: 0, scale: 0.75 });
  timeline.set(appStage, { autoAlpha: 0, scale: 0.95, x: 0, y: 0 });
  timeline.set(appWindow, { transformOrigin: "center center" });
  timeline.set(audioStreamSection, { autoAlpha: 1, scale: 1 });
  timeline.set(synthesizedNotesSection, { autoAlpha: 0, scale: 0.94 });
  timeline.set(btnShockwave, { scale: 1, autoAlpha: 0 });
  timeline.set(scribeCursor, {
    x: 820,
    y: 1150,
    autoAlpha: 0,
    scale: 1,
    rotation: -8,
  });
  timeline.set(payoffWrap, { autoAlpha: 0, scale: 1.25 });

  // Continuous subtle aurora drift across the entire timeline
  timeline.to(
    bloom1,
    {
      x: 80,
      y: -40,
      scale: 1.15,
      duration: 16.0,
      ease: "sine.inOut",
    },
    0,
  );
  timeline.to(
    bloom2,
    {
      x: -70,
      y: 50,
      scale: 1.12,
      duration: 16.0,
      ease: "sine.inOut",
    },
    0,
  );

  // ══════════════════════════════════════════════════════════════════
  // SCENE 1: HOOK & EDITORIAL TRUTH (0.0s – 3.8s)
  // ══════════════════════════════════════════════════════════════════

  // Thought 1: Giant-to-Settle Kinetic Zoom ("Meetings end. Context evaporates.")
  timeline.fromTo(
    hookThought1,
    {
      autoAlpha: 0,
      scale: 2.2,
      filter: "blur(12px)",
    },
    {
      autoAlpha: 1,
      scale: 1.0,
      filter: "blur(0px)",
      duration: 0.85,
      ease: "power3.out",
    },
    0.1,
  );

  wordSlideRotate(timeline, hookThought1.querySelector(".editorial-hook-h1"), {
    at: 0.15,
    distance: 45,
    stagger: 0.08,
    rotation: 5,
    duration: 0.65,
  });

  // Forward ZoomThrough at 1.75s: Thought 1 pushes forward into Thought 2
  zoomThrough(timeline, {
    outgoing: hookThought1,
    incoming: hookThought2,
    at: 1.8,
    duration: 0.65,
    scaleExit: 1.4,
    scaleEntry: 0.72,
    blur: 10,
  });

  wordSlideRotate(timeline, hookThought2.querySelector(".editorial-hook-h1"), {
    at: 2.1,
    distance: 40,
    stagger: 0.07,
    rotation: -4,
    duration: 0.6,
  });

  // Hold Thought 2 briefly to let the audience internalize
  // Seam at 3.3s: cutTheCurve vector handoff from Hook stage to App Window
  cutTheCurve(timeline, {
    outgoing: hookStage,
    incoming: appStage,
    at: 3.3,
    direction: "left",
    distance: 260,
    duration: 0.55,
    blur: 10,
  });

  // ══════════════════════════════════════════════════════════════════
  // SCENE 2: LIVE AUDIO STREAM & CURSOR CLICK (3.8s – 8.2s)
  // ══════════════════════════════════════════════════════════════════

  // Rec indicator breathing pulse
  timeline.to(
    recPill.querySelector(".rec-dot"),
    {
      boxShadow: "0 0 16px #f43f5e",
      repeat: 8,
      yoyo: true,
      duration: 0.45,
      ease: "sine.inOut",
    },
    3.8,
  );

  // Staggered reveal of meeting metadata
  timeline.fromTo(
    meetingMeta.querySelectorAll(".attendee-chip"),
    { autoAlpha: 0, y: 12 },
    {
      autoAlpha: 1,
      y: 0,
      stagger: 0.09,
      duration: 0.45,
      ease: "back.out(1.4)",
    },
    3.9,
  );

  // Animated Audio Equalizer Waveform Bars (varying frequencies)
  waveformBars.forEach((bar, i) => {
    const scaleY1 = 0.3 + ((i * 7) % 11) * 0.18;
    const scaleY2 = 0.2 + ((i * 13) % 9) * 0.22;
    timeline.to(
      bar,
      {
        scaleY: scaleY1,
        duration: 0.28 + (i % 4) * 0.06,
        repeat: 9,
        yoyo: true,
        ease: "sine.inOut",
      },
      3.85 + (i * 0.02),
    );
  });

  // Transcript Bubble arrival
  timeline.fromTo(
    transcriptBubble,
    { autoAlpha: 0, y: 22, scale: 0.96 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1.0,
      duration: 0.55,
      ease: "power3.out",
    },
    4.1,
  );

  // Live active keywords glow
  timeline.fromTo(
    transcriptBubble.querySelectorAll(".active-keyword"),
    { backgroundColor: "rgba(99, 102, 241, 0.1)", color: "#94a3b8" },
    {
      backgroundColor: "rgba(99, 102, 241, 0.35)",
      color: "#ffffff",
      stagger: 0.35,
      duration: 0.4,
      ease: "power2.out",
    },
    4.6,
  );

  // Synthesize CTA button pulse to draw attention
  timeline.fromTo(
    synthesizeBtn,
    { scale: 0.95, boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4)" },
    {
      scale: 1.0,
      boxShadow: "0 10px 30px -2px rgba(99, 102, 241, 0.8)",
      duration: 0.5,
      ease: "back.out(1.5)",
    },
    5.6,
  );

  // Canonical Oversized Cursor enters from physical off-screen below
  timeline.to(
    scribeCursor,
    {
      autoAlpha: 1,
      x: 1220,
      y: 535,
      rotation: -4,
      duration: 0.95,
      ease: "power3.out",
    },
    6.1,
  );

  // Cursor Anticipation & Tip-Targeted Asymmetric Tap Press
  timeline.to(
    scribeCursor,
    {
      scale: 0.84,
      rotation: 0,
      duration: 0.1,
      ease: "power1.in",
    },
    7.15,
  );

  timeline.to(
    synthesizeBtn,
    {
      scale: 0.95,
      duration: 0.1,
      ease: "power1.in",
    },
    7.15,
  );

  // Click Release & Shockwave
  timeline.to(
    scribeCursor,
    {
      scale: 1.0,
      rotation: -6,
      duration: 0.22,
      ease: "back.out(2)",
    },
    7.25,
  );

  timeline.to(
    synthesizeBtn,
    {
      scale: 1.02,
      duration: 0.2,
      ease: "back.out(2)",
    },
    7.25,
  );

  // Shockwave ring explosion
  timeline.fromTo(
    btnShockwave,
    { scale: 1.0, autoAlpha: 0.85 },
    {
      scale: 1.55,
      autoAlpha: 0,
      duration: 0.45,
      ease: "power2.out",
    },
    7.25,
  );

  // Cursor gracefully moves off towards the side
  timeline.to(
    scribeCursor,
    {
      x: 1420,
      y: 680,
      autoAlpha: 0,
      duration: 0.7,
      ease: "power2.inOut",
    },
    7.6,
  );

  // ══════════════════════════════════════════════════════════════════
  // SCENE 3: LIVE AI SYNTHESIS MORPH & STAT SURGE (8.2s – 12.8s)
  // ══════════════════════════════════════════════════════════════════

  // Morph: Audio stream collapses horizontally into an energy focal point
  timeline.to(
    audioStreamSection,
    {
      autoAlpha: 0,
      scaleY: 0.15,
      filter: "blur(12px)",
      duration: 0.45,
      ease: "power3.in",
    },
    8.2,
  );

  // Synthesized Markdown Notes expand from that exact energy center
  timeline.fromTo(
    synthesizedNotesSection,
    {
      autoAlpha: 0,
      scale: 0.94,
      filter: "blur(10px)",
    },
    {
      autoAlpha: 1,
      scale: 1.0,
      filter: "blur(0px)",
      duration: 0.6,
      ease: "expo.out",
    },
    8.45,
  );

  // Key Decisions Card & Action Items Staggered Arrival
  timeline.fromTo(
    [decisionsCard, actionsCard],
    { autoAlpha: 0, y: 24 },
    {
      autoAlpha: 1,
      y: 0,
      stagger: 0.14,
      duration: 0.55,
      ease: "power3.out",
    },
    8.65,
  );

  // Checkmark icons pop with green spring bounce
  timeline.fromTo(
    decisionsCard.querySelectorAll(".check-icon"),
    { scale: 0, rotation: -30 },
    {
      scale: 1,
      rotation: 0,
      stagger: 0.12,
      duration: 0.45,
      ease: "back.out(2.2)",
    },
    9.0,
  );

  // Action item rows pop in
  timeline.fromTo(
    actionsCard.querySelectorAll(".action-row"),
    { autoAlpha: 0, x: -16 },
    {
      autoAlpha: 1,
      x: 0,
      stagger: 0.12,
      duration: 0.4,
      ease: "power2.out",
    },
    9.2,
  );

  // Right Column: Stat Hero Card & Sentiment Card
  timeline.fromTo(
    [statHeroCard, sentimentCard],
    { autoAlpha: 0, x: 28 },
    {
      autoAlpha: 1,
      x: 0,
      stagger: 0.12,
      duration: 0.55,
      ease: "power3.out",
    },
    8.8,
  );

  // StepSurgeCounter: Counts from 64% up to 88%, pauses, then surges to 98%!
  stepSurgeCounter(timeline, accuracyCounter, {
    at: 9.2,
    start: 64,
    surgeTarget: 89,
    end: 98,
    suffix: "%",
    duration: 1.8,
  });

  // Sentiment Bar fill animation
  timeline.fromTo(
    sentimentCard.querySelector(".sentiment-segment.positive"),
    { width: "0%" },
    {
      width: "78%",
      duration: 0.85,
      ease: "power3.out",
    },
    9.6,
  );

  // Stillness before climax (11.8s - 12.8s):
  // Subtle camera push into the app window (1.0 -> 1.025) to absorb the clarity
  timeline.to(
    appWindow,
    {
      scale: 1.03,
      duration: 1.4,
      ease: "power1.inOut",
    },
    11.4,
  );

  // ══════════════════════════════════════════════════════════════════
  // SCENE 4: INVERSE ZOOM PAYOFF (12.8s – 16.0s)
  // ══════════════════════════════════════════════════════════════════

  // InverseZoomThrough: App window recedes into background depth while
  // Payoff text arrives oversized and settles crisply in center
  inverseZoomThrough(timeline, {
    outgoing: appStage,
    incoming: payoffWrap,
    at: 12.8,
    duration: 0.75,
    scaleExit: 0.75,
    scaleEntry: 1.35,
    blur: 12,
  });

  wordSlideRotate(timeline, payoffThought.querySelector(".payoff-h1"), {
    at: 13.1,
    distance: 50,
    stagger: 0.08,
    rotation: 4,
    duration: 0.75,
  });

  // Final subtle camera pull back
  timeline.to(
    payoffThought,
    {
      scale: 0.97,
      duration: 2.2,
      ease: "sine.inOut",
    },
    13.8,
  );

  return timeline;
}
