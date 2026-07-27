---
name: motion-system
description: Select complete Motionly motion design ideas instead of placing primitives — beats for pacing and focus, layouts for composition, showcases for product presentation, and transformation-based beat transitions. Use before hand-placing coordinates, building a device out of rectangles, or writing a video as disconnected scenes.
---

# Motion System

Motionly's motion system sits above the engine. You select named blocks; the
engine supplies geometry, spacing rhythm, hierarchy, and choreography. Every
block lowers into ordinary editable elements (`group`, `overlay`, `image`,
`text`, `transition`, animations), so the project stays plain `.motion` source.

Order of thought: beats pace the film, layouts solve placement, showcases present
real assets, semantic components build recognizable UI, archetypes cover
self-contained slide-style shots.

## Doctrine — what the engine enforces

- **Arrivals reveal binary.** Opacity snaps to full in the first frame; the motion
  carries the entrance. Never fade an arrival.
- **One entrance is at most 0.8s.** A longer buildup is a staggered group.
- **A group entrance is a wave, not a queue.** Gaps shrink ×0.84, travel and
  duration scale by weight (focal 64px/0.62s, support 40px/0.46s), and the whole
  cascade lands inside 0.5s however many items it holds.
- **`power4.out` for arrivals, `power3.out` to settle.** Never `.inOut` on an
  entrance; bouncy overshoot only for deliberately playful work.
- **Idle drift is not sustained motion.** Every beat declares a route; nothing may
  sit still longer than 1.4s.
- **Stillness before climax:** 0.3–0.75s between an action and its result.
- **Transform between shots, never fade.**

Layouts, showcases, and text presets apply these automatically. Verify hand-authored
work with `npm run inspect:motion -- project.motion --strict`.

## Beats

A beat is a change in focus, not a slide. Beats emit no scene root, so nothing is
cleared between them — objects persist and transform across the whole film. That
is what removes the PowerPoint feel.

```motion
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
```

Properties: `start`, `duration`, `focus`, `zoom`, `cameraX`, `cameraY`,
`transition`, `from`, `to`, `transitionDuration`, `easing`, `route`, `label`.

- Omit `start` to run beats back to back.
- Omit `duration` to split the remaining canvas time evenly.
- Attach content with `beat NAME`; its entrance delay resolves from the beat
  start, so timing is a storyboard decision instead of hand-tuned delays.
- `focus` plus `zoom` reframes the persistent composition with a camera move.

### Routes — what keeps a beat performing

Every beat is owned by exactly one route. Idle drift (float, breathe, glow pulse)
is **not** sustained motion; it reads as the video waiting.

| Route | What it is |
| --- | --- |
| `stagedReveals` | Content held back and paid off in stages |
| `cameraIntent` | A mapped camera path: establish, travel, arrive |
| `uiLife` | The product behaves over time: progress advances, counts tick |
| `sequence` | Elements act out a beat: a card files into a stack |
| `cursorLed` | A cursor walks the eye to a control; its click ignites the next beat |
| `hold` | Deliberate stillness — the only route that may hold a frame still |

The route is inferred when omitted, and an authored route is validated against the
beat's content: claiming `cameraIntent` without moving the camera fails to
compile. The test to apply: pause anywhere in the beat and something meaningful
must be mid-flight.

## Layouts

```motion
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
```

Types: `heroLayout`, `splitLayout`, `bentoGrid`, `featureGrid`, `masonryGrid`,
`deviceStack`, `logoWall`, `comparisonLayout`, `timelineLayout`, `carousel`,
`gallery`, `floatingCollage`.

Properties: `type`, `columns`, `gap`, `width`, `height`, `itemWidth`,
`itemHeight`, `order` (`linear`, `center-out`, `reverse`), `stagger`, `beat`,
`parent`, `delay`, `layer`.

- Children declare `parent NAME`. The solver assigns position, size, and a
  staggered entrance on an 8px rhythm.
- Never hand-place `x`/`y`/`width` when a layout fits. An authored value still
  wins when the composition genuinely needs it.
- Fixed-aspect children such as semantic components are fitted inside their slot,
  never stretched to fill it.
- Each layout enforces its supported child count.

## Showcases

One real asset becomes a finished product presentation: device geometry, screen,
crop, chrome, glare, shadow, entrance, idle motion, and camera push.

```motion
import "./assets/dashboard.png" as dashShot

showcase product {
  type dashboardShowcase
  media dashShot
  headline "Every metric, live"
  behavior push highlight
  beat reveal
}
```

| Type | Presents |
| --- | --- |
| `productHero` | One asset with a glow bed and headline |
| `phoneShowcase` | Mobile screen with bezel, notch, glare |
| `browserShowcase` | Web product with chrome, traffic lights, URL pill |
| `laptopShowcase` | Desktop product on a laptop with base and shadow |
| `appWindow` | Native app window with a slim titlebar |
| `dashboardShowcase` | Dashboard with sidebar rail and camera push |
| `screenshotPresentation` | Frameless media with elevation and reflection |
| `uiWalkthrough` | Window, step chip, focus ring on the acting region |

Properties: `type`, `media`, `headline`, `caption`, `label`, `width`, `behavior`,
`accent`, `surface`, `focusX`, `focusY`, `beat`, `parent`, `delay`, `duration`,
`layer`.

Behaviors: `float` (idle drift), `push` (camera push expressed on the subject, so
the global camera stays free), `highlight` (focus ring at `focusX`/`focusY`),
`still` (suppress idle motion).

- Never build a device out of rectangles; use a showcase.
- The screen clips its media, so a tall capture crops instead of distorting.
- Parts are named `NAME__body`, `NAME__screen`, `NAME__media`, `NAME__chrome`,
  `NAME__headline`, and can be animated directly.
- With no `media`, the showcase renders an honest "Add product media" empty state
  rather than fake product geometry.

## Beat transitions

Transformation, never a frame fade.

| Kind | Behavior | Needs `from`/`to` |
| --- | --- | --- |
| `sharedElement` | One element hands off to another | yes |
| `objectMorph` | One subject becomes another | yes |
| `layoutMorph` | An arrangement rearranges into another | yes |
| `cameraMove` | The camera reframes the persistent composition | no |
| `continuous` | Nothing cuts; the composition keeps evolving | no |
| `cut` | Explicit hard change | no |

A focus change with no named transition becomes a camera move; a held focus stays
continuous. Paired kinds are never inferred — both endpoints must be declared
element names or the scene graph rejects the project.

## Asset kinds drive selection

Imports classify as `logo`, `icon`, `screenshot`, `ui`, `illustration`, `photo`,
`video`, `avatar`, `chart`, or `unknown`. Filename intent wins, then declared
type, then geometry.

| Content | Present with |
| --- | --- |
| Tall app capture | `phoneShowcase` |
| Wide product UI | `dashboardShowcase`, `browserShowcase`, `laptopShowcase` |
| Several screenshots | `deviceStack`, `carousel`, `masonryGrid` |
| Feature icons | `bentoGrid`, `featureGrid` |
| Customer logos | `logoWall` |
| Data and charts | `dashboardShowcase`, `bentoGrid` |
| Photos, illustrations | `screenshotPresentation`, `gallery` |

## Where the implementation lives

Every block is compiled into the engine. Nothing is installed to use one — write
`layout features { type bentoGrid }` and it works.

`registry/**/registry-item.json` is a discovery manifest, and each layout and
showcase folder also ships an example `.motion` composition. Read one without
touching your project:

```bash
npx @coppsary/motionly catalog --show bentoGrid   # print the example
npx @coppsary/motionly add bentoGrid              # copy it into compositions/
```

The TypeScript is in `src/motion-system/` (`layout.ts`, `showcase.ts`, `beats.ts`,
`transitions.ts`, `asset-intelligence.ts`, `metadata.ts`, `budget.ts`,
`doctrine.ts`, `examples.ts`), lowered by `src/semantic/motion-lowering.ts`. UI
component builders live in `src/semantic/component-structures.ts`. Each registry
manifest names its own implementation file. Run `npm run registry:generate` after
changing a definition.
