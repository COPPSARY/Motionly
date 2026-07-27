---
name: components
description: Compose scenes from Motionly's semantic component library — structured, professionally designed UI primitives (terminal, dashboard, browser, phone, pricing card, editor, and more) with built-in choreography, content properties, dotted part overrides, and cause-and-effect wiring. Use before hand-drawing any interface.
---

# Semantic Components

A `component` block compiles into a structured group of ordinary editable
elements — frames, toolbars, cards, labels, charts, code lines — with a
staggered entrance choreography designed by a motion designer. Compose scenes
from components first; hand-draw with `overlay`/`text`/`path` only when no
component fits, at the same design quality.

## Types

`cloud` `database` `server` `arrow` `button` `dashboard` `phone` `browser`
`logo` `chart` `notification` `cursor` `codeeditor` `website` `terminal`
`pricingcard` `laptop` `editor`

`editor` is the Motionly workspace itself: rail, top bar, canvas, timeline,
properties, a typed prompt, and a draft that assembles while layer chips
answer each object. `terminal` is an agent console with prompt, progress,
and success line. `pricingcard` counts its price up. `laptop` and `browser`
carry assembling page content. `dashboard` staggers metric cards and draws
its chart from zero.

## Core Properties

```motion
component board {
  type dashboard
  role main
  label "Production"
  values "$18.4k  4,812  99.9%"
  labels "Revenue  Signups  Uptime"
  width 1040
  accent #3E8BFF
  surface #10151F
  delay .45s
  duration .8s
}
```

- Placement: `x`, `y`, `width`, `layer`, `parent` (parent a component to a
  `scene` for windowed timing; delays become scene-local).
- Content: `label`, `detail`, `headline`, `url`, `cta`, `values`, `labels`,
  `countTo`. Separate multi-item `values`/`labels` with two spaces (items may
  then contain commas).
- Look: `color`, `accent`, `surface`; glyph types also accept `fill`,
  `stroke`, `strokeWidth`, `glow`, `glowColor`.
- Timing: `delay` (entrance start), `duration` (entrance length),
  `exitAt`/`exitDuration` (deliberate exit).
- Component text renders in Space Grotesk, the bundled display face.

## Parts: Override and Animate Anything

Every generated part is a normal element named `NAME__PART`. Two escape
hatches make the library fully customizable from project source alone:

```motion
component plan {
  type pricingcard
  countTo 19
  price.countPrefix "€"      // dotted override: PART.PROPERTY VALUE
  plan.color #FF88AA
  cta.fill #22C55E
}

animate plan__price {         // animate any part directly
  from { scale 1 }
  to { scale 1.06 }
  duration .3s
  delay 2s
  easing back.out(1.5)
}
```

An unknown part name fails with the full list of available parts, so
overrides are discoverable without documentation.

## Relationships and Cause-and-Effect

- `connects TARGET` draws a connector with a traveling data particle;
  connectors inherit endpoint visibility and hide with closed scene windows.
- A `cursor` with `clicks TARGET` and `clickAt TIME` travels to the control
  and clicks it; buttons compress and glow on their own, other targets dip.
- `reactsTo TARGET` enters a component just after that target's click —
  notifications appearing as consequences, never unprompted.

## Scene Integration

- Scenes support `enter`/`exit` fade envelopes; combine with camera
  push-throughs (zoom into a component's screen at scene end, start the next
  scene pulled back from it) instead of fades to black.
- One focal component per scene (`role main`); supporting components stagger
  after it. Keep every panel populated — components never render empty.
