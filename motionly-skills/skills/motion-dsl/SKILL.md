---
name: motion-dsl
description: Author, repair, and explain valid editable Motionly .motion source. Use for canvas, imports, elements, tracks, clips, audio, sequences, explicit animations, keyframes, presets, parsing errors, and parse/serialize round trips.
---

# Motion DSL

Treat `.motion` as the editable source beneath Motionly's visual editor. Inspect the current parser, scene graph, serializer, and existing project before changing syntax. Never invent a block or property because another animation tool has it.

## Build In This Order

1. Define one `canvas` with inferred size, FPS, duration, and background.
2. Import only real asset paths with single-word aliases.
3. Declare stable tracks when timing/layer placement matters.
4. Add imported aliases, `text`, `overlay`, or `effect` elements.
5. Add clips for timed media and `audio` for project sound.
6. Add presets or explicit `animate` blocks.
7. Parse, serialize, parse again, then inspect representative frames.

## Core Syntax

```motion
canvas {
  size 1920x1080
  fps 60
  duration 8s
  background #07090f
}

import "./assets/product.webm" as product

track hero {
  label "Hero"
  role main
  content primary
  order 0
}

product {
  center
  width 1280
  layer hero
  scale 1
  opacity 1
}

clip product {
  track hero
  start 1s
  duration 5s
  trimIn 500ms
  trimOut 0s
}
```

Render imported media with its alias directly. Valid built-in visual blocks are `text`, `overlay`, `effect`, and `image` (the latter attaches overlays to a bitmap source). Do not invent `video`, `scene`, `group`, `rect`, or `layer` blocks.

## Explicit Motion

```motion
animate product {
  keyframes {
    0% { opacity 0 scale .92 y 80 }
    65% { opacity 1 scale 1.015 y 0 }
    100% { opacity 1 scale 1 y 0 }
  }
  duration 900ms
  delay 1s
  easing power3.out
}
```

Use `easing` on explicit animations and `ease` inside preset calls. Use `size`, never `fontSize`. Put properties on separate lines in production source even though compact keyframe rows parse.

## Timing Rules

- `start`/`duration` on a visual element define its visibility window.
- `clip` controls imported media timing, source trim, and timeline track.
- `delay` offsets an animation; it does not move the element's clip.
- Percentage keyframes are relative to the animation duration.
- Moving a whole layer moves its animation timing; trimming changes visibility without silently retiming keyframes.
- Keep audio on the bottom audio track and preserve its `start`.

## Repair Checklist

- Confirm every animation target and clip alias exists.
- Confirm imports use quoted paths and aliases have no spaces.
- Replace `fontSize` with `size`; replace explicit `ease` with `easing`.
- Remove unsupported block names and properties.
- Preserve unrelated tracks, masks, keyframes, and exact copy.
- Run the project's inspection command and review empty-frame ranges rather than assuming they are intentional.

Return a complete project, not a fragment, unless the user explicitly asks for a snippet.
