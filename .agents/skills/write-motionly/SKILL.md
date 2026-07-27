---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly `.motion` projects. Use when an agent needs to turn a script, audio track, storyboard, or asset folder into a polished Motionly animation; choose Motionly transitions and presets; synchronize visuals to narration; fix composition or overlap; or explain valid `.motion` syntax.
---

# Write Motionly

Create a readable `.motion` project that previews, edits, saves, reloads, and exports correctly in Motionly. The result is an editable project, not a black-box rendered video.

Read [references/motion-syntax.md](references/motion-syntax.md) completely before writing syntax or choosing presets. Treat the repository's `AGENTS.md`, parser, evaluator, preset implementation, and serializer as authoritative when examples disagree.

## Establish The Contract

Before editing, infer sensible technical defaults from the brief and determine:

- whether this is a new project, a repair, or a refinement of existing user work
- canvas size/aspect ratio, FPS, and exact duration; ask only when the choice changes the story
- audience, communication goal, and required call to action
- exact copy that must remain verbatim
- script, narration/audio path, timestamps, and required silent holds
- brand colors, typography, logo rules, motion character, and prohibited treatments
- required, optional, and missing assets

Make reasonable defaults only when they do not change the story or destroy user work. Preserve unrelated existing source and assets.

## Workflow

1. Read the request, existing `.motion`, `AGENTS.md`, `BRAND.md`, script, timestamps, and relevant asset files.
2. Inventory assets. Inspect dimensions, aspect ratios, file types, and media durations before placement.
3. Build a timing map from narration, supplied timestamps, or the exact duration. Do not estimate media duration when it can be probed.
4. Storyboard distinct shots. For each shot define purpose, time range, focal subject, supporting elements, entrance, readable hold, exit, and transition.
5. Write or edit the smallest valid `.motion` source that realizes that storyboard.
6. Run `inspect:motion` with the expected duration. Review invalid state, round-trip stability, signatures, and every empty-frame range.
7. Preview representative frames at shot starts, completed holds, transitions, exits, and the final frame. Fix overlap, clipping, distortion, missing assets, and stale layers.
8. Repeat write → inspect → preview → fix until the project is clean, then run relevant repository tests/build checks.

Do not introduce new engine features while authoring. If the brief needs an unsupported capability, use the nearest supported treatment and state the limitation.

## Storyboard Standard

Use one focal subject per shot. A useful shot plan contains:

| Time | Purpose | Focal subject | Support | Entrance | Hold | Exit/transition |
| --- | --- | --- | --- | --- | --- | --- |
| `0–3s` | Establish promise | Headline | Brand mark | Rise/blur reveal | Readable for at least 1s | Shape wipe |

Vary composition when the story changes: full-frame typography, editorial left/right layouts, centered hero media, or restrained grouped assets. Do not vary motion randomly.

## Assets

- Treat MP4, WebM, MOV/M4V, GIF, animated SVG, and Lottie as animated media. Never flatten them to still images or silently ignore their motion.
- Preserve aspect ratio by setting one of `width` or `height`, not both, unless distortion is intentional.
- Do not place every available asset on screen.
- Keep photos, screenshots, textured art, and detailed logos in their original format.
- Use `drawSVG` for simple stroked SVG artwork intended to draw on.
- Prefer native SVG or overlay primitives for logos, icons, diagrams, badges, illustrations, line art, and UI graphics unless the user explicitly wants an imported animation preserved.
- Browser-decoded video support depends on the file codec. Animated SVG uses a real-time Canvas SVG runtime and cannot be deterministically frame-seeked; CSS keyframes may differ from browser DOM playback. Report these real limitations instead of calling the format unsupported.
- Keep original asset paths stable so save/reload and export use the same files.

Before generating or converting missing supporting artwork, ask one concise question only when it would materially improve the result. Continue with existing assets if declined.

## Native SVG And Vector Motion

- Animate SVG layers with the same `x`, `y`, `scale`, `rotation`, `originX`, `originY`, `skewX`, `skewY`, `opacity`, `blur`, mask, fill, and stroke system used by other elements.
- Use normalized `originX`/`originY` values from `0` to `1` to push into a specific region of an SVG.
- For "zoom into the logo," "pan across the diagram," or similar requests, animate the SVG itself. Do not move the global camera when only one artwork changes focus.
- Separate meaningful vector parts only when they need independent timing; stagger related parts by roughly `60–140ms` and hold the completed artwork.
- `trimStart` generalizes `drawSVG`'s draw-from-start reveal into a partial-arc "trim path": set `trimStart` alongside an animated `pathProgress` (the existing `drawSVG` preset drives this) to get a moving trimmed segment (comet-trail) instead of a fixed draw-in. See [motion-syntax.md](references/motion-syntax.md).
- `motionPath` moves (and, with `motionPathRotate`, orients) an element along an imported SVG path or a native `path ... { guide }`, driven by `motionPathProgress` (0-1).
- Shared-element transitions morph paths only when their command topology is compatible. Incompatible paths use the deterministic move/crossfade fallback. Gradient-stop animation remains unsupported.

## Script, Audio, And Timing

- Preserve requested narration/on-screen copy exactly, including punctuation and order.
- Split long copy only for layout; do not paraphrase unless asked.
- Probe audio duration and set canvas duration to include the complete track and closing hold/fade.
- Place entrances on the spoken phrase when timestamps exist.
- Keep text readable long enough for the audience; an entrance immediately followed by an exit is a timing bug.
- Reveal a logo and its matching label together.
- Project audio stays on the bottom audio track. Its `start` offset must match the intended timeline position and survives save/export.
- Moving a whole layer should move its animation/keyframes with it; trimming changes the visibility window without silently retiming keyframes.

## Layers And Clips

Treat visual timeline tracks as simple layers:

- horizontal movement changes time and keeps the current layer
- vertical movement changes to the explicitly targeted layer
- overlaps are allowed and resolved by deliberate visual ordering
- visual content type does not restrict placement
- do not rely on magnetic packing, ripple editing, or automatic content allocation
- keep audio on the bottom audio track

Persist explicit track assignments, `start`, and `duration` when timing matters. Verify them after parse/serialize/parse.

## Motion Doctrine

Non-negotiable quality rules; the engine enforces several and the inspector reports the rest. Full text: `docs/animation/motion-doctrine.mdx`.

- **Arrivals reveal binary.** Opacity snaps to full in the first frame and the movement carries the entrance. Never fade an arrival in.
- **One entrance is at most 800ms.** A longer buildup is a staggered group, never one slow element. Exits run about 75% of their entrance.
- **A group entrance is a wave, not a queue.** Gaps shrink across the cascade (×0.84), travel and duration scale by weight (focal 64px over 0.62s, support 40px over 0.46s), and the whole group lands inside 0.5s however many items it holds.
- **`power4.out` for arrivals, `power3.out` to settle.** Never an `.inOut` curve on an entrance. Bouncy overshoot (`back.out`, `elastic.out`) is the clearest tell of machine-made motion — playful registers only.
- **Idle drift is not sustained motion.** Float, breathe, and glow pulse read as waiting. Every beat declares a route: `stagedReveals`, `cameraIntent`, `uiLife`, `sequence`, `cursorLed`, or `hold`. Nothing may sit still longer than 1.4s; pause anywhere and something meaningful must be mid-flight.
- **Stillness before climax.** Schedule 0.3–0.75s between a major action and its result.
- **Transform between shots, never fade.** One dominant direction per film; a direction change needs a visible cause. Cause and effect fire on the same frame.
- Moves longer than 2.8s read as drift; shorter than 0.08s do not register.

Verify with `npm run inspect:motion -- project.motion --strict`. It reports entrances over budget, queued or over-long cascades, dead zones, zero-area elements, elements never inside the canvas, and unrelated elements stacked on each other.

## Motion System

Select complete motion design ideas before placing primitives. Beats pace, layouts compose, showcases present.

- `beat NAME { start 4s duration 6s focus subjectId zoom 1.3 route cameraIntent transition cameraMove label "Product reveal" }` is a change in focus, not a slide. Beats emit no scene root, so the composition persists and evolves. Omit `start` to run back to back; omit `duration` to share remaining canvas time. Attach any block with `beat NAME` to inherit its pacing. Every beat declares a `route`; an authored route is validated against the beat's content.
- Every block is already in the engine — nothing is installed to use one. To read a working example without touching the project: `npx @coppsary/motionly catalog --show bentoGrid`. To copy it in as a starting point: `npx @coppsary/motionly add bentoGrid`. `catalog --type layout|showcase` lists them and marks which have examples.
- `layout NAME { type bentoGrid columns 3 gap 40 }` owns composition. Children declare `parent NAME`; the solver assigns position, size, and a staggered entrance on an 8px rhythm. Never hand-place `x`/`y`/`width` when a layout fits — but an authored value always wins if the composition needs it. Types: heroLayout, splitLayout, bentoGrid, featureGrid, masonryGrid, deviceStack, logoWall, comparisonLayout, timelineLayout, carousel, gallery, floatingCollage.
- `showcase NAME { type phoneShowcase media alias headline "..." behavior float }` turns one real asset into a product presentation: bezel, screen crop, chrome, glare, shadow, entrance, idle float, camera push. Never build a device out of rectangles. Types: productHero, phoneShowcase, browserShowcase, laptopShowcase, appWindow, dashboardShowcase, screenshotPresentation, uiWalkthrough. Behaviors: float, push, highlight, still.
- Beat transitions transform instead of fading: `sharedElement`, `objectMorph`, `layoutMorph` (each requires `from` and `to` naming declared elements), or `cameraMove`, `continuous`, `cut`. A focus change with no named transition becomes a camera move; a held focus stays continuous.
- Asset kinds drive selection: tall captures are phone screenshots (phoneShowcase), wide captures are desktop UI (dashboardShowcase / browserShowcase / laptopShowcase), many icons become a bentoGrid or featureGrid, many logos become a logoWall.
- Full contract: [motion-syntax.md](references/motion-syntax.md).

## Semantic Components

- Compose recognizable interfaces from the component library before hand-drawing UI: `component name { type dashboard ... }`. Types: cloud, database, server, arrow, button, dashboard, phone, browser, logo, chart, notification, cursor, codeeditor, website, terminal, pricingcard, laptop, and editor (the Motionly workspace itself).
- Components compile into structured parts named `NAME__PART` with built-in staggered choreography and Space Grotesk typography. Fill them with `label`, `detail`, `headline`, `url`, `cta`, `values`, `labels`, and `countTo`.
- Customize any part with a dotted override (`price.countPrefix "€"`, `headline.color #fff`) or animate it directly (`animate NAME__PART { ... }`). Unknown parts error with the available part names.
- Wire cause and effect: `connects TARGET` (drawn connector + data particle), `clicks TARGET` + `clickAt` on a cursor, `reactsTo TARGET` for consequences, `exitAt`/`exitDuration` for deliberate exits.
- Full contract: [motion-syntax.md](references/motion-syntax.md).

## Composition

- Use a repeatable spacing system and verify actual bounds.
- Keep supporting elements subordinate and spatially separated.
- Keep long copy away from media edges; reduce size or split lines before allowing clipping.
- Use background/color changes and purposeful movement to mark story progression.
- Remove stale elements after their shot instead of leaving unrelated layers stacked.
- Treat accidental overlap, stretched media, unreadable type, and unexplained blank frames as bugs.

## Motion Direction

- Default to `power3.out`.
- Use entrances around `650ms–1s` unless timestamps require otherwise.
- Use staggered word/character reveals only for important copy.
- Use `maskReveal` for hero media and `dynamicSlide` for supporting assets.
- Use `shapeWipe` or `irisWipe` for genuine scene changes.
- Use `speedZoom` once at a meaningful transition, not as continuous camera drift.
- Pair scene `transitionOut` and `transitionIn` with the same `sceneSlide` direction or `sceneZoom` treatment. These move the scene root, so every child layer travels together.
- For product demonstrations, use `focusZoom` for whole-UI to feature detail, `snapMove` for visible drag/reposition actions, `cursorTap` for presses, `popover` for panels, and `rackFocus`/`depthSwap` to change attention without cutting.
- Use `zoomThrough` or `whipPan` for a genuine fast transition; use `cascadeIn` for a short related sequence and `orbitDrift` only for a subject whose story is actually orbital.
- Include deliberate exits with `exitAt` and `exitDuration`.
- Prefer one strong transition per scene change over stacked effects.

Avoid repeated fade-only scenes, random rotation, large bounce, constant camera motion, and applying the same entrance to every object.

For professional launch work, vary the story beats: establish the promise, show product proof, focus on one feature, then resolve to the brand/CTA. Reuse a coherent motion language without repeating identical choreography.

## Source Rules

- Use only syntax supported by the current parser and renderer.
- Use `size`, not `fontSize`.
- Explicit `animate` blocks use `easing`; preset calls use `ease`.
- Keep names/aliases single words and imports quoted.
- Keep source readable and minimize unnecessary layers.
- If `motionly-skills/llms.txt` exists, use it to load only the focused skills needed for SVG, animation, easing, camera, composition, typography, transitions, timeline, assets, rendering, or templates.
- Never hand back only a fragment when the user requested a complete project.
- Never replace existing user work wholesale unless the request authorizes it.

## Validation

Run after every substantial authoring pass:

```powershell
npm run inspect:motion -- path\to\project.motion --expect-duration=<seconds>
```

This command parses and builds the scene, evaluates every declared frame, detects non-finite state and empty ranges, checks parse/serialize/parse stability, and prints representative signatures. Empty ranges are evidence, not automatic failures; compare each one with the storyboard.

The inspector cannot prove pixel layout, font availability, or browser media decoding. After it passes, inspect the rendered canvas at:

- the first visible frame
- each shot entrance and completed hold
- one frame before, during, and after every transition
- every exit boundary
- the final intended visible frame

Before finishing, confirm:

1. Canvas size, FPS, and duration match the request.
2. Required imports resolve and required assets appear.
3. Exact copy matches the supplied script.
4. Audio, visual clips, and narration cues align.
5. No unexplained blank frames, clipping, distortion, overlap, or stale layers remain.
6. Tracks, masks, timing windows, animation delays, and keyframes survive round-trip serialization.
7. Preview and deterministic MP4 export evaluate the same project timing.
8. Relevant tests/build checks pass.

Return the completed `.motion` file and a brief validation summary.
