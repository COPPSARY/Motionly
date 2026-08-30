---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly code-first TypeScript compositions built with semantic HTML/SVG and GSAP. Use for Motionly product films, scenes, components, animation choreography, text reveals, stagger, camera moves, timeline behavior, preview, visual overrides, or export.
---

# Write Motionly compositions

Author TypeScript compositions against `CompositionDefinition` in `src/composition/types.ts`.

## Workflow

1. Write a short story spine and divide it into typed scenes with starts and durations.
2. Build semantic HTML/SVG nodes in `build({ root, timeline, register })`.
3. Register important nodes with stable ids so the editor can select and override them.
4. Add motion to the caller-owned GSAP timeline. Use helpers from `src/composition/presets.ts` before creating a new helper.
5. Overlap entrances, use stagger for groups, and reserve the strongest camera move for the focal product moment.
6. Start ordinary scene handoffs before the outgoing scene has finished. Use `sceneHandoff` or an equally explicit shared transform so two roots overlap for roughly 0.5–0.9 seconds.
7. Mount the composition through `CompositionRuntime`; never introduce an interpreter or parallel renderer.
8. Give every scene three readable phases: arrival, active transformation, and resolve. Static support objects still need an authored role such as a reveal, state change, parallax response, or deliberate hold.
9. Verify Play by observing a real animated target change over wall-clock time. A moving timeline marker alone is not proof that animation playback works.
10. Verify Pause, Restart, frame-quantized seek, every scene boundary, selection, and export.
11. Watch representative frames, every handoff midpoint, and continuous playback in a real browser; revise composition, clipping, rhythm, and hierarchy until the motion reads as one directed film.

## Quality contract

- Keep most entrances within 0.45–0.8 seconds.
- Use `power4.out` for arrivals and `power3.inOut` for camera/layout travel.
- Let focal elements travel farther and settle later than support elements.
- Use mask and blur reveals to clarify hierarchy, not as decoration.
- Use spring or overshoot only for tactile or playful materials.
- Avoid identical entrance timing, continuous drift, and repetitive fade cycles.
- Keep text readable before starting the next semantic action.
- Use a subtle grid, light field, or another restrained spatial reference when camera movement would otherwise be visually ambiguous.
- Define camera moves as `subject → destination → settle`. Move toward a meaningful detail, keep one dominant direction, and give the viewer time to read the result.
- Do not leave decorative metadata, cards, badges, or diagrams permanently static unless their stillness is intentionally supporting the focal action.
- Do not implement ordinary scene changes as a hard hide/show pair. The outgoing composition must visibly transfer direction, scale, mask, or focus into the incoming one.

## Runtime contract

Preview and export must observe the same mounted DOM and GSAP timeline state. Explicit seeks are deterministic and frame-quantized. Composition code is the only project source.

GSAP owns visual frame updates. Throttle editor snapshot/readout notifications so the Svelte shell does not rerender on every animation tick. Runtime QA must compare a target's computed transform or opacity before and after Play, in addition to checking timeline time.

Read `docs/architecture.md` for the runtime boundary and `docs/animation-presets.md` for the helper surface.
