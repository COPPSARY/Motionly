---
title: Write Motionly Agent Skill
description: How the write-motionly skill guides agents when creating, editing, retiming, reviewing, and repairing .motion projects.
---

# Write Motionly Agent Skill

The `write-motionly` skill is the repository workflow for agents that create, edit, retime, review, or repair `.motion` projects.

It is designed for turning a script, audio track, storyboard, or asset folder into a polished Motionly animation that still opens cleanly in the visual editor.

## When To Use It

Use `write-motionly` when an agent needs to:

- Create a complete `.motion` project
- Retiming animation to narration or audio
- Choose supported transitions and presets
- Fix visual overlap, clipping, stale layers, or weak composition
- Explain valid `.motion` syntax
- Validate a generated animation before handing it back

## Required Agent Context

Agents should read:

- `AGENTS.md` for product boundaries and supported syntax expectations
- `.agents/skills/write-motionly/SKILL.md` for the authoring workflow
- `.agents/skills/write-motionly/references/motion-syntax.md` for properties, presets, and syntax details

The repository parser and preset implementation are authoritative if they differ from older generated examples.

## Workflow

1. Inspect the request, existing `.motion` project, script, audio, and every relevant asset.
2. Determine canvas size, frame rate, exact duration, output path, and whether spoken copy must appear verbatim.
3. Storyboard distinct shots before editing.
4. Give each shot a purpose, focal subject, supporting elements, entrance, exit, and time range.
5. Write or edit the smallest valid `.motion` project that realizes the storyboard.
6. Parse the project, run relevant tests, and inspect representative frames.

Agents should not invent new engine features while authoring a project. Missing editor or renderer capabilities should be handled as separate engineering work.

## Asset Rules

- Inventory asset paths before placing them.
- Inspect image and SVG dimensions before layout.
- Preserve original aspect ratios.
- Do not stretch assets.
- Do not place every available asset on screen.
- Use `drawSVG` only for simple stroked artwork.
- Use `maskReveal`, `dynamicSlide`, or normal image reveals for detailed logos, screenshots, and illustrations.

## Script And Audio Rules

- Preserve exact script text when requested.
- Split long sentences only for layout, keeping words and punctuation unchanged and in order.
- Probe audio duration instead of guessing.
- Set canvas duration to cover the full track and closing fade.
- Place text entrances at the spoken phrase when timestamps are available.
- Keep labels and matching logos revealed together.

Audio can be attached in the editor for preview, but it is currently session-based and is not included in MP4 export.

## Motion Direction

- Default to `power3.out`.
- Use entrances around `650ms` to `1s`.
- Use staggered word reveals for important copy, not every label.
- Use `shapeWipe` or `irisWipe` for real scene changes.
- Use `maskReveal` for hero media.
- Use `dynamicSlide` for supporting assets and logo groups.
- Use `speedZoom` once at a meaningful transition, not as continuous camera drift.
- Include deliberate exits with `exitAt` and `exitDuration`.

Avoid repeated fade-only scenes, random rotation, large bounce, accidental overlap, and constant camera motion.

## Validation Checklist

Before finishing, an agent should:

- Parse the final `.motion` file.
- Build its scene graph.
- Confirm canvas duration, imports, and expected scene elements.
- Verify exact script text against ordered text layer values.
- Inspect frames around scene starts, holds, transitions, and exits.
- Check for blank frames, overlap, clipping, distortion, and stale layers.
- Confirm parse/serialize/parse does not lose keyframes.
- Run the repository tests and build commands that cover the changed project.

The final output should be a completed `.motion` file that users can refine visually in Motionly.

