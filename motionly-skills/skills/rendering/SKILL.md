---
name: rendering
description: Validate Motionly parsing, scene graph lowering, canvas preview, scrubbing, animated media synchronization, serialization, and export. Use for blank frames, missing media, non-finite state, aspect-ratio bugs, and preview/export differences.
---

# Rendering

The production path is parser -> semantic/motion lowering -> scene graph ->
evaluator -> asset synchronizer -> Canvas renderer. Parsing is not visual proof.

Run:

```bash
npm run inspect:motion -- project.motion --strict
npm run type-check
npx vitest run tests/language tests/motion-system tests/semantic
```

Then preview the first frame, every asset's decoded start/middle/end, animation
midpoint, clip trim boundaries, one frame before/during/after each scene/beat
boundary, and the final frame. Save/reload and verify parse/serialize/parse.

Check canvas size/FPS/duration, asset aliases, element bounds, scene ownership,
track/clip timing, keyframe targets, exits, background coverage, and audio mute/
start rules. Check both the editor canvas and exported representative frames.

Known limits: browser video codec support varies; animated SVG runs live and is
not exactly frame-seekable; CSS keyframes may differ in Canvas SVG playback; GIF
fallback can be real-time; Lottie requires its player/WASM/data to load. Report
the exact asset and decoder warning instead of hiding it or flattening motion.
