# Motionly Promo Exact Architecture & Choreography

Follow the exact visual structure, timing curves, and shape morphing techniques from `src/compositions/presets/motionly-promo`.

---

## 1. What NOT to Do (Zero Artificial Camera Scaling)
- **DO NOT** spam `cameraPush`, `cameraPull`, or continuous `scale: 1.05` on foreground elements or scenes! This causes nauseating slow-scaling delays.
- Foreground cards, text, and interfaces MUST sit rock-solid and crisp during holds.
- Only the background layer (`.world`) has one gentle drift:
  ```javascript
  timeline.to(world, { x: -44, y: 24, scale: 1.045, duration: totalDuration, ease: "none" }, 0);
  ```

---

## 2. Snappy Beat Rhythm & Clean Exits (motionly-promo standard)
In `motionly-promo`, editorial statements are fast, energetic, and clean:

### A. Arrival:
```javascript
// Arrive with spring overshoot & slight initial blur
timeline.fromTo(
  beat1,
  { scale: 1.8, filter: "blur(12px)", autoAlpha: 0, xPercent: -50, yPercent: -50 },
  { scale: 1.0, filter: "blur(0px)", autoAlpha: 1, duration: 0.75, ease: "back.out(1.35)" },
  at
);

// Kinetic typography wave
wordSlideRotate(timeline, beat1Text, {
  duration: 0.46,
  stagger: 0.05,
  rotation: 3,
  ease: "back.out(1.35)",
  at: at + 0.04
});
```

### B. Readable Hold:
- Holds firmly in place for ~1.0s – 1.4s so the audience reads it effortlessly.
- No artificial camera zooming or pulsing during the hold!

### C. Clean Departure:
```javascript
// Slides up with blur into departure
timeline.to(
  beat1,
  { y: -65, filter: "blur(8px)", autoAlpha: 0, duration: 0.4, ease: "power3.inOut" },
  exitAt
);
```

---

## 3. The Physical Shape Morph (`morphShell`)
Transitions between scenes happen by physically changing the dimensions and style of a persistent carrier frame (`morphShell`):

### In `composition.html`:
```html
<!-- Persistent Morph Frame -->
<div class="morph-shell" data-edit="morphShell">
  <div class="face face-1" data-edit="face1">...</div>
  <div class="face face-2" data-edit="face2">...</div>
  <div class="face face-3" data-edit="face3">...</div>
</div>
```

### In `timeline.js`:
```javascript
// Initial geometry at time 0
timeline.set(morphShell, {
  left: "50%",
  top: "50%",
  xPercent: -50,
  yPercent: -50,
  width: 1360,
  height: 200,
  borderRadius: "36px",
  backdropFilter: "blur(24px)",
  background: "rgba(255, 255, 255, 0.65)",
  border: "1.5px solid rgba(255, 255, 255, 0.8)",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.06)",
  transformOrigin: "50% 50%"
}, 0);

// Morph 1: Frame morphs from wide statement banner into a sleek pill
timeline.to(morphShell, {
  width: 580,
  height: 84,
  borderRadius: "42px",
  duration: 0.55,
  ease: "power3.inOut"
}, morphTime1);

// Morph 2: Pill expands into full high-density product workspace
timeline.to(morphShell, {
  width: 1100,
  height: 560,
  borderRadius: "20px",
  duration: 0.65,
  ease: "power4.inOut"
}, morphTime2);

// Morph 3: Workspace collapses into compact brand token / logo mark
timeline.to(morphShell, {
  width: 96,
  height: 96,
  borderRadius: "28px",
  scale: 0.9,
  duration: 0.6,
  ease: "power3.inOut"
}, morphTime3);
```

### Face Swapping Inside the Morph:
```javascript
// Hide outgoing content just as morph starts
timeline.to(face1, { autoAlpha: 0, duration: 0.2 }, morphTime);
// Reveal incoming content as new dimensions settle
timeline.fromTo(face2, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1.0, duration: 0.35, ease: "back.out(1.4)" }, morphTime + 0.25);
```

---

## 4. Multi-Event Sub-Beats (No Frozen Dead Zones)
When an interface or scene stays on screen for 4–5 seconds, schedule discrete chronological micro-events:
- **0.0s**: Frame morphs to new dimensions.
- **0.3s**: Interface lines/cards fade and slide into place.
- **1.8s**: A tag, pill, or avatar pops in with elastic bounce (`back.out(1.5)`).
- **3.0s**: A second tag or verified checkmark clicks into place.
- **4.2s**: Frame begins morphing to the next stage.
