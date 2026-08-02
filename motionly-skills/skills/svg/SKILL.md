---
name: svg
description: Author editable Motionly SVG logos, icons, diagrams, path reveals, local pan/zoom, fill/stroke treatments, motion paths, and restrained vector transitions.
---

# SVG Motion

Use native SVG/imported SVG for logos, icons, diagrams, and line art. Use a real
brand SVG when available; never substitute a hand-drawn approximation for a
provided logo. Read [authoring-contract.md](../../references/authoring-contract.md).

```motion
import "./assets/brand.svg" as brand

brand {
  center
  width 360
  originX .5
  originY .5
  animation "heroLogo(duration 720ms ease power4.out)"
}
```

Simple stroked artwork can use `drawSVG`; use it sparingly for a hero mark or
structural connector. `trimStart` plus `pathProgress` creates a moving segment.
`motionPath`, `motionPathProgress`, and `motionPathRotate` follow a declared
SVG/native path guide. Animate local x/y/scale/origin for a diagram walkthrough;
do not move the global camera for one logo.

Separate SVG parts only when they have independent narrative timing. Keep
related stagger around 60-140ms and hold the completed mark. Shared path morphs
require compatible command topology; incompatible paths use a deterministic
move/transition fallback. Gradient-stop animation and guaranteed arbitrary path
morphing are unsupported.

Validate that the SVG asset loads, its viewBox is correct, its paths are inside
the canvas, and any animated SVG is tested in real time because CSS keyframes may
differ in the Canvas runtime.
