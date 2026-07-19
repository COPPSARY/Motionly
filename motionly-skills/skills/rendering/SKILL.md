---
name: rendering
description: Validate Motionly preview, scrubbing, serialization, and final export. Use for missing assets, blank frames, non-finite state, animated media synchronization, browser codec limitations, Lottie/GIF/SVG playback, MP4/WebM/GIF export, pixel inspection, and renderer troubleshooting.
---

# Rendering

Use the production parser → scene graph → evaluator → asset synchronizer → Canvas renderer path. A valid parse is necessary but does not prove visual correctness.

## Validation Loop

1. Parse and build the scene graph.
2. Verify canvas size, FPS, duration, imports, tracks, and expected elements.
3. Run `inspect:motion` with the expected duration.
4. Review every reported empty-frame range.
5. Preview representative timestamps and real media decoding.
6. Export a short representative render when animated assets changed.
7. Save/reload and confirm round-trip stability.

## Animated Media Contract

- MP4/WebM/MOV seek through the browser video decoder.
- Lottie and supported GIF seek to project time before every deterministic export frame.
- Animated SVG and GIF fallback use wall-clock playback; deterministic MP4/GIF export deliberately runs in real time for those assets.
- Browser codec or API gaps must appear as explicit editor warnings/errors.

## Inspect These Frames

- First visible frame.
- First decoded frame of every animated asset.
- A mid-animation frame proving motion is not flattened.
- Clip trim boundaries.
- One frame before/during/after transitions.
- Final visible frame.

## Failure Guide

- Asset imports but stays blank: inspect decoder error, MIME type, CORS, and browser codec.
- Video frame lags while scrubbing: use exact synchronization and await `seeked`.
- Lottie blank: verify `.lottie` data, WASM load, intrinsic animation size, and load events.
- GIF frozen in export: verify `ImageDecoder` or real-time fallback pacing.
- Animated SVG appears at the wrong phase: its Canvas timeline is live; restart at clip activation and disclose lack of exact seeking. If CSS keyframes differ, report the Canvas runtime limitation.
- Preview/export differ: confirm both call the same evaluated time and asset synchronization path.

Do not claim pixel correctness from deterministic state signatures alone.
