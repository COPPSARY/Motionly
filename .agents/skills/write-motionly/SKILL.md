---
name: write-motionly
description: Create, edit, retime, review, and repair Motionly code-first HTML/CSS compositions animated by GSAP. Use for startup ads, SaaS explainers, product films, story pacing, narration sync, kinetic typography, semantic backgrounds, shape morphs, match cuts, particle transitions, UI cinematography, assets, and preview/export parity.
---

# Write Motionly compositions

Build a directed product film, not decorated slides. Make every visual change explain, intensify, or resolve the current spoken thought.

## Preserve the runtime boundary

```text
composition-name/
|- composition.html   # semantic HTML/SVG and scoped CSS
|- timeline.js        # GSAP choreography
`- index.ts           # metadata and mounting adapter only
```

- Treat HTML/CSS as the visual source of truth.
- Write motion into the caller-owned GSAP timeline. A nested timeline is acceptable for proportional retiming, but add it to the caller timeline.
- Keep `index.ts` thin: metadata, asset substitution, HTML mounting, and one builder call.
- Never introduce `.motion`, a JSON animation DSL, generated DOM in TypeScript, a conversion layer, or a second renderer.
- Keep stable `data-edit` ids and register editable elements.
- Use `src/composition/presets.ts`; extend it only for reusable behavior.

## Direct the story first

Use a clear change in belief:

1. Hook: state the audience's desired outcome.
2. Friction: make the obstacle recognizable.
3. Consequence: visualize the cost, failure, or wasted effort.
4. Turn: introduce the product as the answer.
5. Proof: show the real interaction or product surface.
6. Resolution: reduce the product to one memorable promise and CTA.

Give every beat one spoken thought, one focal subject, one primary action, and one transition destination. Do not add visuals merely because the frame feels empty. Read [story-timing.md](references/story-timing.md) and [silicon-valley-motion.md](references/silicon-valley-motion.md) (Zelios & ElevenLabs 6 Laws) when scripting, retiming, or animating.

## Use continuous transition ownership

Every boundary must use one of these mechanisms:

- **Morph:** keep one carrier visible while its geometry, surface, and role change.
- **Match-cut:** align position, dimensions, silhouette, and motion before swapping internal content.
- **Particle-reassemble:** emit fragments from a visible source and direct them toward a meaningful destination.

Opacity may clean up internal faces after continuity is established; it must not be the transition itself. Prefer one persistent carrier across related beats, such as statement frame -> symbolic object -> prompt surface -> product window -> brand token. Read [transitions-camera.md](references/transitions-camera.md) before designing handoffs or camera paths.

## Compose editorial typography

- Express each beat as one bold, full-sentence thought.
- Never split one thought into a giant title plus a small gray subtitle.
- Center the thought as a unit; use `xPercent: -50` and `yPercent: -50` for absolute centering.
- Enter important thoughts giant and cropped, then settle into readable focus.
- Animate words or characters in reading order with restrained stagger and spring overshoot.
- Keep punctuation attached and preserve natural spaces.
- Apply sentence-wide gradients in shared coordinates. Do not restart the gradient on every word.
- Reserve gradients for emphasis and retain enough solid ink for immediate readability.
- Give the completed sentence a real reading hold before its exit.

Read [typography-backgrounds.md](references/typography-backgrounds.md) for split-text handling, hierarchy, background direction, and stability.

## Make backgrounds support meaning

Build a quiet system: base field, faint structure, slow ambient light, then one beat-specific accent. Keep background contrast, frequency, and speed below the focal subject.

- Use rising marks for cost or momentum.
- Use ripples, scan lines, or dispersed particles for uncertainty or failure.
- Use circular waves and orbiting particles for a reveal or convergence.
- Let color temperature change with the story.
- Remove or transform a beat-specific accent when its idea ends.
- Avoid arbitrary particles, decorative blobs, muddy veils, and motion with no narrative relationship.

## Choreograph readable motion

- Separate arrival, settle, readable hold, and departure.
- Overlap transitions, but do not overlap competing messages.
- Alternate energy: fast setup, readable settle, emphasized consequence, spacious proof.
- Use `back.out(...)` for tactile text and controls; use `power3.inOut` or `power4.inOut` for camera and geometry.
- Keep subtle ambient drift during holds. Continuous motion does not mean constant foreground motion.
- Animate counters in fixed-width containers to prevent layout wobble.
- Do not reveal a cursor until typing begins.
- Preserve close prompt framing through its workspace morph unless the story motivates a pullback.
- After showing UI, hold it for inspection, then use one deliberate camera move instead of repeated zooming.

## Show real product behavior

- Use authentic screenshots, supplied assets, or faithful product HTML/CSS.
- Make the reveal causal: prompt -> action -> workspace.
- Keep prompt controls credible and proportioned like a real composer.
- Use a shared shell so the prompt physically becomes the product window.
- Make the active task legible; decorative dashboards are not proof.
- Collapse the product surface into the brand token or CTA with the same carrier.

Read [assets-export.md](references/assets-export.md) when importing media, using filters, or preparing export.

## Build deterministically

1. Set all hidden, transformed, and layered initial states at time `0`.
2. Use explicit timeline positions for story beats.
3. Keep scene and track metadata truthful to the timeline.
4. Base timing on seconds. Changing fps adds samples; it must not alter speed.
5. For global retiming, change a nested timeline's `timeScale` and scale metadata by the inverse factor.
6. Seek representative frames and inspect continuous playback in a real browser.
7. Verify preview/export parity, asset loading, text bounds, end-state cleanup, codec, and fps.

## Reject these failures

- title + subtitle + card composition;
- fade, hard cut, or wipe as the primary handoff;
- overlapping, reflowing, or clipped split words;
- a separate repeated gradient on every word;
- background motion that competes or has no meaning;
- cursor blinking before typing;
- product screenshot appearing without a causal bridge;
- camera push, reset, then another unmotivated push;
- filter, hidden screenshot, or backdrop blur surviving into the logo;
- foreground beats too brief to read;
- storyboard timing that differs from GSAP;
- cross-origin or tainted export sources.

## Reusable helper guidance

- `morph`: persistent geometry and surface transformation.
- `cameraZoomPan`, `cameraPush`, `cameraPull`: motivated reframing.
- `wordSlideRotate`, `charSpringBounce`, `textReveal`: reading-order typography.
- `giantKineticCrop`: high-emphasis giant-to-settle entrance.
- `continuousTextGradient`: one gradient across split words.
- `gradientSweep`: temporary keyword emphasis.
- `ambientWaves`: low-frequency background life.

Use helpers as verbs, not a fixed style. Vary intensity, direction, duration, and visual language for the audience. Never copy a preset's exact colors, dimensions, copy, timestamps, or scene count.
