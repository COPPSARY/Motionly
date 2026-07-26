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
