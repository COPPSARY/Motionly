---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly code-first HTML/CSS compositions animated by GSAP. Use for Motionly startup and SaaS ads, founder promos, product films, continuous visual storytelling, motion bridges, transformation-based transitions, UI cinematography, kinetic typography, scene choreography, text reveals, stagger, camera moves, timeline behavior, preview, visual overrides, export, or migration away from legacy .motion project guidance.
---

# Write Motionly compositions

Author the visual composition in `composition.html` and its choreography in `timeline.js`. Keep the adjacent `index.ts` as a thin metadata and mounting adapter for `CompositionDefinition`.

## Source format

Every composition is an ordinary source folder:

```text
composition-name/
|- composition.html   # semantic HTML/SVG and scoped CSS
|- timeline.js        # GSAP choreography on the caller-owned timeline
`- index.ts           # metadata and mounting adapter only
```

Never create, read, or recommend a `.motion` file. Do not add a JSON project DSL, parser, conversion step, generated-DOM representation, or second renderer. The HTML/CSS and GSAP timeline are the authored project source.

---

## Core Transition Principles: MORPH, MATCH-CUT, PARTICLE-REASSEMBLE

Every scene boundary in a high-end SaaS product film or kinetic ad MUST use **MORPH**, **MATCH-CUT**, or **PARTICLE-REASSEMBLE**. Never substitute a hard cut, fade-to-black, or generic cross-dissolve.

1. **MORPH (Continuous Outline Transformation)**:
   - One shape's own outline changes over time until it becomes a different shape.
   - The object never disappears or flashes opacity; its width, height, border-radius, and padding stretch and bend continuously.
   - *Example*: A frosted prompt pill (`1220×118px`, `border-radius: 28px`) expands directly into the dark product window (`1728×960px`, `border-radius: 34px`), or a solution card contracts down into an input pill.

2. **MATCH-CUT (Silhouette & Position Continuity)**:
   - The transition cut happens at the exact instant two distinct shots or elements share the identical position, size, and silhouette in frame.
   - The eye reads the scene as completely continuous even though the internal contents have transitioned.
   - *Example*: The bounding box and corner radius of the prompt input matches the initial bounding box of the incoming product workspace window.

3. **PARTICLE-REASSEMBLE (Physical Shard Convergence)**:
   - An object or sentence fractures into small physical pieces (letter shards, particles, glowing dots).
   - The pieces visibly originate from the first object's coordinates, stream across the canvas in an intentional trajectory, and physically assemble into the recognizable outline of the next object or pill.

---

## Motion Effects & Presets Library Reference (`src/composition/presets.ts`)

Combine these distinct recipes across different beats to avoid visual repetition:

1. **`giantKineticCrop(timeline, element, options)`** (Ultra-Giant Close-Crop & Letter Physics):
   - Enters ultra-massive across camera lens (`scale: 2.8+`, `panX: 240px`), zooming into focus while individual characters animate with playful micro-vertical staggered offsets (`back.out(1.5)`).
   - *Best for*: Cinematic opening hooks and massive headline payoff statements.

2. **`cameraZoomPan(timeline, target, options)`** (Hero Focused Zoom & Pan Settle):
   - Starts massively zoomed in and cropped on a leading focal word/element (`startScale: 3.2, startX: 340`), then smoothly pulls back and pans to centered focus (`endScale: 1.0, endX: 0`), sweeping the full brand/headline into view.
   - *Best for*: Hero product introductions (e.g. *"Introducing Motionly"*).

3. **`gradientSweep(timeline, target, options)`** (Dynamic Moving Gradient Shimmer):
   - Sweeps an animated gradient mask across typography or buttons (`backgroundPosition: "200% 0" ➔ "0% 0"`). Requires CSS `background-size: 200% 100%`.
   - *Best for*: Highlighting keyword punchlines (e.g. *"great launch videos"*, *"Edit every layer"*, *"wasting credits"*).

4. **`wordSlideRotate(timeline, element, options)`** (Kinetic Word Slide with Natural Tilt):
   - Splits text into individual words, animating each with dynamic vertical slide, subtle rotation tilt (`rotation: 4`, `y: 44`), and slight stagger.
   - *Best for*: Confident problem and hook statements.

5. **`charSpringBounce(timeline, element, options)`** (Tactile Bouncy Character Pop):
   - Splits text into characters and pops each on with spring overshoot bounce (`y: 30`, `scale: 0.82`, `ease: "back.out(1.7)"`).
   - *Best for*: Solution punchlines and playful/tactile moments.

6. **`textReveal(timeline, element, options)`** (3D Perspective Text Reveal):
   - Splits text with 3D x-axis rotation tilt (`rotateX: -24`, `yPercent: 115`, `ease: "power4.out"`).
   - *Best for*: Clean, structured editorial statements.

7. **`ambientWaves(timeline, waves, options)`** (Organic Undulating Wave Background):
   - Animates layered fluid SVG wave paths with continuous sinusoidal vertical and horizontal travel (`yoyo: true`, `ease: "sine.inOut"`), giving living fluidity to the canvas without distracting from focal typography.
   - *Best for*: Clean, agency-grade ambient background canvas.

8. **`blurReveal(timeline, target, options)`** (Luminous Focus Wipe):
   - Sharpens elements from deep optical blur into crisp clarity (`filter: "blur(18px)" ➔ "blur(0px)"`).
   - *Best for*: Subtitle resolves and ambient elements.

9. **`morph(timeline, target, styles, options)`** (Physical Geometry Morphing):
   - Tweens geometry (`width`, `height`, `left`, `top`, `borderRadius`, `background`, `boxShadow`) on caller-owned elements without opacity flashing.

---

## Typography & Kinetic Rules

1. **Single Full-Sentence Editorial Thoughts (FORBIDDEN: Title + Subtitle Split)**:
   - **NEVER** split thoughts into an oversized headline paired with a small secondary grey subtitle. This creates a weak, cluttered "presentation slide" look.
   - Express each beat as **one unified, full-size, confident editorial sentence** in standard bold typography (e.g. `Inter 68px/700`, `letter-spacing: -0.045em`).
   - Use consistent font family, weight, and letter-spacing across the entire video.

2. **Strict Mathematical Centering**:
   - Always apply `xPercent: -50, yPercent: -50` in GSAP for centered typography stages so that when `x: 0`, the text is strictly locked to mathematical dead center `(960px, 540px)`.
   - Directional sliding chains: sentences enter from `+750px` directly to `0px` (center) and exit to `-750px` without lingering off-center.

3. **Giant-to-Settle Kinetic Zoom (`scale: 2.0+ ➔ 1.0`)**:
   - Key focal statements and product introductions should enter **massive, bold, and cropped** (`scale: 2.0–3.2`, with radiant gradient highlights) and smoothly **zoom out / pull back** into centered focus (`scale: 1.0`) as the thought completes, maintaining continuous momentum.

4. **Continuous Word-by-Word Animation**:
   - Animate typography **word-by-word at all times** using diverse techniques (`giantKineticCrop`, `wordSlideRotate`, `charSpringBounce`, `gradientSweep`) rather than repeating the same entrance.

5. **No Premature Cursors**:
   - Never render a blinking cursor sitting in an empty box before text appears. Cursors should only arrive synchronously with active typing.

6. **No Muddy Dark Overlays**:
   - Never apply full-screen dark opacity veils (`opacity: 0.9`) over a soft, luminous canvas background, as this turns the composition into a muddy grey wash.
   - Keep the ambient canvas clean, luminous, and glowing; let the product window itself provide the dark container surface with sleek borders and deep drop shadows.

7. **Rule of Continuous Motion (Never Static)**:
   - No frame in the video may ever be completely static. Every element is either entering, exiting, mid-transition, or performing subtle idle motion (ambient wave flow, background aurora drift, gentle breathing scale, or live stroke drawing).

---

## Workflow

1. Write a short story spine and divide it into scenes with starts and durations in the thin adapter.
2. Plan each beat: composition, message, focal point, primary motion, camera, motion bridge, and transition mechanism (Morph, Match-Cut, or Particle-Reassemble).
3. Reduce most SaaS ads to 5-7 strong visual beats.
4. Build semantic HTML/SVG and scoped CSS in `composition.html`. Do not generate the visual tree in TypeScript.
5. Mark editable nodes with stable `data-edit` ids and register them from `timeline.js`.
6. Add motion from `timeline.js` to the caller-owned GSAP timeline using the `presets.ts` library.
7. Overlap entrances, use stagger for real sequence, and reserve strong camera pushes for the focal product moment.
8. Start ordinary scene handoffs before the outgoing scene has finished.
9. Watch representative frames and continuous playback in a real browser.

---

## Product Showcase / UI Cinematography

When the ad reaches the product, show the product doing something:

- Use real product screenshots, provided UI references, or authentic product HTML/CSS surfaces.
- Motivate the reveal: a prompt pill expands into the product window via **MORPH** or **MATCH-CUT**.
- Treat the UI like a filmed object:
  - **Camera Move 1**: Push in on the active composition preview canvas (`scale: 1.45`).
  - **Camera Move 2**: Pan down across timeline track lanes (`y: -300px`).
  - **Camera Move 3**: Pull back to full overview (`scale: 1.0`).
- Bookend Continuity: Workspace elements converge via **PARTICLE-REASSEMBLE** into a centered brand token (`84×84px`) where the animated SVG logo draws live.

---

## Anti-Slideshow Review Checklist

Before finishing, inspect still frames and continuous playback. Fix if any answer is yes:

- Does this beat read as headline + subtitle + graphic + fade out? *(Fix: replace with single full-size editorial sentence)*
- Is there a muddy grey wash over the canvas? *(Fix: remove global dark veil)*
- Is a blinking cursor sitting in an empty pill? *(Fix: remove premature cursor)*
- Is text off-center or microscopic? *(Fix: use Inter 68px/700 with `xPercent: -50, yPercent: -50`)*
- Does any frame stay completely static for >1.5s? *(Fix: add ambient wave flow or aurora drift)*
- Is opacity doing the job that MORPH, MATCH-CUT, or scale travel should do? *(Fix: implement physical morph)*
