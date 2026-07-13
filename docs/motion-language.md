# Motion Language

Motionly scene files use a small CSS-like language designed to be readable by humans and easy for AI agents to generate.

The main showcase entry point is:

```text
video-motion/codex-showcase.motion
```

## Principles

- The `.motion` file is the source of truth.
- Keep each scene readable in under one minute.
- Use semantic layers: `background`, `hero`, `supporting`, `details`, `text`, `effects`.
- Prefer camera, position, scale, and staging over excessive opacity fades.
- Use word-based text reveals for phrases. Use character reveals only for short intentional moments.

## Example

```motion
canvas {
  size 1920x1080
  fps 60
  duration 6s
  background #020308
}

camera {
  zoom 1
  x 0
  y 0
}

import "./assets/logo.svg" as logo

logo {
  center
  layer hero
  width 220
  animation heroLogo(delay 600ms duration 1.4s)
}

text title {
  value "Motion graphics, written."
  center
  layer text
  textAnimation keynoteText(split words stagger 90ms duration 1.1s)
}
```

## Syntax Changes

Before adding syntax, ask:

- Can this be expressed with existing syntax?
- Can this be a preset instead of a language feature?
- Does this keep the file easier to read?
