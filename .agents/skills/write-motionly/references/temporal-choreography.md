# Motion Pacing & Temporal Choreography

Create continuous, tightly paced animation with **zero dead time**. This reference teaches the mental model of temporal choreography and continuous visual flow.

---

## 1. The Core Law: Never Let the Timeline Become Idle

Every single second of the timeline must either **introduce, transform, move, reveal, react, or resolve** something meaningful.

- **No static hold longer than ~1.0 second**: The human eye disengages when a frame sits completely still for more than 1 second.
- **The 0.5s – 1.5s Beat Cadence**: Every 0.5 to 1.5 seconds, introduce a meaningful visual event: an element enters, exits, morphs, scales, moves, updates state, or triggers another element.
- **3–5 Visual Beats per 5-Second Scene**: A 5-second scene is never one animated entrance followed by silence. It is a sequence of 3 to 5 continuous, connected beats.

---

## 2. Think in Chains, Not Isolated Slides

### ❌ The Amateur Slide-Show Anti-Pattern:
`INTRODUCE (at 0.0s) → WAIT IDLE (1.0s to 4.5s) → HARD CUT / FADE TO NEXT SCENE`

### ✅ The Master Temporal Choreography Pattern:
`INTRODUCE → TRANSFORM → REACT → TRANSITION → REVEAL → TRANSFORM AGAIN`

Each animation must directly cause or lead into the next animation:
1. **0.0s – 0.8s [INTRODUCE]**: Primary element enters with spring overshoot (`back.out(1.35)`).
2. **0.8s – 2.0s [TRANSFORM]**: While the primary element settles, its internal state morphs (e.g., text expands into a card, waveform starts undulating).
3. **2.0s – 3.2s [REACT]**: Secondary elements react (tags pop in sequentially with micro-bounces, counters rapidly increment, connecting lines draw).
4. **3.2s – 4.2s [REVEAL]**: Camera reframes, highlighting a key insight or metric with an optical flash or elevation lift.
5. **4.2s – 5.0s [TRANSITION]**: The scene DOES NOT sit waiting! The tail of the scene is already collapsing, contracting, or morphing into the carrier for the next scene.

---

## 3. Overlapping Animations (Never "Animate → Wait → Animate")

Never wait for an animation to fully complete before starting the next. Use GSAP position overlaps so the next action begins while the current action is still settling:

```javascript
// Overlapping Choreography Example (Zero Dead Time)

// Beat 1: Card enters (0.0s to 0.7s)
timeline.fromTo(card, 
  { scale: 0.8, y: 40, autoAlpha: 0 }, 
  { scale: 1.0, y: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(1.35)" }, 
  0.0
);

// Beat 2: While card is settling (at 0.45s), headline words begin their wave ripple!
wordSlideRotate(timeline, headline, { duration: 0.5, stagger: 0.04, at: 0.45 });

// Beat 3: At 1.4s, card content transforms while an assignee avatar docks with elastic squash
timeline.to(avatar, { x: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(1.6)" }, 1.4);
timeline.fromTo(badge, { scale: 0 }, { scale: 1, duration: 0.35, ease: "back.out(1.5)" }, 1.7);

// Beat 4: At 2.6s, live counter begins rolling upward
timeline.to(counter, { textContent: "100%", duration: 0.8, ease: "power2.out" }, 2.6);

// Beat 5: At 4.2s (BEFORE scene ends at 5.0s), the card is ALREADY morphing toward Scene 2!
timeline.to(card, { width: 580, height: 84, borderRadius: "42px", duration: 0.8, ease: "power3.inOut" }, 4.2);
```

---

## 4. Layer in Continuous Micro-Motion

Even during reading holds and transitions, keep secondary micro-interactions active:
- **Live Cursors & Typewriters**: Typing carets pulsing, search text streaming character-by-character.
- **Dynamic Waveforms & Audio**: Vertical frequency bars undulating on organic sine loops.
- **SVG Path Drawing**: Laser perimeter outlines, connection arrows drawing with `strokeDashoffset`.
- **Counters & Progress Bars**: Numbers rapidly incrementing (`0` $\to$ `85%` $\to$ `100%`) rather than static text.
- **UI State Toggles**: Checkmarks animating from circle to tick, switches flipping, status tags changing from amber "In Review" to emerald "Approved".

---

## 5. Camera as an Active Storyteller

Camera movement should motivate focus and progression:
- **Push In**: Directs attention to a critical focal detail (e.g. zoom into a specific transcript sentence or search result).
- **Pan Across**: Follows a traveling asset as it moves across workflow stages.
- **Pull Back**: Wide reveal showing the full organized workspace after chaos.
- **Never end a scene static**: The camera should either be reframing toward the next focal point or initiating the zoom/pan that carries into the next scene.

---

## 6. The Scene Hand-Off Rule

**The final frame of a scene must already be moving toward the next scene.**
Never let a scene freeze at 4.9s and abruptly switch at 5.0s. At 4.2s, the current element should already begin folding, contracting, sliding, or emitting particles that physically reconstitute into the opening element of the next scene.

---

## 7. The Sequential Multi-Element Rule (Kill the "1 Element Per Scene" Habit)

A common AI failure mode is creating only **one** element per scene (e.g. `face1`) and animating it at `0.0s`, leaving it completely still for the rest of the scene.

### Mandatory Architecture:
Inside **EVERY 5-second scene**, you MUST build and animate **3 to 5 separate DOM sub-elements** that arrive sequentially (element after element after element):

```javascript
// Scene 1 Example: 4 Elements Arriving Sequentially Across 5 Seconds
// 1. Initial trigger card arrives at 0.0s
timeline.fromTo(formCard, 
  { y: 40, autoAlpha: 0, scale: 0.95 }, 
  { y: 0, autoAlpha: 1, scale: 1.0, duration: 0.6, ease: "back.out(1.35)" }, 
  0.0
);

// 2. Data pill 1 slides in at 1.2s
timeline.fromTo(customerPill, 
  { x: -30, autoAlpha: 0 }, 
  { x: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" }, 
  1.2
);

// 3. Urgent friction badge pops in at 2.4s with elastic bounce
timeline.fromTo(alertBadge, 
  { scale: 0, rotation: -10 }, 
  { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(1.6)" }, 
  2.4
);

// 4. Verification checkmark draws at 3.6s
timeline.fromTo(checkPath, 
  { strokeDashoffset: 100 }, 
  { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, 
  3.6
);

// 5. At 4.4s, carrier begins morphing toward Scene 2
timeline.to(morphShell, { width: 580, height: 84, borderRadius: "42px", duration: 0.6, ease: "power3.inOut" }, 4.4);
```

**Never reveal all elements simultaneously.** Stagger their arrival across the 5 seconds so the eye is continuously engaged with new narrative information!

---

## 8. Anti-Generic AI Color Directives

**NEVER default to generic AI purple `#6366f1` / `#a855f7` radial blobs on a black void.**
Use authentic, curated SaaS design systems:

### A. Warm Light-Mode (SaaS Leader standard):
- **Base Canvas**: Warm alabaster paper (`#faf9f6` or `#f4f1ea`).
- **Typography**: Dark ink slate (`#0f172a` / `#1e293b`).
- **UI Surfaces**: Clean white `#ffffff` with subtle 1px border (`#e2e8f0` or `rgba(0,0,0,0.06)`) and soft elevation shadow (`0 20px 40px rgba(0,0,0,0.04)`).
- **Accents**: Specific to product domain (Electric Emerald `#10b981`, Amber `#f59e0b`, Coral `#ff5b4f`, Deep Indigo `#3730a3`, Sky Blue `#0ea5e9`).

### B. Precision Dark-Mode (Linear / Vercel standard):
- **Base Canvas**: Deep titanium obsidian (`#0c0d12` or `#08090c`).
- **Grid**: Faint architectural grid (`rgba(255,255,255,0.03)` 48px).
- **Glass Surfaces**: Deep frosted acrylic (`rgba(255,255,255,0.04)` with `backdrop-filter: blur(20px)` and border `rgba(255,255,255,0.08)`).
- **Accents**: Neon teal `#00f2fe`, laser amber `#fbbf24`, or vibrant emerald `#34d399`.

