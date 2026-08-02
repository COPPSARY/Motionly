---
name: transitions
description: Plan Motionly scene, beat, shared-element, object, layout, camera, cut, media, and text transitions. Use to fix stale layers, abrupt cuts, double exposure, uncovered frames, and repetitive fade/zoom behavior.
---

# Transitions

Read [authoring-contract.md](../../references/authoring-contract.md) and
[motion-catalog.md](../../references/motion-catalog.md).

Choose the relationship before the effect:

- same identity changes position/scale: shared element/local transform;
- one matched subject becomes another: `objectMorph` with `from` and `to`;
- an arrangement reorganizes: `layoutMorph` with `from` and `to`;
- persistent composition changes attention: `cameraMove`;
- composition keeps evolving: `continuous`;
- unrelated shot: `cut`;
- touching media clips on one track: clip `crossfade`.

Scene/beat boundary kinds are `sharedElement`, `cameraMove`, `continuous`, and
`cut`. Paired beat transition kinds `sharedElement`, `objectMorph`, and
`layoutMorph` require both named endpoints. Scene syntax is:

```motion
scene detail {
  duration 5s
  transition sharedElement
  transitionDuration 700ms
}
```

Prefer storyboard boundaries over manually paired scene-root presets. Explicit
`transitionIn`/`transitionOut` remain available for overlapping scene roots;
pair the same recipe, direction, and duration on both sides. Clip `transitionIn`
and `transitionOut` only accept `crossfade`.

Give each boundary one owner: either the scene root carries the handoff or its
subjects carry authored exits and entrances. Do not move both in competing
directions. A text handoff starts the outgoing move first and overlaps the
incoming move by roughly 20-35% of the exit; use `exitDirection` and
`exitDistance` when its departure differs from its arrival. Calculate travel
from the subject bounds: a wide headline may need more than one canvas width to
leave the frame.

Use the shared transition scale unless the story requires a deliberate override:

| Intent | Duration | Travel | Scale | Blur |
| --- | ---: | ---: | ---: | ---: |
| micro feedback | `.08s` | `4px` | `.99` | `0-2` |
| quick control/panel | `.15-.25s` | `6-12px` | `.96-.99` | `0-2` |
| object or text handoff | `.35-.4s` | `12-30px` | `.96-1.04` | `0-3` |
| scene emphasis | `.5s` | authored for frame coverage | `.96-1.06` | `0-3` |

The runtime uses `cubic-bezier(0.22, 1, 0.36, 1)` for planned transform
handoffs; use `power4.out`/`power3.out` in authored preset calls. Close/exit
motion is faster and quieter than open/enter motion. Keep a stagger wave below
`.3s` total. Never use blur above `8`; ordinary transitions cap at `3`.

Do not default to fade out/in. Transform, reframe, match cut, or cut with cause.
Use `shapeWipe`/`irisWipe` only when a full-frame graphic wipe is the narrative;
use `dynamicSlide`, `zoomThrough`, or `whipPan` only when the subject relationship
supports it. One strong transition beats stacked blur, wipe, spin, and zoom.

Runtime defaults are intentionally restrained: `focusZoom 1.12`,
`zoomThrough 1.25`, `dynamicSlide 30px`, `popover .96`, scene depth
`.96 -> 1` or `1 -> 1.06`, and ordinary transition blur `3`.

Inspect one frame before, during, and after every boundary for stale content,
blank coverage, clipping, double exposure, and unreadable copy.

Vary adjacent handoffs by relationship, not randomly: continue text through a
word or directional carry; move UI into a demo with depth or matched framing;
recompose persistent UI with camera movement; reserve a scale/tilt, tracking
reveal, or clean cut for a distinct delivery/close beat. Background and focal
content must travel as one composition unless the background itself is the wipe.

For media boundaries, put backgrounds on a lower explicit track than video,
keep opaque scene fills below the clip, and clear or move prior foreground
content before playback begins. A clipped asset with `scene NAME` must inherit
that scene's transforms. Verify the asset URL/codec, clip window, evaluated
element, and final draw order before changing its animation.
