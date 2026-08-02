# Motionly Authoring Contract

This is the agent-facing contract for the current Motionly source format. It is
derived from `AGENTS.md`, the parser, semantic compiler, motion-system lowering,
and generated registry. When this document disagrees with source, run the
catalog and inspect the named source file; do not invent syntax.

## Required Pipeline

Use this order for any non-trivial animation:

1. **Story**: define the promise, proof, product behavior, and close.
2. **Storyboard**: choose scene or beat boundaries and local durations.
3. **Asset inventory**: inspect dimensions, aspect ratios, file types, and video duration.
4. **Layout**: choose a layout block before coordinates.
5. **Component resolver**: choose a semantic component or showcase before primitives.
6. **Continuity**: pair recurring subjects with `identity`; classify each boundary.
7. **Transitions**: choose `sharedElement`, `objectMorph`, `layoutMorph`, `cameraMove`, `continuous`, or `cut`.
8. **Animation**: add one focal entrance, supporting wave, UI life, camera path, and deliberate exits.
9. **Source**: emit valid `.motion` only after the decisions above are fixed.
10. **Verification**: parse, serialize, inspect, preview, scrub boundaries, and test real media.

Never start by generating a pile of rectangles, random text nodes, or repeated
`zoom in` animations. A frame must be composed and screenshot-worthy before it
is animated. Text is a subject when it carries the message; supporting labels
are optional and should not be sprinkled around every object.

## Discovery Commands

Run these from the Motionly repository when the docs do not answer a question:

```bash
npm run inspect:motion -- project.motion --strict
npm run type-check
npx vitest run tests/language tests/motion-system tests/semantic
npx @coppsary/motionly catalog --type component
npx @coppsary/motionly catalog --type move
npx @coppsary/motionly catalog --type layout
npx @coppsary/motionly catalog --type showcase
npx @coppsary/motionly catalog --show NAME
npm run registry:generate
```

The catalog is the public discovery surface. `src/semantic/catalog.ts` is the
catalog implementation; `src/semantic/vector-registry.ts` defines component
types, metadata, layers, and providers; `src/semantic/component-structures.ts`
defines the generated parts; `src/motion-system/layout.ts` and
`src/motion-system/showcase.ts` define composition blocks; and
`src/animation-library/presets.ts` defines preset lowering.

## Minimal Project

```motion
canvas {
  size 1920x1080
  fps 60
  duration 8s
  background #07090f
}

import "./assets/product.png" as product

scene intro {
  label "Promise"
  duration 3s
  background #07090f
}

text title {
  scene intro
  identity promise
  value "Make the work visible."
  center
  y -120
  size 112
  color #ffffff
}

showcase productShot {
  scene intro
  type screenshotPresentation
  media product
  width 1200
  behavior still
}

textAnimation title {
  value "keynoteText(split words stagger 80ms duration 850ms)"
}
```

The last block above is illustrative only: in normal source put
`textAnimation "..."` as a property on the text element. The valid form is:

```motion
text title {
  value "Make the work visible."
  textAnimation "keynoteText(split words stagger 80ms duration 850ms delay 200ms)"
}
```

Use `size`, not `fontSize`. Use `easing` on an explicit `animate` block and
`ease` inside a preset call. Time values accept `s`, `ms`, and frame values where
the parser supports them. Keep aliases single words.

## Blocks And Properties

Valid element blocks are `scene`, `text`, `overlay`, `effect`, `component`,
`group`, `path`, `svgpart`, `layout`, `showcase`, `beat`, `image`, `transition`,
and imported asset aliases. Valid top-level blocks include `canvas`, `camera`,
`import`, `track`, `clip`, `audio`, `sequence`, `theme`, and explicit
`animate`/`keyframes` blocks.

Common visual properties:

| Property | Meaning |
| --- | --- |
| `x`, `y` | centered-coordinate offset; do not randomize when a layout fits |
| `width`, `height` | authored bounds; set only one for media when preserving ratio |
| `scale` | local transform scale |
| `rotation`, `rotationX`, `rotationY`, `rotationZ` | 2D or restrained perspective rotation |
| `opacity` | visibility; arrivals should snap to 1 rather than fade |
| `blur`, `brightness`, `contrast`, `saturation` | visual treatment; use sparingly |
| `originX`, `originY` | normalized transform origin from 0 to 1 |
| `center` | center the element in its parent/canvas |
| `parent` | attach a component to a layout or group |
| `layer`, `track` | explicit visual/timeline ordering |
| `source` | imported alias used by image/SVG/component content |
| `fill`, `stroke`, `strokeWidth` | vector and overlay appearance |
| `color`, `size`, `weight`, `tracking`, `lineHeight`, `textAlign`, `wrap` | text styling |
| `scene`, `identity`, `beat` | storyboard membership and continuity |

Do not author unsupported blocks such as `rect`, `video`, or arbitrary device
geometry. Use `overlay`, an imported asset, `component`, or `showcase`.

## Scenes: Organization And Lifecycle

Scenes are ordered storyboard ownership, not automatic slide clearing. Objects
persist at a boundary unless their scene has `clear` or the object has an
explicit exit. Every object in a storyboarded project must name its scene.

```motion
scene promise { label "Promise" duration 3s background #080b12 }
scene proof {
  label "Proof"
  duration 6s
  background #101820
  transition sharedElement
  transitionDuration 700ms
}

text markA { scene promise identity brand value "Motionly" center size 80 }
text markB { scene proof identity brand value "Motionly" size 32 x -760 y -430 }
```

Scene properties are `label`, `duration`, `start`, `background`, `zoom`,
`cameraX`, `cameraY`, `transition`, `transitionDuration`, `easing`, and `clear`.
Scenes run back-to-back when `start` is omitted. Scene-local `delay` is relative
to that scene's start. Boundary values are `sharedElement`, `cameraMove`,
`continuous`, and `cut`; there is no scene fade boundary.

Boundary planning:

- Shared: same identity or same name on both sides; move/resize/reframe it.
- Enter: new content; binary reveal with purposeful travel.
- Exit: content genuinely leaves; add a short transform/exit animation.
- Camera move: persistent composition, new focus.
- Cut: explicit hard change when no continuity is intended.

Use an explicit `transition NAME { from "a" to "b" ... }` only for a named
shared/object/layout handoff generated by the motion system. Paired transition
kinds require both endpoints. `transitionIn`/`transitionOut` are clip-only
crossfade properties and must not be used as scene transition syntax.

## Beats: Continuous Focus Changes

Use beats when a single persistent composition changes focus without clearing the
frame. Beats do not emit scene roots.

```motion
beat establish { duration 3s focus title route stagedReveals label "Promise" }
beat detail {
  duration 5s
  focus dashboard
  zoom 1.25
  cameraX 180
  route cameraIntent
  transition cameraMove
}
```

Beat properties: `start`, `duration`, `focus`, `zoom`, `cameraX`, `cameraY`,
`transition`, `from`, `to`, `transitionDuration`, `easing`, `route`, and `label`.
Routes are `stagedReveals`, `cameraIntent`, `uiLife`, `sequence`, `cursorLed`,
and `hold`. `stagedReveals` needs at least two attachments. `cameraIntent` needs
a real camera change. Use `hold` only for intentional reading stillness.

## Layouts

```motion
layout features {
  type bentoGrid
  columns 3
  gap 40
  width 1500
  height 760
  order center-out
  stagger 70ms
}

component metric { parent features type metric-card label "Conversion" countTo 74 }
component table { parent features type table label "Recent activity" }
```

Current layout types: `verticalStack`, `horizontalStack`, `grid`, `centerLayout`,
`heroLayout`, `splitLayout`, `dashboardLayout`, `cardGrid`, `bentoGrid`,
`featureGrid`, `masonryGrid`, `deviceStack`, `logoWall`, `comparisonLayout`,
`timelineLayout`, `carousel`, `gallery`, `floatingCollage`.

Layout properties: `type`, `columns`, `gap`, `width`, `height`, `itemWidth`,
`itemHeight`, `order` (`linear`, `center-out`, `reverse`), `stagger`, `delay`,
`beat`, and `parent`. Children use `parent LAYOUT_NAME`. The solver snaps to an
8px rhythm, preserves aspect ratio, computes slots, and emits focal/support
arrival weights. A child coordinate override is allowed only for a deliberate
art-directed exception.

## Showcases And Real Media

```motion
import "./assets/product-ui.png" as productUI

showcase walkthrough {
  type uiWalkthrough
  media productUI
  headline "Every decision, in view."
  caption "A single source of truth for the team."
  width 1180
  behavior tour highlight
  focusX .72
  focusY .42
}
```

Types: `productHero`, `phoneShowcase`, `browserShowcase`, `laptopShowcase`,
`appWindow`, `dashboardShowcase`, `screenshotPresentation`, and `uiWalkthrough`.

Behaviors: `still` suppresses idle movement; `push` adds a focused product push;
`perspective` adds a restrained 2.5D presentation; `tour` moves through authored
focus points; `highlight` adds a focus ring; `float` is a small optional idle
drift. Combine only behaviors that serve the shot. `media` is the imported alias,
not a file path. The screen clips/crops media and preserves its proportions.

Generated parts use `NAME__PART` names. Common parts include `body`, `screen`,
`media`, `chrome`, `headline`, `caption`, `panel`, `title`, `rows`, `chart`,
`highlight`, `cta`, and device-specific chrome. Inspect the generated part names
in the parsed scene or registry example before animating a part directly.

## Components

Use `component NAME { type TYPE ... }` for recognizable UI. A component is a
reusable structure, not a disposable rectangle group. It lowers to editable
ordinary elements and generated part ids.

Base types:

`cloud`, `database`, `server`, `arrow`, `button`, `dashboard`, `phone`, `browser`,
`logo`, `chart`, `notification`, `cursor`, `codeeditor`, `website`, `terminal`,
`pricingcard`, `laptop`, `editor`, `card`, `form`, `chat`, `modal`, `navigation`,
`loader`.

Published specialized types:

`mac-window`, `sidebar`, `navbar`, `feature-card`, `analytics-chart`, `table`,
`notification-toast`, `command-palette`, `search-bar`, `phone-mockup`,
`laptop-mockup`, `avatar`, `badge`, `tag`, `progress-bar`, `timeline`, `stepper`,
`cta-button`, `glass-card`, `floating-card`, `hero-section`, `footer`,
`logo-grid`, `testimonials`, `faq-accordion`, `tilted-card`, `magic-bento`,
`fluid-glass`, `spotlight-card`, `metric-card`, and `media-card`.

Additional compatibility aliases exist in `REACTBITS_COMPONENT_ALIASES`, including
`animated-list`, `bounce-cards`, `card-swap`, `carousel`, `chroma-grid`,
`circular-gallery`, `counter`, `decay-card`, `dock`, `elastic-slider`,
`flowing-menu`, `flying-posters`, `folder`, `glass-icons`, `glass-surface`,
`gooey-nav`, `infinite-menu`, `infinite-scroll`, `lanyard`, `masonry`,
`model-viewer`, `pixel-card`, `rolling-gallery`, `scroll-stack`, `stack`, and
numbered button/form/loader variants. Use the catalog for the exact current list.

Common component properties are `type`, `provider`, `source`, `label`, `detail`,
`headline`, `url`, `cta`, `values`, `labels`, `countTo`, `variant`,
`motionPreset`, `accent`, `surface`, `fill`, `stroke`, `strokeWidth`, `glow`,
`glowColor`, `delay`, `duration`, `scene`, `identity`, `beat`, `parent`, `layer`,
`start`, `opacity`, `scale`, `rotation`, `clickAt`, `clicks`, `reactsTo`,
`connects`, `exitAt`, and `exitDuration`.

All components support motion presets `minimal`, `smooth`, `spring`, and
`premium`. Variants are type-specific; query the catalog/metadata instead of
guessing. Content uses `label`, `detail`, `headline`, `cta`, `values`, `labels`,
and `countTo`; do not invent geometry to express content a component already
supports.

Component parts are editable. Use dotted overrides only after reading the part
names:

```motion
component plan { type pricingcard label "Pro" countTo 49 cta "Start now" }
override plan.price.countPrefix "$"
animate plan__cta { from { scale .96 } to { scale 1 } duration 420ms easing power3.out }
```

If the parser/compiler in the current checkout does not accept the `override`
block form, use the supported dotted property syntax on the component and
animate the lowered `NAME__PART` element. Do not fabricate a part id; unknown
parts should be rejected and the available generated names should be inspected.

Relationships:

```motion
component source { type button label "Run" clicks result clickAt 2.2s }
component result { type notification-toast label "Complete" reactsTo source }
component flow { type arrow connects result }
```

Use `clicks TARGET`, `clickAt TIME`, `reactsTo TARGET`, and `connects TARGET` only
when the cause/effect is visible. These are semantic timing hints, not a reason
to add decorative arrows or cursors.

## Text

Text is often the hero subject. Use one display headline, readable line breaks,
and a hold. Supporting copy should clarify the product, not fill empty space.

```motion
text hero {
  scene intro
  value "From brief to launch film."
  center
  y -80
  size 112
  weight 760
  color #ffffff
  textAnimation "keynoteText(split words stagger 80ms duration 850ms delay 300ms)"
}
```

Text preset names and selection guidance live in
`references/motion-catalog.md`. Use one intentional text treatment per role;
do not apply a different effect to every word or every label. Text exits must
finish before unrelated new copy becomes the focal subject.

## Explicit Animations And Exits

```motion
animate panel {
  from { x 0 y 80 scale .96 opacity 1 }
  to { x 0 y 0 scale 1 opacity 1 }
  duration 620ms
  delay 1.2s
  easing power4.out
}

animate panel {
  from { x 0 y 0 scale 1 opacity 1 }
  to { x -180 y 0 scale .98 opacity 1 }
  duration 420ms
  delay 5.2s
  easing power3.in
}
```

For arrivals, set the element's authored `opacity 0` and animate to `opacity 1`
only when the chosen preset requires hidden state; the motion doctrine expects a
binary reveal rather than a slow opacity dissolve. For a genuine exit, animate
away or set `clear` at the scene boundary. Never leave a stale object visible
under the next shot.

## Clips And Audio

```motion
track product { label "Product" role main content video order 0 }
clip demo {
  track product
  start 2s
  duration 4s
  trimIn 1s
  transitionIn crossfade
  transitionInDuration 350ms
}
```

Clip `transitionIn`/`transitionOut` currently support `crossfade` only. This is
media-track behavior and is distinct from storyboard scene transitions. User
requested no audio means omit the `audio` block and mute video clips when their
embedded audio must not play.

## Validation And Preview

At minimum:

```bash
npm run inspect:motion -- project.motion --strict
npm run type-check
git diff --check
```

Inspect the first frame, midpoint and hold of every scene, one frame before and
after every boundary, every media clip start/end, and the final frame. Confirm:

- all imports load and animated media actually advances;
- text and UI fit inside the canvas at rest and during transforms;
- no stale layers remain after an exit;
- no scene gaps, overlaps, orphan objects, still beats, or discontinuities;
- transitions cover the boundary without flash, blank frame, or double exposure;
- save/parse/serialize/parse preserves tracks, clips, keyframes, identities, and audio state.

Do not call a project finished because it parses. A clean inspector is necessary;
representative visual frames are the acceptance test.

## Unsupported Or Dangerous Assumptions

- No automatic scene fade; use continuity, camera motion, a hard cut, or an explicit named transition.
- No true 3D camera rig; use local transforms and restrained `rotationX`/`rotationY`.
- No arbitrary CSS/HTML component embedding in `.motion`.
- No guaranteed path morph between incompatible SVG command topologies.
- No guaranteed exact seeking for animated SVG or fallback GIF playback.
- No device built from hand-placed rectangles when a showcase exists.
- No random coordinate layout, duplicated component recipes, or generic zoom/pan applied to every asset.
