# Motionly Agent Notes

Keep Motionly simple and visual.

For substantial `.motion` creation, retiming, transition, or storyboard work, read `.agents/skills/write-motionly/SKILL.md` first.

## Product Rule

Motionly is a motion graphics editor around `.motion`. The user edits visually; `.motion` is the saved source format underneath.

Do not make users hand-write `.motion` for normal animation creation.

## Current Scope

Work on:

- professional centered canvas preview
- correct aspect ratio
- play/pause
- timeline scrubber
- time/frame display
- zoom controls
- object selection
- visual controls for position, scale, rotation, opacity, text, duration, delay, easing
- smooth useful animation presets
- clean `.motion` serialization from UI edits
- optional BYOK AI drafting that produces editable `.motion` through the existing parser and renderer pipeline

The in-app Motionly Assistant stores its API key in the user's browser and sends requests directly to the selected provider. Generated source must be validated and loaded as a normal editable project; AI output is never a black-box final video.

Avoid for now:

- node graphs
- hosted API-key proxies or a required Motionly AI account
- autonomous project replacement without an explicit user load action
- plugin systems
- complex pipelines
- huge preset libraries
- speculative architecture

## `.motion` Syntax

Use this shape:

```motion
canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #020308
}

text title {
  value "Hello"
  center
  size 72
  color #ffffff
  opacity 1
}

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

  duration 1.2s
  delay 0s
  easing power3.out
}
```

Prefer these properties: `x`, `y`, `scale`, `rotation`, `opacity`, `blur`, `size`, `color`, `center`, `duration`, `delay`, `easing`.

Use `size`, not `fontSize`. Use `easing`, not `ease`.

## Motion Doctrine

Quality rules the engine enforces. Full text: `docs/animation/motion-doctrine.mdx`; prompt form: `src/motion-system/doctrine.ts`.

- Arrivals reveal binary — opacity snaps, motion carries the entrance. Never fade an arrival.
- One entrance is at most 800ms. A longer buildup is a staggered group, not one slow element.
- A group entrance is a wave, not a queue: gaps shrink (×0.84), travel and duration scale by weight (focal 64px/0.62s, support 40px/0.46s), and the whole cascade lands inside 0.5s.
- `power4.out` for arrivals, `power3.out` to settle. Bouncy overshoot is for deliberately playful work only.
- Idle drift (float, breathe, glow pulse) is not sustained motion. Every beat declares a route: `stagedReveals`, `cameraIntent`, `uiLife`, `sequence`, `cursorLed`, or `hold`. No stretch may sit still longer than 1.4s.
- Schedule 0.3–0.75s of stillness between an action and its result.
- Transform between shots, never fade. One dominant direction per film; changing it needs a visible cause.

`npm run inspect:motion -- project.motion --strict` audits pacing, cascades, coverage, and geometry.

## Motion System

Select complete motion design ideas instead of placing primitives. Three block kinds sit above the existing engine and lower into ordinary elements:

- `beat NAME { start 4s duration 6s focus subjectId zoom 1.3 label "Product reveal" }` — a change in focus, not a slide. Beats never clear the composition, so objects persist and transform. Attach content with `beat NAME` to inherit its pacing.
- `layout NAME { type bentoGrid columns 3 gap 40 }` — composition. Children declare `parent NAME` and the solver assigns position, size, and staggered entrance on an 8px rhythm. Never hand-place coordinates when a layout fits.
- `showcase NAME { type phoneShowcase media alias headline "..." }` — one real asset becomes a product presentation with bezel, screen crop, glare, shadow, entrance, idle float, and camera push. Never build a device out of rectangles.

Beat transitions transform rather than fade: `sharedElement`, `objectMorph`, `layoutMorph` (each needs `from` and `to`), or `cameraMove`, `continuous`, `cut`.

Implementation lives in `src/motion-system/` (layouts, showcases, beats, transitions, asset intelligence, selection metadata) and `src/semantic/motion-lowering.ts`. `registry/` holds generated JSON manifests only — run `npm run registry:generate` after changing a definition. See `docs/motion-language/motion-system.mdx`.

## Semantic Components

Compose recognizable interfaces from the built-in component library before hand-drawing UI. `component name { type dashboard ... }` compiles into structured, professionally choreographed parts named `NAME__PART`. Types: cloud, database, server, arrow, button, dashboard, phone, browser, logo, chart, notification, cursor, codeeditor, website, terminal, pricingcard, laptop, editor (the Motionly workspace), card, form, chat, modal, and navigation. Fill them with content props (`label`, `values`, `labels`, `headline`, `cta`, `countTo`), select a `variant` and `motionPreset minimal|smooth|spring|premium`, customize any part with a dotted override (`price.countPrefix "€"`), animate parts directly (`animate NAME__PART { ... }`), and wire cause and effect with `connects`, `clicks` + `clickAt`, and `reactsTo`. Component text renders in the bundled Space Grotesk display face. See `.agents/skills/write-motionly/references/motion-syntax.md` for the full contract.

## Preset Guidance

Presets should be subtle:

- Fade in: `opacity 0` to target opacity
- Rise in: `opacity 0`, `y + 80` to target
- Scale in: `opacity 0`, `scale .85` to target
- Blur reveal: `opacity 0`, `blur 12`, slight `y` offset to target
- Soft drift: slight `x` offset to target

Default to `power3.out` for smooth professional motion.

Build scenes around one focal subject. Use scene color changes and purposeful object movement to mark progression; avoid constant camera drift and repeating the same fade on every object.

For simple stroked SVG logos, `animation drawSVG(...)` animates their paths and resolves into the original artwork. Use it sparingly on a hero logo; use normal image reveals for detailed SVGs, mockups, and photos.

Use the small transition set when a shot actually changes: `shapeWipe`, `irisWipe`, `maskReveal`, `dynamicSlide`, and camera `speedZoom`. Prefer one strong transition per scene over stacking effects.
