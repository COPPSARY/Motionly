# Motionly Syntax And Presets

## Core Project

```motion
canvas {
  size 1920x1080
  fps 60
  duration 8s
  background #050608
}

camera {
  zoom 1
  x 0
  y 0
  rotation 0
  cameraAnimation speedZoom(delay 3s duration 1s from 1 peak 1.08 to 1.02 ease power3.out)
}
```

Use `size`, not `fontSize`. Use `easing` in explicit animation blocks. Preset calls use the option name `ease`.

## Theme And Archetypes

New AI-drafted scenes should use one project theme and layout-owning archetypes.
Existing coordinate-based files remain valid.

```motion
theme {
  background #050608
  surface #12161D
  text #EDF0F4
  muted #8B94A1
  accent #7CF7C5
  secondary #8AB4FF
  gradientFrom #7CF7C5
  gradientTo #8AB4FF
  displayFont "Space Grotesk, Inter, sans-serif"
  radius 24
  shadow 24
  duration .8s
  stagger .07s
  easing power3.out
}

import "./assets/product.png" as product

archetype launch {
  type hero
  title "Show the real product."
  subtitle "The archetype owns layout; the generator fills slots."
  media product
  start 0s
  duration 5s
  effects "meshGradient > grain > vignette"
  transitionOut "sceneSlide(direction right duration .5s)"
}
```

Types are `hero`, `splitFeature`, `stat`, `walkthrough`, `comparison`,
`cta`, and `logoReveal`. Media-oriented archetypes accept imported aliases in
`media`, `secondary`, and `logo`. If required media is absent, the compiler
uses a semantic device-frame stub rather than fake product geometry.

## Motion System: Beats, Layouts, Showcases

Above archetypes sits a component layer. Select blocks by name; the engine owns
their geometry, spacing rhythm, hierarchy, and choreography. Everything lowers to
ordinary `group`, `overlay`, `image`, `text`, `transition`, and animation nodes,
so the result stays editable source.

```motion
import "./assets/dashboard.png" as dashShot

beat intro {
  duration 5s
  focus title
  label "Brand introduction"
}

beat reveal {
  duration 7s
  focus product
  zoom 1.25
  label "Product reveal"
}

beat features {
  duration 8s
  focus capabilities
  zoom 1
  transition layoutMorph
  from product
  to capabilities
  label "Feature showcase"
}

showcase product {
  type dashboardShowcase
  media dashShot
  headline "Every metric, live"
  behavior push highlight
  beat reveal
}

layout capabilities {
  type bentoGrid
  columns 3
  gap 40
  beat features
}

component planCard {
  parent capabilities
  type pricingcard
}

component alert {
  parent capabilities
  type notification
  label "Deployed"
  detail "Production is live."
}

component usage {
  parent capabilities
  type chart
}
```

### Beats

A beat is a change in focus, not a slide. Beats emit no scene root, so nothing is
cleared between them: objects persist and transform across the whole film.

Properties: `start`, `duration`, `focus`, `zoom`, `cameraX`, `cameraY`,
`transition`, `from`, `to`, `transitionDuration`, `easing`, `label`.

Omit `start` to run beats back to back. Omit `duration` to split the remaining
canvas time evenly. Attach any layout, showcase, component, text, or image with
`beat NAME` and its entrance delay resolves from that beat's start.

### Layouts

Types: `heroLayout`, `splitLayout`, `bentoGrid`, `featureGrid`, `masonryGrid`,
`deviceStack`, `logoWall`, `comparisonLayout`, `timelineLayout`, `carousel`,
`gallery`, `floatingCollage`.

Properties: `type`, `columns`, `gap`, `width`, `height`, `itemWidth`,
`itemHeight`, `order` (`linear`, `center-out`, `reverse`), `stagger`, `beat`,
`parent`, `delay`, `layer`.

Children declare `parent NAME`. The solver fills position, size, and a staggered
entrance on an 8px rhythm; an authored value always wins. Fixed-aspect children
such as semantic components are fitted inside their slot, never stretched. Each
layout enforces its supported child count.

### Showcases

Types: `productHero`, `phoneShowcase`, `browserShowcase`, `laptopShowcase`,
`appWindow`, `dashboardShowcase`, `screenshotPresentation`, `uiWalkthrough`.

Properties: `type`, `media`, `headline`, `caption`, `label`, `width`, `behavior`,
`accent`, `surface`, `focusX`, `focusY`, `beat`, `parent`, `delay`, `duration`,
`layer`.

Behaviors: `float` (idle drift), `push` (camera push expressed on the subject),
`highlight` (focus ring at `focusX`/`focusY`), `still` (suppress idle motion).

The screen clips its media, so a tall capture crops rather than distorting. Parts
are named `NAME__body`, `NAME__screen`, `NAME__media`, `NAME__chrome`,
`NAME__headline`, and so on, and can be animated directly. With no `media`, the
showcase renders an "Add product media" empty state instead of fake geometry.

### Beat transitions

`sharedElement`, `objectMorph`, and `layoutMorph` each require `from` and `to`
naming declared elements. `cameraMove`, `continuous`, and `cut` need no
endpoints. A focus change with no named transition becomes a camera move; a held
focus stays continuous. There is no global frame fade.

### Asset kinds

Imports classify as `logo`, `icon`, `screenshot`, `ui`, `illustration`, `photo`,
`video`, `avatar`, `chart`, or `unknown`. Tall captures are phone screenshots
(`phoneShowcase`); wide captures are desktop UI (`dashboardShowcase`,
`browserShowcase`, `laptopShowcase`); many icons become a `bentoGrid` or
`featureGrid`; many logos become a `logoWall`.

## Imports And Assets

```motion
import "./assets/logo.svg" as logo
import "./assets/video.mp4" as bgVideo
import "./assets/loader.lottie" as loader

logo {
  center
  layer hero
  width 240
  x 0
  y 0
  scale 1
  rotation 0
  originX .5
  originY .5
  opacity 0
  animation maskReveal(delay 1s duration 800ms direction down exitAt 5s exitDuration 450ms ease power3.out)
}
```

Preserve aspect ratio by setting one of `width` or `height`. Useful properties include `x`, `y`, `width`, `height`, `scale`, `rotation`, `originX`, `originY`, `skewX`, `skewY`, `opacity`, `blur`, `brightness`, `contrast`, `saturation`, `hue`, `grayscale`, `sepia`, `invert`, `shadow`, `center`, `cover`, and `layer`. Transform origins are normalized from `0` to `1`.

Motionly treats PNG/JPEG, static or animated SVG, GIF, MP4, WebM, MOV/M4V, and `.lottie` as visual assets. Video, Lottie, and supported GIFs seek to project time for preview and export. Animated SVG uses a real-time Canvas SVG runtime; its internal timeline cannot be deterministically frame-seeked, and CSS keyframes may differ from browser DOM playback. Motionly reports those limitations in the editor.

Static SVGs placed from the editor are decomposed into named `group` and
`path` layers. SVG IDs and Figma `data-name` labels are preserved. Unsupported
subtrees remain accurate locked `svgpart` leaves; animated SVGs stay as media.

## Scenes, Groups, Paths, And Continuity

```motion
scene productShot {
  start 2s
  duration 3s
  background #171513
  cameraX 120
  cameraY 0
  cameraZoom 1.12
}

group phone {
  parent productShot
  x 320
  scale 1
  opacity 1
  clip
}

path logoMark {
  parent phone
  d "M0 0L24 0L24 24Z"
  fill #d97757
  sourceId "logo-mark"
  label "Logo mark"
}

transition cardToPhone {
  from dashboardCard
  to phoneCard
  at 4.5s
  duration .8s
  easing power3.inOut
}
```

Scene/group child timing is parent-local. Parent position, scale, rotation,
opacity, clipping, masks, and timing affect descendants. Scene camera
properties can be keyframed normally; `depth 0` stays fixed and `depth 1`
follows the scene camera. Shared transitions interpolate compatible transforms,
colors, radius, and path geometry, with a deterministic move/crossfade fallback.

Pair whole-scene transitions on overlapping scene windows:

```motion
scene outgoing {
  start 0s
  duration 5.5s
  transitionOut "sceneSlide(direction down duration .5s)"
}

scene incoming {
  start 5s
  duration 5s
  transitionIn "sceneSlide(direction down duration .5s)"
}
```

`sceneSlide` supports `up`, `right`, `down`, and `left`. The direction describes
camera travel: `down` moves every outgoing child up while the incoming scene
rises from below. `sceneZoom` zooms the whole outgoing scene through camera and
resolves the incoming scene from depth. Pair the same transition and duration
on both sides; a middle scene may declare both properties.

Simple imported path SVGs can use editable fill/stroke overrides:

```motion
logo {
  center
  width 320
  fill #38bdf8
  stroke #ffffff
  strokeWidth 2
}
```

`fill`, `stroke`, and `strokeWidth` can appear in explicit keyframes. For a local push-in or pan, animate the SVG's own transform and origin rather than the global camera.

Adjustment values are serializable and animatable. `brightness`, `contrast`, and `saturation` are multipliers (default `1`); `hue` is degrees (default `0`); `grayscale`, `sepia`, and `invert` range from `0` to `1`; and `blur` is measured in pixels. These use deterministic Canvas 2D filters in preview and export. Chroma key is not currently supported.

## Layer Masks

Any visual layer can reuse another layer's evaluated alpha:

```motion
text matte {
  value "MASK"
  center
  size 220
}

photo {
  center
  width 900
  mask matte
  maskInvert false
  maskVisible false
}
```

`mask` stores the source layer ID, `maskInvert` uses inverse alpha, and `maskVisible` keeps the matte visible as normal artwork. Mask layers are hidden by default. Missing, self-referencing, and nested masks are rejected so preview and export remain deterministic.

Layer order: `background`, `hero`, `supporting`, `content`, `details`, `text`, `effects`.

## Audio

```motion
audio "/assets/my-project/background.mp3" {
  start 0s
}
```

Audio persists in `.motion`, plays during preview, and is included in MP4 export. It remains on the bottom audio track. Dragging it horizontally updates `start`; it does not move onto visual layers.

## Timeline Clips

Tracks are stable, persisted timeline rows. Visual tracks behave as simple layers: clips move freely in time, can overlap, and can be placed on any visual track without content compatibility rules. `role` and `content` remain serialized metadata for existing projects; they do not enable magnetic packing, ripple editing, or automatic allocation. Audio remains a bottom-only track.

```motion
track main {
  label "Main Track"
  role main
  content primary
  order 0
}

track titles {
  label "Text Overlay"
  role overlay
  content text
  hidden false
  order 1
}

track music {
  label "Music"
  role audio
  content audio
  muted false
  order 2
}
```

`hidden` suppresses a visual track without deleting it. `muted` disables track audio while retaining clip-level volume/mute. `order` persists layer order. Existing projects with numeric or synthesized tracks remain compatible and receive explicit stable assignments when edited.

```motion
import "/assets/my-project/video.mp4" as bgVideo

clip bgVideo {
  track 1
  start 0s
  duration 5s
  trimIn 0s
  trimOut 0s
  volume 1
  mute false
}
```

Timeline clips reference imported images, static/animated SVG, GIF, MP4, WebM, MOV/M4V, and Lottie assets. They appear on the timeline and can be created visually by dragging from the Assets panel. Animated frames are synchronized from `trimIn + (projectTime - start)` when the format exposes seeking.

Video limitations:

- Codec support follows the current browser (typically H.264/AAC MP4 and VP8/VP9 WebM; MOV support depends on its codec).
- Video clip audio is currently muted; use the project `audio` track for preview and exported sound.
- Two simultaneous clips referencing the same imported video cannot display different source times yet; import the file under two aliases as a workaround.
- Embedded video uploads increase `.motion` file size and are limited to 100 MB in the editor.

Properties:

- `track`: timeline track number (default 1)
- `start`: when clip starts on timeline
- `duration`: how long clip plays
- `trimIn`: source media start offset (default 0s)
- `trimOut`: source media end offset (default 0s)
- `volume`: audio volume 0-1 (optional, default 1)
- `mute`: whether to mute clip audio (optional, default false)

Clips are rendered at their natural size unless transformed. Keep original asset files in the same location for projects to reload correctly.

### Clip Transitions

Drag **Crossfade** from Effects → Clip Transitions onto the cut between two touching clips on the same track. The transition is saved on both sides of the cut:

```motion
clip outgoing {
  track 1
  start 0s
  duration 3s
  transitionOut crossfade
  transitionOutDuration 500ms
}

clip incoming {
  track 1
  start 3s
  duration 3s
  transitionIn crossfade
  transitionInDuration 500ms
}
```

The outgoing clip fades out while the incoming clip fades in. Select the transition marker on the timeline to change its duration or remove it. Paired transition properties should use the same type and duration; normal visual editing writes both sides automatically.

## Text

```motion
text title {
  value "Make it move."
  center
  layer text
  x 0
  y -40
  size 72
  weight 740
  color #ffffff
  opacity 1
  textAnimation keynoteText(split words stagger 80ms duration 750ms delay 1s ease power3.out exitAt 4s exitDuration 450ms)
}
```

Supported text presets:

Text boxes support `width`, `height`, `textAlign left|center|right`,
`verticalAlign top|middle|bottom`, `lineHeight`, and `wrap none|word|char`.
Text presets accept `split lines|words|chars`, `rangeStart`, `rangeEnd`, and
`order forward|reverse|center`. Layout uses measured font metrics in preview
and export; `maskReveal` uses a real clip.

- `keynoteText`
- `wordReveal`
- `charReveal`
- `splitReveal`
- `blurReveal`
- `fadeUp`
- `slideIn`
- `scaleText`
- `typewriter`
- `maskReveal`
- `gradientReveal`

Common options: `split`, `stagger`, `delay`, `duration`, `ease`, `exitAt`, `exitDuration`.

## Image Layers And Vector Overlays

Use an `image` layer when vector annotations must stay attached to a static picture. `source` names an imported bitmap. An `overlay` with `parent` uses the source image's intrinsic pixel coordinate system, so `x`, `y`, `x2`, `y2`, radii, and path coordinates continue to line up when the image is resized, centered, rotated, or animated.

```motion
import "./assets/dashboard.png" as dashboardPng

image dashboard {
  source dashboardPng
  center
  layer content
  width 1400
  opacity 1
}

overlay focusRing {
  parent dashboard
  shape circle
  x 1060
  y 310
  radius 92
  fill none
  stroke #7cf7c5
  strokeWidth 10
  opacity 1
  animation highlight-circle-reveal(delay 800ms duration 900ms ease power3.out)
}

overlay pointer {
  parent dashboard
  shape arrow
  x 760
  y 470
  x2 230
  y2 -120
  fill none
  stroke #ffffff
  strokeWidth 8
  opacity 1
  animation animated-arrow-point(delay 1.3s duration 700ms ease power3.out)
}

overlay label {
  parent dashboard
  shape text
  x 650
  y 520
  value "Review this trend"
  fill #ffffff
  font "Inter, sans-serif"
  size 46
  weight 700
  opacity 1
  animation callout-text-pop(delay 1.5s duration 650ms ease power3.out)
}

overlay spotlight {
  parent dashboard
  shape spotlight
  x 1060
  y 310
  radiusX 150
  radiusY 110
  fill rgba(0,0,0,.58)
  opacity 1
  clip
  animation spotlight-mask(delay 2.4s duration 800ms ease power3.out)
}
```

Supported shapes are `circle`, `ellipse`, `rect`, `line`, `arrow`, `path`, `text`, and `spotlight`. For `path`, set `path` to SVG `d` data. `clip` confines a sublayer to the image. All overlay properties use the normal `animate` blocks and keyframes; overlays also follow their parent's evaluated visibility and transform.

An overlay does not require `parent`. Omit it and the shape is positioned relative to canvas center using its own `x`/`y`/`rotation`/`scale`, exactly like any other element — this is the basis for the UI Components below (cards, buttons, progress bars) that aren't annotating an image. `rect` respects `originX`/`originY` for its anchor point (default `0.5, 0.5`, centered); set `originX 0` for a left-anchored bar or panel.

Starter presets:

- `highlight-circle-reveal`: draws a circle/ellipse stroke around the target.
- `animated-arrow-point`: draws an arrow toward the target.
- `callout-text-pop`: reveals a vector callout with a restrained scale and rise.
- `spotlight-mask`: opens an elliptical cutout in a dimming mask.

Motionly uses native SVG-compatible path data with Canvas2D rendering, not ThorVG. This avoids adding a WASM runtime and guarantees the same JS-evaluated frame in preview and export. The tradeoff is that advanced SVG filters and full SMIL semantics are not supported; convert those effects to ordinary Motionly properties or a pre-rendered asset.

## Scene Backgrounds

```motion
overlay nextScene {
  layer background
  fill #09111d
  opacity 0
  animation shapeWipe(delay 4s duration 800ms direction right ease power3.out)
}

overlay atmosphere {
  layer background
  opacity 0
  backgroundEffect aurora(duration 8s opacity .18 intensity .55)
}
```

Background effects currently include `gradientMotion`, `noise`, `grid`, `aurora`, `prism`, `rippleGrid`, `ripple-grid`, and `particles`. Keep opacity restrained behind copy.

## Semantic Components

`component` blocks compile recognizable product subjects into structured,
editable multi-part vector artwork with staggered entrance choreography —
never a lone icon or an empty rectangle. Types: `cloud`, `database`,
`server`, `arrow`, `button`, `dashboard`, `phone`, `browser`, `logo`,
`chart`, `notification`, `cursor`, `codeeditor`, `website`, `terminal`,
`pricingcard`, `laptop`, `editor` (the Motionly workspace itself).
Component text renders in Space Grotesk, the bundled display face, so
composed scenes share one typographic system. Prefer composing scenes from
these components over hand-drawing UI.

Every generated part is an ordinary element named `NAME__PART`, and any
part's base property can be customized inline with a dotted override —
`price.countPrefix "€"`, `headline.color #ffffff` — or animated directly
with `animate NAME__PART { ... }`. An unknown part name errors with the
list of available parts, so overrides are discoverable from source alone.

```motion
component metrics {
  type dashboard
  role main
  label "Overview"
  values "$84.9k  12,480  99.98%"
  labels "Revenue  Users  Uptime"
  width 560
  accent #7cf7c5
}

component deploy {
  type button
  label "Deploy"
  x -420
  y 200
  color #D97757
}

component pointer {
  type cursor
  clicks deploy
  clickAt 2.6s
}

component toast {
  type notification
  reactsTo deploy
  label "Deployed"
  detail "Production is live."
  x -420
  y -20
}
```

- A dashboard compiles to a frame, header, live dot, metric cards with values
  and captions, and a drawing chart line; a browser gets chrome, traffic
  dots, an address pill, headline, and CTA; a chart gets axis, growing bars,
  and a counting total (`countTo`); a codeeditor gets a titlebar, filename,
  typed code lines, and a status line; a website gets nav, headline, CTA, and
  a gradient banner; a phone gets frame, screen, notch, and message rows.
- Structure children are ordinary elements named `NAME__part` — editable and
  animatable individually.
- `connects TARGET` draws a connector with a traveling data particle;
  connectors inherit endpoint visibility (including reveal progress) and hide
  when an endpoint's scene window is closed.
- Cause and effect: `clicks TARGET` + `clickAt` moves a cursor onto the
  control and clicks it (the control compresses and glows); `reactsTo TARGET`
  enters a component just after that target's click. `exitAt`/`exitDuration`
  choreograph a deliberate exit.
- Content props: `label`, `detail`, `headline`, `url`, `cta`, `values`,
  `labels`, `countTo`, `surface` (panel fill). Separate multi-item
  `values`/`labels` with two spaces or commas.

Scenes support `enter`/`exit` fade envelopes (`enter .35s`, `exit .5s`) so a
whole composition enters and leaves cleanly instead of popping at the scene
boundary. Text elements render animated count-ups with a numeric `value` plus
`countDecimals`, `countSeparator`, `countPrefix`, and `countSuffix`.

## UI Components

Cards, buttons, progress bars, badges, and panels are standalone `overlay` shapes (no `parent`) composed with the normal shape/fill/text system above, animated with the presets below. There are no dedicated `button`/`card`/`modal` element kinds — everything is built from `rect`/`text`/`circle` overlays, kept purposeful rather than growing a large widget library.

```motion
overlay pricingCard {
  shape rect
  x 0
  y 0
  width 420
  height 260
  radius 24
  fill #101826
  shadow 24
  opacity 0
  animation cardReveal(delay 400ms duration 700ms ease power3.out)
}

overlay ctaButton {
  shape rect
  x 0
  y 160
  width 200
  height 56
  radius 28
  fill #7cf7c5
  opacity 0
  animation buttonPop(delay 1s)
}

overlay progressTrack {
  shape rect
  x -150
  y 260
  originX 0
  width 300
  height 8
  fill #1c2c40
  opacity 1
}

overlay progressBar {
  shape rect
  x -150
  y 260
  originX 0
  width 300
  height 8
  fill #7cf7c5
  opacity 1
  animation progressFill(delay 1.4s duration 900ms ease power3.out)
}
```

- `cardReveal`: rise + scale-in with a rising `shadow` (elevation lifts in as the card settles) — distinct from `softReveal` in that shadow is part of the choreography, not just a static value.
- `buttonPop`: fast elastic scale-in (default `450ms`, vs. the general `1.2s` default) tuned for small interactive elements.
- `progressFill`: animates `width` from `0` to the overlay's authored width. Pair a static "track" rect (no animation, dim fill) behind an `originX 0` "fill" rect so it grows left-to-right like a real progress bar.

For other UI patterns, compose from the existing preset set rather than reaching for a new name:

- **Notification/toast**: `dynamicSlide` from an edge (`direction left|right|up|down`), short `duration`, with `exitAt`/`exitDuration` for the auto-dismiss.
- **Modal**: `scaleReveal` (or `cardReveal`) for the panel, plus a full-canvas `overlay` with `softReveal` for the dimming backdrop, sequenced together with matching `delay`.
- **Menu/sidebar/table rows**: a `sequence` block with `hierarchy` (see below) driving `dynamicSlide` or `fadeUp` per row/item instead of hand-computed delays.
- **Charts**: build bars/segments as `rect`/`circle`/`path` overlays and reveal with `cardReveal`/`progressFill`/`drawSVG` per element, staggered with `sequence`.

## Object Presets

Preferred production set:

- `softReveal`: subtle opacity, position, scale, and optional blur.
- `maskReveal`: directional clipped reveal; suitable for media.
- `dynamicSlide`: directional slide with settle and optional exit.
- `shapeWipe`: directional full-scene transition.
- `irisWipe`: circular full-scene transition.
- `drawSVG`: path progress for simple stroked SVGs only.
- `focusZoom`: whole-product to feature-detail transition. The focal layer uses `role focus`; surrounding layers can call the same move with `role sibling pushX ... pushY ...`.
- `zoomThrough`: drive through a focal layer into the next shot.
- `whipPan`: fast directional travel with a brief blur and clean settle.
- `sceneSlide`: paired whole-scene push in four directions; all descendants move with the scene root.
- `sceneZoom`: paired whole-scene zoom-through; tune outgoing `to`, incoming `from`, and optional `xTo`/`yTo` focus.
- `rackFocus`: bring a soft secondary layer into sharp focus.
- `depthSwap`: move a layer between background and foreground roles.
- `cascadeIn`: stagger-friendly cards or media with one restrained settle.
- `snapMove`: visible UI drag/reposition with one overshoot.
- `popover`: compact panel opening from its transform origin.
- `cursorTap`: click/tap feedback for a cursor or control.
- `shakeReject`: damped blocked-action feedback.
- `orbitDrift`: deterministic elliptical idle orbit.
- `heroLogo`, `productPanel`, `rotateReveal`: use selectively.

```motion
image editorOverview {
  source editor
  center
  animation "focusZoom(delay 3s duration .9s role focus focusScale 1.7 xTo 0 yTo 80 ease power3.inOut)"
}

component pointer {
  type cursor
  animation "cursorTap(delay 2.4s)"
}
```

Icon and pop-in motion:

- `springIn`: rise with overlapping easing — power-out approach, then an elastic settle for a natural, non-robotic spring.
- `bounceIn`: drops from above with a literal bounce easing (`distance` controls drop height).
- `scaleReveal`: elastic scale-in from near-zero — a genuine "pop," distinct from `softReveal`'s subtle scale nudge.
- `spinIn`: full-rotation entrance (`rotationFrom`, default `-260°`) with a slight overshoot past rest before settling — for logos/icons that should visibly spin into place, not just fade up.

Image/media motion:

- `kenBurns`: continuous pan + zoom for the element's own duration (`panX`, `panY`, `to` for end zoom) — independent of the global `camera`, for a slow drift on one photo/screenshot while everything else holds still.
- `tiltReveal`: perspective-style entrance using skew + rotation (`skewXFrom`, `skewYFrom`, `rotationFrom`). Canvas2D has no true 3D transform; this approximates depth rather than rendering real perspective — state that limitation if a brief specifically needs true 3D.

For parallax (a background layer lagging behind camera/foreground movement), use `followThrough` (below) with a `followThroughDamping` under `1` rather than a dedicated preset.

Other supported object presets include `sceneExit`, `float`, `pulse`, `morph`, `productReveal`, `appleHero`, and `startupLaunch`. `morph`, `productReveal`, `appleHero`, and `startupLaunch` currently resolve to the same restrained generic fade/scale/rise fallback — true shape morphing between two different paths is not implemented (see SVG Animation below); use a matched-shape crossfade instead. Prefer the restrained, distinctly-implemented set above unless the brief calls for a different motion character.

Example supporting asset:

```motion
icon {
  center
  layer supporting
  width 160
  x 320
  y 80
  opacity 0
  animation dynamicSlide(delay 2s duration 700ms direction up distance 90 exitAt 5s exitDuration 450ms ease power3.out)
}
```

Directions are `left`, `right`, `up`, and `down`.

## Motion Quality: Overshoot, Anticipation, Follow-Through, Stagger

Opt-in options for a livelier, less "PowerPoint" feel. All are additive — omitting them keeps a preset's existing curve exactly as before.

`overshoot` and `anticipation` work on any object preset whose entrance is a plain two-state animation (`softReveal`, `heroLogo`, `productPanel`, `rotateReveal`, `drawSVG`, `shapeWipe`, `irisWipe`, `maskReveal`, the callout/spotlight presets, and the default fallback). Presets that already choreograph their own keyframes (`dynamicSlide`, `float`, `pulse`) ignore these two options since they already have an intentional curve.

```motion
badge {
  center
  scale 1
  animation heroLogo(delay 200ms duration 700ms anticipation 120ms overshoot 1.08 ease power3.out)
}
```

- `anticipation <time>`: a small counter-motion before the main move (e.g. a slight dip before a rise, or shrink before a pop), extending the preset's effective duration by that amount.
- `overshoot <multiplier>`: the settle axis (scale for pop-ins, position/rotation for slides) moves past its final value, then eases back. `scale` overshoots to `rest * multiplier`; `x`/`y`/`rotation` overshoot proportionally to how far they travelled.

`followThrough` links any element/overlay to lag and dampen behind a parent's motion, for secondary motion (e.g. a label or glow trailing an icon):

```motion
glow {
  followThrough icon
  followThroughLag 140ms
  followThroughDamping 0.3
}
```

The parent must exist, cannot be the element itself, and cannot itself declare `followThrough` (no chaining). `followThroughDamping` is 0–1 (0 = no secondary motion, 1 = full delta).

`sequence` blocks compute a whole group's stagger from one place instead of hand-computed per-element delays, and now support a `hierarchy` distribution:

```motion
sequence agentIcons {
  items codex claudeCode antigravity
  delay 8.8s
  gap 0.5s
  hierarchy wave
}

codex {
  sequence agentIcons
  animation dynamicSlide(duration 0.7s direction up distance 90 ease power3.out)
}
```

Set the same `sequence <name>` property on each member (works for both preset `animation`/`textAnimation` calls and explicit `animate` blocks). `hierarchy` is `linear` (default, flat per-index delay), `wave` (eased distribution), or `center-out` (middle member first, outer members lag more).

## SVG Animation: Trim Paths And Motion Paths

`trimStart` generalizes the `drawSVG` stroke reveal from a fixed "draw from the start" into a partial-arc trim, using the same `pathProgress` (driven by the `drawSVG` preset) as the trim's end point:

```motion
import "./assets/line.svg" as squiggle

squiggle {
  center
  width 400
  trimStart .2
  animation drawSVG(duration 1.2s ease power3.out)
}
```

With `trimStart` at `0` (the default), this is the existing draw-in behavior. Set `trimStart` above `0` — or animate it — for a moving trimmed segment (a "comet trail" that travels along the path rather than growing from a fixed start); in that case the full-artwork fade-in at the end of the reveal is suppressed, since a moving segment should never solidify into filled artwork.

`motionPath` moves an element along an imported path asset's own geometry, driven by an animated `motionPathProgress` (`0` to `1`):

```motion
import "./assets/guide-curve.svg" as guideCurve
import "./assets/pointer.svg" as pointer

pointer {
  width 40
  motionPath guideCurve
  motionPathProgress 0
  motionPathRotate
}

animate pointer {
  to {
    motionPathProgress 1
  }
  delay 500ms
  duration 1.4s
  easing power3.out
}
```

`motionPath` names either an imported asset or a `path` element marked `guide`. Imported assets sample their first SVG path. Guide paths support M/L/Q/C data and do not appear in export. `motionPathRotate` (bare boolean) orients the element to the path's tangent direction as it travels. The guide path's own SVG coordinate space is used directly as an x/y offset on top of the element's own `x`/`y` — author guide paths in units matching the canvas layout, centered around `0,0` if the motion should be centered on the element's normal position.

Not currently supported: deterministic path morphing (interpolating between two different `d` shapes) and gradient-stop animation. Use matched-shape crossfades for morphing and a static gradient for now; state these as real limitations rather than working around them silently.

## Camera Presets

- `slowPush` or `push`: restrained zoom over a shot.
- `pan`: horizontal camera movement.
- `pull`: settle from a closer view.
- `speedZoom`: short punch with `from`, `peak`, and `to` zoom values.
- `sceneSlide`/`sceneZoom` belong on scene or archetype `transitionIn` and `transitionOut`, not inside the global camera block.

Camera movement affects every visible layer. Use it only when the composition has enough safe space.

## Explicit Animation

```motion
animate title {
  from {
    opacity 0
    y 80
    blur 10
  }

  to {
    opacity 1
    y 0
    blur 0
  }

  duration 1s
  delay 0s
  easing power3.out
}
```

Keyframes use percentage offsets:

```motion
animate fade {
  keyframes {
    0% { opacity 1 }
    2% { opacity 0 }
    98% { opacity 0 }
    100% { opacity 1 }
  }
  duration 8s
  easing power3.out
}
```

## Timing Pattern

For a shot from `8s` to `14s`:

- Start scene transition around `7.8s`.
- Reveal hero around `8.1s` for `800ms`.
- Reveal supporting copy around `8.7s`.
- Hold the complete composition long enough to read.
- Start exits around `13.5s` for `400ms` to `550ms`.
- Begin the next transition only after the focal content clears or intentionally covers it.

For narration, supplied timestamps override this pattern.
