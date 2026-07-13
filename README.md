<div align="center">
  <img src="video-motion/assets/logo.svg" alt="Motionly" height="86" />
  <br/><br/>

  <h1>Motionly</h1>

  <p><strong>Motion graphics, written.</strong></p>

  <p><em>A lightweight renderer for creating polished product videos from simple scene files.<br/>Write the scene. Preview the motion. Export the result.</em></p>

  <br/>

  [![JavaScript](https://img.shields.io/badge/JavaScript_ESM-F7DF1E?style=flat-square&logo=javascript&logoColor=000)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![Canvas](https://img.shields.io/badge/Canvas_Renderer-111827?style=flat-square&logo=html5&logoColor=E34F26)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
  [![GSAP](https://img.shields.io/badge/GSAP-0AE448?style=flat-square&logo=greensock&logoColor=000)](https://gsap.com/)
  [![Motion](https://img.shields.io/badge/Motion-FFF312?style=flat-square&logo=framer&logoColor=000)](https://motion.dev/)
  [![WebM](https://img.shields.io/badge/Export_WebM-5B7CFA?style=flat-square)](#export)
  [![GIF](https://img.shields.io/badge/Export_GIF-7CF7C5?style=flat-square)](#export)

  <br/><br/>

  <a href="#overview">Overview</a> &middot;
  <a href="#showcase">Showcase</a> &middot;
  <a href="#motion-files">Motion Files</a> &middot;
  <a href="#goals">Goals</a> &middot;
  <a href="#contributing">Contributing</a>
</div>

---

## Showcase

<div align="center">
  <img src=".github/assets/showcase.gif" alt="Motionly showcase animation" width="900" />
</div>

---

## Overview

Motionly is a browser-first motion graphics renderer built around one idea:

> Professional motion graphics should be describable with readable files.

Instead of manually creating keyframes in a timeline editor, Motionly reads a `.motion` scene file, builds an AST, resolves a deterministic scene graph, evaluates animation state frame-by-frame, and renders the result to Canvas.

The current focus is the foundation: clean scene syntax, reliable preview, reusable animation presets, camera movement, layer hierarchy, and export.

---

## Motion Files

The main video entry point is:

```text
video-motion/codex-showcase.motion
```

Scene-specific assets live in:

```text
video-motion/assets/
```

Example:

```motion
canvas {
  size 1920x1080
  fps 60
  duration 42s
  background #020308
}

camera {
  zoom 1
  x 0
  y 0
}

import "./assets/logo.svg" as mark

mark {
  center
  layer hero
  width 220
  animation heroLogo(delay 1s duration 1.4s)
}

text title {
  value "Motion graphics, written."
  center
  layer text
  textAnimation keynoteText(split words stagger 120ms duration 1.2s)
}
```

Motionly supports semantic layers, camera animation, sequences, reusable presets, SVG/image assets, text reveals, generated background effects, preview playback, and export.

---

## Goals

Current product goals:

- Make the showcase animation feel better: stronger story, clearer hierarchy, more cinematic transitions, better asset composition.
- Fix export quality and reliability. Export is currently laggy and does not work properly enough for real use.
- Keep `.motion` readable enough that someone can understand a scene file in under one minute.
- Improve animation presets so authors can describe intent instead of manually writing every opacity/position keyframe.
- Keep the renderer deterministic: every frame must come from the scene graph.

---

## Architecture

```text
.motion source
  -> parser
  -> AST
  -> scene graph
  -> animation preset compiler
  -> animation evaluator
  -> canvas renderer
  -> preview / export
```

Core folders:

| Path | Purpose |
|---|---|
| `AGENTS.md` | AI-agent guidance for writing and maintaining `.motion` files |
| `src/language` | Tokenizer, parser, AST helpers |
| `src/scene` | Scene graph normalization and layer/camera structure |
| `src/animation` | Deterministic animation evaluation |
| `src/animation-library` | Reusable animation presets |
| `src/render` | Canvas renderer |
| `src/export` | WebM/GIF/MP4 export boundary |
| `src/app` | Browser UI |
| `video-motion` | Showcase `.motion` entry point and assets |

---

## Open Source

Motionly is MIT licensed.

Project docs:

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Motion Language](docs/motion-language.md)
- [Animation Presets](docs/animation-presets.md)
- [Export](docs/export.md)
- [AI Agent Guide](docs/ai-agents.md)

---

## Export

Motionly currently supports:

- WebM through browser `MediaRecorder`
- MP4 only when the browser exposes MP4 recording support
- GIF through the built-in lightweight GIF encoder

Known issue: export needs major improvement. It is currently too laggy and unreliable for production-quality output.

---

## Run

```powershell
npm install
npm start
```

Open:

```text
http://localhost:5173
```

---

## Test

```powershell
npm test
```

---

## Contributing

Repository:

https://github.com/COPPSARY/Motionly

Contribution priorities:

1. Improve the showcase animation and `.motion` authoring quality.
2. Fix export performance and correctness.
3. Add focused tests for parser, scene graph, animation presets, camera, and export.
4. Keep files small and readable.
5. Avoid adding large dependencies unless they clearly simplify the foundation.

Before opening a PR:

- Run `npm test`
- Keep `.motion` examples readable
- Avoid hidden state in rendering
- Do not mutate imported assets
- Prefer deterministic frame evaluation over runtime side effects

---

## Links

<div align="center">

| Platform | Link |
|---|---|
| GitHub | [COPPSARY](https://github.com/COPPSARY) |
| Facebook | [COPPSARY](https://web.facebook.com/profile.php?id=61567582710788) |

</div>

---

<div align="center">
  <p><em>Effortless Animation</em></p>
</div>
