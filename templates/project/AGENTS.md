# Motionly Agent Notes

Keep Motionly simple and visual.

Read the installed `motionly` skill before creating or substantially editing `project.motion`.

## Product Rule

Motionly is a motion graphics editor around `.motion`. The user edits visually; `.motion` is the saved source format underneath.

Do not make users hand-write `.motion` for normal animation creation.

## Project Files

- `project.motion` is the editable animation source.
- Keep local media in `assets/` and reference it by filename, such as `./assets/logo.svg`.
- Preserve asset aspect ratios by setting only `width` or `height`.
- Run `npx motionly dev` to load, validate, preview, and visually refine the project.

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
