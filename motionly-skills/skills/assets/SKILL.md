---
name: assets
description: Inventory, import, present, time, and troubleshoot Motionly image, SVG, GIF, MP4, WebM, MOV, Lottie, and audio assets without flattening or distorting their content.
---

# Assets

Inventory before composition: path, format, width, height, aspect ratio,
duration, codec, transparency, and whether motion must be preserved. Use stable
local paths and single-word aliases.

| Asset | Motionly behavior |
| --- | --- |
| PNG/JPEG | static browser image |
| static SVG | editable transform; simple paths support `drawSVG`/stroke/fill |
| animated SVG | live Canvas playback; exact frame seeking and CSS parity are limited |
| GIF | `ImageDecoder` seeking when available; otherwise live fallback |
| MP4/WebM/MOV/M4V | native browser video decode; codec support is browser-dependent |
| `.lottie` | Canvas player with preview/scrub/export frame seeking |
| MP3/WAV/etc. | project audio on the bottom audio track |

```motion
import "./assets/product-ui.png" as productUI
import "./assets/demo.mp4" as demo

image productUI { center width 1400 }
clip demo { track product start 2s duration 5s trimIn 1s mute true }
```

Set one of `width` or `height` for media unless intentional cropping is needed;
use `cover` only when cropping is the story. Use the asset itself inside a
showcase or `mediaTour` for exact product proof. Do not redraw an existing UI.

For missing media, preserve an honest editable placeholder and name the missing
asset. For a blank video check browser codec/MIME, `loadedmetadata`, `seeked`,
and the asset-loader diagnostic. Do not claim a still frame proves video works.
