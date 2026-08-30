# Motionly Agent Notes

Motionly is a code-first motion graphics tool. Read `.agents/skills/write-motionly/SKILL.md` before substantial composition, timing, transition, camera, export, or product-film work.

## Product rule

TypeScript compositions are the only project source. A composition creates HTML/SVG and writes motion into a GSAP timeline. Preview and export mount that composition directly.

Keep the visual editor: centered preview, correct aspect ratio, Play/Pause/Restart, deterministic scrubber, storyboard scenes, selection, position/scale/rotation/opacity/text controls, assets, presets, and export.

## Motion quality

- Build one focal action at a time.
- Use overlap and stagger to create rhythm; do not queue every entrance.
- Prefer `power4.out` for arrivals and `power3.inOut` for camera/layout travel.
- Keep most entrances between 0.45 and 0.8 seconds.
- Use spring or overshoot only when the material calls for it.
- Transform between scenes; avoid repetitive fade-wait-fade patterns.
- Start ordinary scene transitions before the outgoing scene ends. Require a visible overlap and shared directional handoff instead of a hard hide/show cut.
- Watch the real browser preview at opening, transition, camera, and CTA frames.

## Runtime boundary

`CompositionDefinition.build()` is the boundary. It receives `root`, `timeline`, and `register`. Do not introduce a second project representation, interpreter, conversion step, or renderer.

Use the helpers in `src/composition/presets.ts`, extend that small library when a reusable motion idea is genuinely missing, and keep each helper composable on a caller-owned timeline.
