import gsap from "gsap";

export function buildFlowdeskTimeline(context) {
  const { root, timeline } = context;

  // Auto-register all data-edit elements
  root.querySelectorAll("[data-edit]").forEach((el) => {
    const id = el.dataset.edit;
    if (id) context.register(id, el);
  });

  // Background atmosphere
  const worldCanvas = root.querySelector("[data-edit='worldCanvas']");
  const aurora1 = root.querySelector("[data-edit='aurora1']");
  const aurora2 = root.querySelector("[data-edit='aurora2']");

  // Scene 1: Free Canvas Kinetic Typography
  const editorialStage = root.querySelector("[data-edit='editorialStage']");
  const beat1 = root.querySelector("[data-edit='beat1']");
  const headline1 = root.querySelector("[data-edit='headline1']");
  const dp1 = root.querySelector("[data-edit='dp1']");
  const dp2 = root.querySelector("[data-edit='dp2']");
  const dp3 = root.querySelector("[data-edit='dp3']");
  const dp4 = root.querySelector("[data-edit='dp4']");

  // Scene 2: 2.5D Friction Cascade
  const frictionStage = root.querySelector("[data-edit='frictionStage']");
  const frictionTitleWrap = root.querySelector("[data-edit='frictionTitleWrap']");
  const cascadeStack = root.querySelector("[data-edit='cascadeStack']");
  const card1 = root.querySelector("[data-edit='card1']");
  const card2 = root.querySelector("[data-edit='card2']");
  const card3 = root.querySelector("[data-edit='card3']");

  // Scene 3 & 4: Production Desktop Window & Copilot
  const workspaceWindow = root.querySelector("[data-edit='workspaceWindow']");
  const rowBilling = root.querySelector("[data-edit='rowBilling']");
  const rowOrders = root.querySelector("[data-edit='rowOrders']");
  const rowCancel = root.querySelector("[data-edit='rowCancel']");
  const copilotDrawer = root.querySelector("[data-edit='copilotDrawer']");
  const stepSurgeFill = root.querySelector("[data-edit='stepSurgeFill']");
  const replyText = root.querySelector("[data-edit='replyText']");
  const caret = root.querySelector("[data-edit='caret']");
  const approveBtn = root.querySelector("[data-edit='approveBtn']");
  const btnLabel = root.querySelector("[data-edit='btnLabel']");

  // Scene 5: Outro Brand Lockup
  const outroStage = root.querySelector("[data-edit='outroStage']");
  const outroContent = root.querySelector("[data-edit='outroContent']");
  const logoLockup = root.querySelector("[data-edit='logoLockup']");
  const outroTagline = root.querySelector("[data-edit='outroTagline']");
  const ctaPill = root.querySelector("[data-edit='ctaPill']");

  const cursorHand = root.querySelector("[data-edit='cursorHand']");

  // ═══════════════════════════════════════════════════════════════
  // 1. Initial State at 0s (Strict Determinism)
  // ═══════════════════════════════════════════════════════════════
  timeline.set([editorialStage, frictionStage, outroStage], { autoAlpha: 0 }, 0);
  timeline.set(workspaceWindow, { autoAlpha: 0, scale: 0.88, yPercent: -50, xPercent: -50 }, 0);
  timeline.set([dp1, dp2, dp3, dp4], { autoAlpha: 0, y: 16, scale: 0.92, filter: "blur(6px)" }, 0);
  timeline.set([card1, card2, card3], { autoAlpha: 0, y: 50, scale: 0.88 }, 0);
  timeline.set(cursorHand, { autoAlpha: 0, x: 250, y: 500, scale: 0.9 }, 0);

  // ═══════════════════════════════════════════════════════════════
  // CONTINUOUS BACKGROUND LIFE (No Static Frames)
  // ═══════════════════════════════════════════════════════════════
  timeline.to(aurora1, {
    xPercent: 18,
    yPercent: -12,
    scale: 1.15,
    duration: 12,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  }, 0);

  timeline.to(aurora2, {
    xPercent: -15,
    yPercent: 15,
    scale: 1.2,
    duration: 14,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  }, 0);

  // ═══════════════════════════════════════════════════════════════
  // SCENE 1: Free Canvas Kinetic Typography & Drumroll (0.0s – 5.5s)
  // ═══════════════════════════════════════════════════════════════
  timeline.to(editorialStage, { autoAlpha: 1, duration: 0.2 }, 0.05);

  // Giant-to-settle kinetic pullback directly on open canvas (NO BOX!)
  timeline.fromTo(
    beat1,
    { scale: 2.2, filter: "blur(16px)", autoAlpha: 0 },
    {
      scale: 1.0,
      filter: "blur(0px)",
      autoAlpha: 1,
      duration: 0.85,
      ease: "back.out(1.35)",
    },
    0.1,
  );

  // Continuous subtle camera push during the hold (No dead still frames!)
  timeline.to(beat1, { scale: 1.04, duration: 4.8, ease: "none" }, 0.9);

  // Optical stutter word pills arrive one-by-one with micro-zoom
  timeline.to(dp1, { autoAlpha: 1, y: 0, scale: 1.0, filter: "blur(0px)", duration: 0.38, ease: "back.out(1.4)" }, 1.2);
  timeline.to(dp2, { autoAlpha: 1, y: 0, scale: 1.0, filter: "blur(0px)", duration: 0.38, ease: "back.out(1.4)" }, 2.0);
  timeline.to(dp3, { autoAlpha: 1, y: 0, scale: 1.0, filter: "blur(0px)", duration: 0.38, ease: "back.out(1.4)" }, 2.8);
  timeline.to(dp4, {
    autoAlpha: 1,
    y: 0,
    scale: 1.1,
    filter: "blur(0px)",
    duration: 0.45,
    ease: "back.out(1.6)",
  }, 3.6);

  // Exit 1: Smooth upward slide and blur
  timeline.to(beat1, { y: -60, autoAlpha: 0, filter: "blur(8px)", duration: 0.45, ease: "power3.inOut" }, 5.1);

  // ═══════════════════════════════════════════════════════════════
  // SCENE 2: 2.5D Isometric Chaos Message Cascade (5.5s – 12.0s)
  // ═══════════════════════════════════════════════════════════════
  timeline.to(editorialStage, { autoAlpha: 0, duration: 0.1 }, 5.5);
  timeline.to(frictionStage, { autoAlpha: 1, duration: 0.3 }, 5.5);

  // "Stop sorting. Start solving."
  timeline.fromTo(
    frictionTitleWrap,
    { scale: 1.8, filter: "blur(14px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.75, ease: "back.out(1.35)" },
    5.6,
  );

  // 2.5D Cascade cards drop with quintic deceleration
  timeline.to(card1, { autoAlpha: 1, y: 0, scale: 1.0, duration: 0.65, ease: "expo.out" }, 6.2);
  timeline.to(card2, { autoAlpha: 1, y: 0, scale: 1.0, duration: 0.65, ease: "expo.out" }, 7.0);
  timeline.to(card3, { autoAlpha: 1, y: 0, scale: 1.0, duration: 0.65, ease: "expo.out" }, 7.8);

  // Continuous living 3D parallax float during the hold (No still frames!)
  timeline.to(cascadeStack, {
    rotateX: 19,
    rotateY: -15,
    rotateZ: 4,
    y: -10,
    duration: 4.2,
    ease: "sine.inOut",
  }, 7.8);

  timeline.to(card1, { y: -6, duration: 2.0, yoyo: true, repeat: 1, ease: "sine.inOut" }, 8.2);
  timeline.to(card2, { y: 6, duration: 2.0, yoyo: true, repeat: 1, ease: "sine.inOut" }, 8.4);

  // Exit 2: Cards compress inward and dock toward center
  timeline.to([card1, card2, card3], { scale: 0.7, autoAlpha: 0, duration: 0.45, stagger: 0.05, ease: "power3.in" }, 11.6);
  timeline.to(frictionTitleWrap, { y: -40, autoAlpha: 0, duration: 0.4, ease: "power2.in" }, 11.7);

  // ═══════════════════════════════════════════════════════════════
  // SCENE 3: Production Desktop SaaS Interface (12.0s – 19.0s)
  // ═══════════════════════════════════════════════════════════════
  timeline.to(frictionStage, { autoAlpha: 0, duration: 0.1 }, 12.0);

  // Real Mac Desktop window unfurls with luxurious Quintic Deceleration
  timeline.to(workspaceWindow, {
    autoAlpha: 1,
    scale: 1.0,
    duration: 0.85,
    ease: "expo.out",
  }, 12.0);

  // Continuous camera zoom push on the workspace (No still frames!)
  timeline.to(workspaceWindow, { scale: 1.03, duration: 6.8, ease: "none" }, 12.8);

  // Triage rows cascade in
  timeline.fromTo(
    [rowBilling, rowOrders, rowCancel],
    { autoAlpha: 0, x: -20 },
    { autoAlpha: 1, x: 0, stagger: 0.15, duration: 0.55, ease: "back.out(1.3)" },
    12.6,
  );

  // Urgent row pulses with brand attention glow
  timeline.fromTo(
    rowBilling,
    { boxShadow: "0 0 0 0 rgba(79, 70, 229, 0)" },
    { boxShadow: "0 0 0 8px rgba(79, 70, 229, 0.18)", duration: 0.8, yoyo: true, repeat: 2, ease: "sine.inOut" },
    13.4,
  );

  // Styled cursor hand glides in toward Urgent Ticket
  timeline.to(cursorHand, {
    autoAlpha: 1,
    x: 640,
    y: 380,
    duration: 0.8,
    ease: "expo.out",
  }, 15.0);

  // Tactile click with squash-and-stretch
  timeline.to(rowBilling, { scale: 0.97, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" }, 16.5);
  timeline.to(cursorHand, { scale: 0.82, duration: 0.12, yoyo: true, repeat: 1 }, 16.5);

  // ═══════════════════════════════════════════════════════════════
  // SCENE 4: AI Copilot Drawer & Live Typing (19.0s – 26.0s)
  // ═══════════════════════════════════════════════════════════════
  // Right Copilot Drawer unfurls smoothly
  timeline.to(copilotDrawer, {
    autoAlpha: 1,
    x: "0%",
    duration: 0.65,
    ease: "expo.out",
  }, 18.8);

  // Nonlinear Step-Surge Curve (0% -> 85% in 350ms, pause for tension, rocket to 100%)
  timeline.to(stepSurgeFill, { width: "85%", duration: 0.4, ease: "power4.out" }, 19.3);
  timeline.to(stepSurgeFill, { width: "100%", duration: 0.3, ease: "power3.inOut" }, 20.1);

  // Streaming Typewriter Effect (Live character typing into reply box)
  const fullText = "Hi Alex, I’m sorry about the duplicate charge. I checked your account and found the duplicate payment. We’ll process the refund shortly.";
  timeline.call(() => {
    let currentLen = 0;
    const interval = setInterval(() => {
      currentLen += 4;
      if (replyText) {
        replyText.textContent = fullText.slice(0, currentLen);
      }
      if (currentLen >= fullText.length) {
        clearInterval(interval);
      }
    }, 28);
  }, [], 20.4);

  // Cursor hand glides to "Approve & Refund $299"
  timeline.to(cursorHand, {
    x: 960,
    y: 560,
    duration: 0.85,
    ease: "expo.out",
  }, 22.8);

  // Tactile button click with elastic squeeze
  timeline.to(approveBtn, {
    scale: 0.92,
    duration: 0.12,
    yoyo: true,
    repeat: 1,
    ease: "power2.inOut",
  }, 23.8);

  // Button transforms to emerald verified resolution!
  timeline.call(() => {
    btnLabel.textContent = "Refund Processed · Ticket Resolved ✓";
    approveBtn.style.background = "#10b981";
    approveBtn.style.boxShadow = "0 10px 24px rgba(16, 185, 129, 0.35)";
  }, [], 24.0);

  // Exit 4: Workspace contracts seamlessly
  timeline.to(cursorHand, { autoAlpha: 0, duration: 0.25 }, 25.8);
  timeline.to(workspaceWindow, { scale: 0.8, autoAlpha: 0, filter: "blur(10px)", duration: 0.65, ease: "power3.inOut" }, 26.0);

  // ═══════════════════════════════════════════════════════════════
  // SCENE 5: The Grand Payoff & Outro (26.0s – 32.0s)
  // ═══════════════════════════════════════════════════════════════
  timeline.to(outroStage, { autoAlpha: 1, duration: 0.3 }, 26.4);

  // Flowdesk logo lockup pulls back with confident elegance
  timeline.fromTo(
    logoLockup,
    { scale: 1.8, filter: "blur(14px)", autoAlpha: 0 },
    { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.85, ease: "back.out(1.35)" },
    26.5,
  );

  // Tagline reveals
  timeline.fromTo(
    outroTagline,
    { autoAlpha: 0, y: 18 },
    { autoAlpha: 1, y: 0, duration: 0.65, ease: "back.out(1.35)" },
    27.2,
  );

  // CTA Pill springs into view
  timeline.fromTo(
    ctaPill,
    { scale: 0.8, autoAlpha: 0 },
    { scale: 1.0, autoAlpha: 1, duration: 0.6, ease: "back.out(1.5)" },
    27.8,
  );

  // Final silky drift to end of timeline (No dead still frames!)
  timeline.to(outroContent, { scale: 1.03, duration: 4.2, ease: "none" }, 27.8);
}
