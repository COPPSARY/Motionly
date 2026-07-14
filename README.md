<div align="center">
  <img src="public/logo.svg" alt="Motionly" height="86" />
  <br/><br/>

  <h1>Motionly</h1>

  <p><strong>Motion graphics, written.</strong></p>

  <p><em>A lightweight visual editor and renderer for polished motion graphics.<br/>Create the scene. Tune the motion. Export the result.</em></p>

  <br/>

  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
  [![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=flat-square&logo=svelte&logoColor=fff)](https://svelte.dev/)
  [![Canvas](https://img.shields.io/badge/Canvas_Renderer-111827?style=flat-square&logo=html5&logoColor=E34F26)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
  [![GSAP](https://img.shields.io/badge/GSAP-0AE448?style=flat-square&logo=greensock&logoColor=000)](https://gsap.com/)
  [![Motion](https://img.shields.io/badge/Motion-FFF312?style=flat-square&logo=framer&logoColor=000)](https://motion.dev/)
  [![MP4](https://img.shields.io/badge/Export_MP4-5B7CFA?style=flat-square)](#export)

  <br/><br/>

  <a href="#overview">Overview</a> &middot;
  <a href="#showcase">Showcase</a> &middot;
  <a href="#visual-editor">Visual Editor</a> &middot;
  <a href="#motion-files">Motion Files</a> &middot;
  <a href="#agent-and-llm-support">Agent and LLM Support</a> &middot;
  <a href="#contributing">Contributing</a>
</div>

---

## Showcase

<div align="center">
  <img src=".github/assets/showcase.gif" alt="Motionly editor and showcase animation" width="900" />
</div>

---

## Overview

Motionly is a browser-first motion graphics editor and renderer built around one idea:

> Motion graphics should be simple to create, easy to edit, and portable.

Motionly uses readable `.motion` files as the source of truth, but normal creation happens visually. Select objects, adjust transforms, tune timing and easing, scrub the timeline, preview each frame, save the project, and export MP4 without manually writing animation code.

The current focus is the core editing loop: reliable preview, direct manipulation, useful animation presets, clear timeline control, clean serialization, and dependable export.

---

## Visual Editor

Current editor features:

- Centered canvas preview with the project aspect ratio
- Play, pause, reset, timeline scrubber, timecode, and frame display
- Fit, zoom, and fullscreen preview controls
- Scene, canvas, and timeline selection
- Drag-to-move and corner scaling
- Visual position, scale, rotation, opacity, text, color, timing, and easing controls
- Add text, delete layers, resize the timeline, and trim layer ranges
- Session-based audio attachment for synchronized preview
- Open and save `.motion` projects
- Browser-supported MP4 export with progress

Current limits:

- MP4 export runs in real time and does not include audio yet
- Canvas resolution, aspect ratio, and FPS still come from `.motion`
- Full image, video, and audio clip import/editing from the timeline is roadmap work
- WebM, GIF, still-image, and image-sequence export are not exposed yet

---

## Motion Files

The main sample project is:

```text
video-motion/motionly.motion
```

Its sample assets live in:

```text
video-motion/assets/motionly/
```

Example:

```motion
canvas {
  size 1920x1080
  fps 60
  duration 8s
  background #020308
}

camera {
  zoom 1
  x 0
  y 0
}

import "/video-motion/assets/my-project/logo.svg" as mark

mark {
  center
  layer hero
  width 220
  opacity 0
  animation maskReveal(delay 1s duration 900ms direction down ease power3.out)
}

text title {
  value "Motion graphics, written."
  center
  layer text
  size 72
  textAnimation keynoteText(split words stagger 80ms duration 800ms delay 1s ease power3.out)
}
```

Motionly supports semantic layers, camera animation, reusable presets, SVG/image assets, text reveals, generated background effects, preview playback, and MP4 export.

### Use Your Own Assets

For a new animation:

1. Copy `video-motion/motionly.motion` to a new `.motion` file or replace its contents.
2. Remove sample files you do not need from `video-motion/assets/motionly/`.
3. Prefer creating a separate folder such as `video-motion/assets/my-project/`.
4. Add your own images, SVGs, logos, and audio files.
5. Update every `import` path in the `.motion` project.
6. Open the project in Motionly and finish positioning and timing visually.

Images and SVGs can be imported by `.motion` today. Audio can be attached in the timeline for preview, but it is not persisted in `.motion` or included in export yet. Visual video and media-clip import is planned.

See [Using Agents And LLMs](docs/ai-agents.md) for a complete asset and prompting workflow.

---

## Agent And LLM Support

Motionly includes repository instructions and a reusable skill for agentic coding tools:

| Path | Purpose |
|---|---|
| `AGENTS.md` | Product scope and core `.motion` syntax |
| `.agents/skills/write-motionly/SKILL.md` | Storyboard, timing, composition, asset, and validation workflow |
| `.agents/skills/write-motionly/references/motion-syntax.md` | Supported syntax and preset reference |
| `docs/ai-agents.md` | Prompting and project setup guide |

Use this short prompt with an LLM or agent working inside the repository:

```text
Read AGENTS.md and .agents/skills/write-motionly/SKILL.md first.
Inspect my assets, storyboard the animation, then create a valid .motion project.
Use only supported Motionly syntax and presets. Keep one focal subject per shot,
avoid overlap and repeated fade-only scenes, and validate the final project.
Open the result for visual refinement instead of treating the generated file as final.
```

The agent creates the first editable version. Motionly remains the place where you preview, adjust, save, and export it.

---

## Goals

Current product goals:

- Make visual editing, selection, timeline trimming, and saving feel reliable.
- Improve preview and MP4 frame pacing on longer projects.
- Add visual canvas controls for FPS, resolution, duration, and aspect ratio.
- Add image, video, and persistent audio clips to the timeline.
- Improve existing animation presets and add a small set of distinct transitions.
- Add more export formats only after MP4 is dependable.
- Provide a hosted editor/sandbox without removing local or self-hosted use.
- Allow optional external AI providers to draft editable `.motion` projects without requiring Motionly to host its own agent.

See the [Roadmap](ROADMAP.md) for the planned order of work.

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
| `AGENTS.md` | Agent guidance and product boundaries |
| `.agents/skills/write-motionly` | Reusable agent skill for authoring `.motion` |
| `src/ui` | Svelte editor and app shell |
| `src/language` | Tokenizer, parser, AST, and serializer |
| `src/scene` | Scene graph normalization and layer/camera structure |
| `src/animation` | Deterministic animation evaluation |
| `src/animation-library` | Reusable animation presets |
| `src/render` | Canvas renderer |
| `src/export` | MP4 and export pipeline |
| `video-motion` | Sample `.motion` projects and assets |

---

## Open Source

Motionly is MIT licensed.

Project docs:

- [Quick Start](docs/QUICK_START.md)
- [User Guide](docs/USER_GUIDE.md)
- [UI Guide](docs/UI_GUIDE.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md)
- [Motion Language](docs/motion-language.md)
- [Animation Presets](docs/animation-presets.md)
- [Export](docs/export.md)
- [Agent And LLM Guide](docs/ai-agents.md)

---

## Export

Motionly currently exposes MP4 export through the editor when the browser supports MP4 `MediaRecorder` output.

Known limitations:

- Export runs in real time and still needs pacing and reliability improvements.
- Attached audio is not included yet.
- Resolution and FPS use the current canvas settings.
- WebM, GIF, PNG, and image-sequence export are roadmap work.

---

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

---

## Test

```bash
npm test -- --run
npm run build
```

---

## Contributing

Repository:

https://github.com/COPPSARY/Motionly

Contribution priorities:

1. Improve the visual editor and timeline experience.
2. Fix preview and MP4 export performance and correctness.
3. Add focused tests for parser, serialization, presets, editor workflows, and export.
4. Keep `.motion` examples and implementation files readable.
5. Avoid large dependencies unless they clearly simplify the core workflow.

Before opening a PR:

- Run `npm test -- --run`
- Run `npm run build`
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
