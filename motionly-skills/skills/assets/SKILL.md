---
name: assets
description: Import, inspect, place, animate, and troubleshoot Motionly media assets. Use for PNG/JPEG, static or animated SVG, GIF, MP4, WebM, MOV, Lottie, audio, data URLs, aspect ratios, codecs, browser decoding, trim timing, and preserving existing animation.
---

# Assets

Inventory real files before authoring. Record filename, format, dimensions, aspect ratio, duration, and whether existing animation must be preserved.

## Format Behavior

- PNG/JPEG: static browser images.
- Static SVG: editable layer transforms; simple paths also support fill/stroke overrides and `drawSVG`.
- Animated SVG: real-time Canvas SVG playback with common SMIL support; exact frame seeking is unavailable and CSS keyframes may differ from browser DOM playback.
- GIF: frame-seeked through `ImageDecoder` when available; otherwise live playback with a visible warning.
- MP4/WebM/MOV/M4V: native browser video decode and exact seek. Codec support follows the browser.
- Lottie `.lottie`: official Canvas player with frame seeking for preview, scrub, and export.
- Project audio: separate bottom track with persisted `start` and MP4 export.

Never flatten animated media to a still or silently ignore its motion.

## Import And Place

```motion
import "./assets/hero.mov" as hero
import "./assets/loader.lottie" as loader
import "./assets/animated-mark.svg" as mark

hero { center cover layer hero }
loader { center width 320 layer supporting }
mark { center width 260 layer text }
```

Set one of `width` or `height` to preserve aspect ratio. Use `cover` only when cropping is intended.

## Timeline Media

Use clips for start, duration, and source trim. Video clip audio is muted; use project audio for synchronized sound. A single imported video decoder cannot show two source times simultaneously, so import a second alias when needed.

## Troubleshoot Honestly

- MOV failure usually means the current browser lacks the file's codec; report the decoder error and recommend H.264 MP4/WebM without calling MOV unsupported.
- Animated SVG scrubbing shows the live Canvas runtime state; state the seeking and CSS-keyframe limitations when they matter.
- Large embedded files increase `.motion` size; prefer stable local asset paths for production projects.
- If loading fails, keep the project editable and identify the exact asset rather than hiding it.
