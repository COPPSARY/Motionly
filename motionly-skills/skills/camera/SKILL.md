---
name: camera
description: Direct global camera moves and local artwork focus in Motionly. Use for push-ins, pull-backs, pans, speed zooms, focal shifts, diagram walkthroughs, logo close-ups, parallax planning, and deciding whether to animate the camera or an individual SVG/object.
---

# Camera

Move the global camera only when the whole composition changes viewpoint. If the request focuses on one logo, SVG, screenshot, or diagram, animate that object's `x`, `y`, `scale`, `rotation`, `originX`, and `originY` instead.

## Decision

- Whole scene advances toward a product: global `slowPush` or `push`.
- Whole scene reveals wider context: global `pull`.
- Attention moves across a large composition: global `pan`.
- Only one vector or panel is inspected: local object transform.
- Scene cut needs a punch: one `speedZoom`, followed by stillness.

## Global Example

```motion
camera {
  zoom 1
  x 0
  y 0
  rotation 0
  cameraAnimation "speedZoom(delay 4s duration 900ms from 1 peak 1.09 to 1.02 ease power3.out)"
}
```

Keep safe margins around every layer because camera transforms affect all visible content.

## Local Diagram Walkthrough

```motion
diagram {
  center
  width 1500
  originX .78
  originY .3
}

animate diagram {
  keyframes {
    0% { scale .92 x 0 y 0 }
    48% { scale 1.35 x -260 y 120 }
    100% { scale 1 x 0 y 0 }
  }
  duration 5s
  easing power3.out
}
```

Hold after arriving at a focus point. Constant drift makes reading difficult and turns intentional camera language into noise.

## Limits

Motionly has one global 2D camera; it does not provide depth-aware 3D camera rigs. Build parallax with separate editable layers moving at different rates and state the limitation if true 3D perspective is required.
