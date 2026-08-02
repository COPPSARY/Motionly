---
name: camera
description: Direct Motionly global camera moves and local screenshot/SVG focus paths. Use for product pushes, pulls, pans, speed zooms, detail inspection, perspective, and deciding whether the camera or one asset should move.
---

# Camera

Move the global camera only when the whole composition changes viewpoint. Move a
single screenshot, SVG, logo, or UI surface locally when attention changes within
that asset. This prevents every picture from receiving the same global zoom.

| Need | Treatment |
| --- | --- |
| approach the whole product | global `push`/`slowPush` |
| widen context | global `pull` |
| travel across a composed board | global `pan` |
| one UI area becomes the subject | local `mediaTour`, `focusZoom`, or authored transform |
| quick match cut | one `speedZoom` or `zoomThrough` |
| directional change | local `whipPan` only with a visible cause |

For real UI, use `mediaTour` with normalized `focusX`/`focusY` points or animate
the exact imported screenshot. Do not rebuild a close-up from approximate cards.
Use `rotationX`/`rotationY` only as a restrained presentation treatment; Motionly
has no depth-aware 3D camera rig.

```motion
camera { zoom 1 x 0 y 0 }
animate camera {
  from { zoom 1 x 0 y 0 }
  to { zoom 1.08 x -80 y 12 }
  duration 1.2s
  delay 3s
  easing sine.inOut
}
```

Always hold after a focus arrives. Constant drift is not a story.
