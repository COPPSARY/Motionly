---
name: svg
description: Create and animate editable SVG/vector artwork in Motionly. Use for logos, icons, badges, illustrations, diagrams, line art, UI graphics, draw-on reveals, fills, strokes, masks, local zoom/pan, vector callouts, and imported animated SVG behavior.
---

# SVG Motion

Prefer native editable SVG or Motionly overlay primitives when the requested artwork is a logo, icon, diagram, badge, line illustration, or UI graphic. Import an existing animated SVG only when preserving its original SMIL/CSS animation is part of the brief.

## Choose A Treatment

- Simple stroked mark: create clean paths and use `drawSVG`.
- Filled logo: reveal the silhouette, then animate fill/stroke and settle scale.
- Diagram: split meaningful parts into separate SVG assets or overlay paths so timing stays editable.
- Screenshot annotation: use `image` plus child `overlay` primitives.
- Existing animated SVG: preserve it as animated media; disclose that Canvas playback is live and not deterministically seekable, and that CSS keyframes may differ from browser DOM playback.

## Local Cinematic Motion

Animate the SVG object, not the global camera, when focus stays inside one artwork:

```motion
logo {
  center
  width 420
  originX .68
  originY .42
  scale 1
  x 0
  y 0
  rotation 0
  animation "drawSVG(duration 1.1s ease power3.out)"
}

animate logo {
  keyframes {
    0% { opacity 0 scale .82 x 90 y 34 blur 8 }
    70% { opacity 1 scale 1.06 x -20 y -8 blur 0 }
    100% { opacity 1 scale 1 x 0 y 0 blur 0 }
  }
  duration 1.2s
  easing power3.out
}
```

`originX` and `originY` are normalized from `0` to `1`. Use them to push into a specific logo corner or diagram region while keeping the layer editable.

## Fill And Stroke

Imported simple path SVGs accept editable `fill`, `stroke`, and `strokeWidth` overrides. These values can be animated in explicit keyframes:

```motion
animate mark {
  from { fill #111827 stroke #7dd3fc strokeWidth 8 opacity 0 }
  to { fill #38bdf8 stroke #ffffff strokeWidth 2 opacity 1 }
  duration 900ms
  easing power3.out
}
```

Use overlays for independent vector parts:

```motion
overlay route {
  parent dashboard
  shape path
  path "M80 380 C260 120 520 120 760 300"
  fill none
  stroke #7cf7c5
  strokeWidth 8
  animation "animated-arrow-point(duration 900ms ease power3.out)"
}
```

## Quality Rules

- Preserve `viewBox` and aspect ratio; set one of `width` or `height`.
- Keep path count intentional; separate only parts that need independent timing.
- Stagger related parts by 60–140ms, then hold the completed mark.
- Pair draw-on motion with a restrained fill/opacity resolve; do not leave the logo as outlines unless intended.
- Use masks and clipping for reveals, not white rectangles pretending to erase artwork.
- Morphing is not currently deterministic in the Motionly renderer; use transform, mask, or matched-shape crossfades and state the limitation.
