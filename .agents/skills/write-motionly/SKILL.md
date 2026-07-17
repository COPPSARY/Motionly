---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly `.motion` projects. Use when an agent needs to turn a script, audio track, storyboard, or asset folder into a polished Motionly animation; choose Motionly transitions and presets; synchronize visuals to narration; fix composition or overlap; or explain valid `.motion` syntax.
---

# Write Motionly

Create a readable `.motion` project that previews, edits, saves, reloads, and exports correctly in Motionly. The result is an editable project, not a black-box rendered video.

Read [references/motion-syntax.md](references/motion-syntax.md) completely before writing syntax or choosing presets. Treat the repository's `AGENTS.md`, parser, evaluator, preset implementation, and serializer as authoritative when examples disagree.

## Establish The Contract

Before editing, determine:

- whether this is a new project, a repair, or a refinement of existing user work
- output path, canvas size/aspect ratio, FPS, and exact duration
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

- Preserve aspect ratio by setting one of `width` or `height`, not both, unless distortion is intentional.
- Do not place every available asset on screen.
- Keep photos, screenshots, textured art, and detailed logos in their original format.
- Use `drawSVG` only for simple stroked SVG artwork intended to draw on.
- Prefer `maskReveal`, `dynamicSlide`, or a normal reveal for detailed media.
- Keep original asset paths stable so save/reload and export use the same files.

Before generating or converting missing supporting artwork, ask one concise question only when it would materially improve the result. Continue with existing assets if declined.

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
- Include deliberate exits with `exitAt` and `exitDuration`.
- Prefer one strong transition per scene change over stacked effects.

Avoid repeated fade-only scenes, random rotation, large bounce, constant camera motion, and applying the same entrance to every object.

## Source Rules

- Use only syntax supported by the current parser and renderer.
- Use `size`, not `fontSize`.
- Explicit `animate` blocks use `easing`; preset calls use `ease`.
- Keep names/aliases single words and imports quoted.
- Keep source readable and minimize unnecessary layers.
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
