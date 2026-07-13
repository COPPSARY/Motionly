# Export

Motionly export is still an active V1 priority.

Current support:

- WebM through browser `MediaRecorder`.
- MP4 when the browser exposes MP4 recording support.
- GIF through the built-in lightweight GIF encoder.

## Current Problem

Export is not yet production-ready. It can be laggy and unreliable, especially for longer showcase scenes.

## Goals

- Deterministic frame capture.
- Stable frame pacing.
- Reliable duration and FPS.
- Clear export options for 720p, 1080p, 1440p, 4K, 30 FPS, and 60 FPS.
- Better progress reporting.

## Rules

- Export should render from the same scene graph as preview.
- Export should not mutate scene assets.
- Export should not depend on live playback timing.
- Export should report failures clearly.
