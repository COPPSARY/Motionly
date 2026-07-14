---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly `.motion` projects. Use when an agent needs to turn a script, audio track, storyboard, or asset folder into a polished Motionly animation; choose Motionly transitions and presets; synchronize visuals to narration; fix composition or overlap; or explain valid `.motion` syntax.
---

# Write Motionly

Create a readable `.motion` project that previews correctly in Motionly and tells one coherent visual story.

Read [references/motion-syntax.md](references/motion-syntax.md) before writing syntax or choosing presets. Treat the repository's `AGENTS.md` and current parser/preset implementation as authoritative if they differ from this skill.

## Workflow

1. Inspect the request, existing `.motion` project, `AGENTS.md`, script, audio, and every relevant asset.
2. Determine canvas size, frame rate, exact duration, output path, and whether spoken copy must appear verbatim.
3. Storyboard distinct shots before editing. For each shot define its purpose, focal subject, supporting elements, entrance, exit, and time range.
4. Write or edit the smallest valid `.motion` project that realizes the storyboard.
5. Parse the project, run the relevant tests, and inspect representative frames at scene starts, holds, transitions, and exits.

Do not introduce new engine features while authoring a project. Use the syntax and presets Motionly already supports.

## Asset Decision

Inventory asset paths and inspect dimensions/aspect ratios before placing anything. Never stretch an asset.

Before generating or converting visual assets, ask one concise question such as:

> Do you want me to create or convert any missing/simple visual assets to SVG before I build the animation?

Ask only when SVGs or new supporting artwork would materially improve the requested animation. Continue with existing assets when the user declines. Do not convert photos, screenshots, textured artwork, or complex logos to SVG. Keep original files as fallbacks.

Use `drawSVG` only for simple stroked artwork and only when the user wants a path-draw reveal. Use `maskReveal`, `dynamicSlide`, or a normal image reveal for detailed logos and illustrations.

## Script And Audio

- Preserve the script exactly when the user requests matching on-screen copy.
- Split long sentences into aligned text layers only for layout; keep their words and punctuation unchanged and in order.
- Probe audio duration instead of guessing. Set canvas duration to cover the full track and closing fade.
- Detect pauses or use supplied timestamps to place scene changes and line entrances.
- Let text enter at the spoken phrase, remain readable, and exit before the next conflicting focal point.
- When labels correspond to logos, reveal each logo and its label together.

## Story And Composition

- Give every shot one clear focal subject.
- Keep supporting elements subordinate and spatially separated.
- Use a repeatable spacing system and verify bounding boxes; accidental overlap is a bug.
- Change background or transition language when the story changes subject.
- Vary shot composition, not motion randomly. Alternate full-frame type, left/right editorial layouts, centered hero media, and restrained groups.
- Keep long copy away from media bounds. Reduce type size or split lines before allowing overlap or clipping.
- Do not place every available asset on screen.

## Motion Direction

- Default to `power3.out` and entrances around `650ms` to `1s`.
- Use staggered word reveals for important copy, not every label.
- Use `shapeWipe` or `irisWipe` for real scene changes.
- Use `maskReveal` for hero media.
- Use `dynamicSlide` for supporting assets and sequential logo groups.
- Use `speedZoom` once at a meaningful transition, not as continuous camera drift.
- Include deliberate exits with `exitAt` and `exitDuration`; do not leave unrelated layers stacked indefinitely.
- Avoid repeated fade-only scenes, random rotation, large bounce, and constant camera motion.

## Validation

Before finishing:

1. Parse the final `.motion` file and build its scene graph.
2. Confirm canvas duration, imports, and expected scene elements.
3. Verify any exact script against the ordered text layer values.
4. Inspect frames around each timestamp for blank frames, overlap, clipping, distortion, and stale layers.
5. Confirm the project survives parse/serialize/parse without losing keyframes.
6. Run the repository test and build commands that cover the changed project.

Return the completed `.motion` file, not only a storyboard or code sample.
