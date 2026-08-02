---
name: animation
description: Choreograph readable Motionly entrances, holds, exits, UI life, staggered groups, camera paths, text presets, and editable keyframes with professional timing and non-repetitive motion.
---

# Animation

Read [authoring-contract.md](../../references/authoring-contract.md), then
[motion-catalog.md](../../references/motion-catalog.md). Animation comes after
story, layout, component selection, and continuity.

## Choreography

- one focal subject per shot;
- binary arrival: motion carries the reveal, not a long opacity fade;
- one entrance is at most 800ms;
- group arrivals are a wave with shrinking gaps, not a queue;
- focal travel is about 64px/620ms; support travel about 40px/460ms;
- keep the complete cascade inside about 500ms;
- reserve 300-750ms of stillness between a major action and its result;
- add a readable hold after text/UI settles;
- animate genuine exits so old content cannot stack under new content;
- every long beat needs staged reveals, UI life, sequence, cursor action, camera intent, or deliberate hold.

For editorial copy, choreograph a handoff rather than independent title cards:
the outgoing line begins leaving, the replacement enters during that travel,
and both complete before the next boundary. Keep entrance and exit directions
independent when the story calls for it. Do not repeat the same slide, zoom, or
split treatment on adjacent beats.

Use `power4.out` for arrivals and `power3.out` to settle. Use spring/bounce only
for a deliberately playful product moment. Do not apply the same preset to every
layer or make every asset zoom/pan.

## Presets

Text entrances/exits and transitions are listed in [motion-catalog.md](../../references/motion-catalog.md).
Object moves include `softReveal`, `scaleReveal`, `cardReveal`, `productPanel`,
`drawSVG`, `cascadeIn`, `snapMove`, `popover`, `cursorTap`, `shakeReject`,
`rackFocus`, `depthSwap`, `mediaTour`, `zoomThrough`, and `whipPan`.

Use `animation "NAME(options)"` on objects and `textAnimation "NAME(options)"`
on text. Use explicit `animate TARGET { from ... to ... duration ... easing ... }`
when a preset cannot communicate the actual authored path.

An exit needs `exitAt`/`exitDuration` in a preset or a separate explicit exit.
Use `exitDirection`/`exitDistance` when a transition must leave differently
from how it arrived. Travel must clear the element's full bounds, not merely
reach the canvas edge.
Do not leave opacity at zero in a hidden layer and then author a later animation
from opacity one; inspect the evaluated first frame of every animation.

Inspect real media before directing it. Establish the full screenshot first,
then choose focus points from its actual composition; use restrained perspective
and pan only when they reveal a meaningful region. Do not apply the same generic
zoom path to every image or video. Sample the first frame, settled hold, each
focus point, and every boundary start/middle/end.
