---
name: motionly
description: Create, edit, validate, and preview editable Motionly .motion animation projects. Use for Motionly storyboards, motion graphics, local assets, timing, presets, and project.motion files.
---

# Motionly projects

Motionly is a visual motion-graphics editor. Its editable source is `project.motion`; normal users refine it in the editor rather than hand-writing it. Keep generated source readable and load it through Motionly's parser and renderer.

## Project and asset workflow

- Read `AGENTS.md`, `project.motion`, and relevant files in `assets/` before editing.
- Reference media by filename under `assets/`: `import "./assets/logo.svg" as logo`.
- Keep filenames stable. A browser upload with the same filename resolves the same import. If its size or dimensions differ significantly, ask before replacing it.
- Preserve aspect ratio by setting only `width` or `height`.
- Treat MP4, WebM, MOV/M4V, GIF, animated SVG, and Lottie as animated media. Preserve their motion and report actual browser/renderer limitations instead of flattening them.
- Prefer native SVG or overlay artwork for logos, icons, diagrams, badges, illustrations, and UI graphics unless the user asks to preserve an imported animation.
- Use one focal subject per shot and purposeful scene changes. Avoid constant camera drift and the same fade on every layer.

## Supported source

```motion
canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #020308
}

camera {
  zoom 1
  cameraAnimation "speedZoom(delay 3s duration 1s from 1 peak 1.08 to 1.02 ease power3.out)"
}

import "./assets/logo.svg" as logo

logo {
  center
  layer hero
  width 240
  opacity 1
  animation "maskReveal(delay 300ms duration 800ms direction down ease power3.out)"
}

text title {
  value "Make it move."
  center
  layer text
  y 180
  size 72
  color #ffffff
  opacity 1
  textAnimation "keynoteText(split words stagger 80ms duration 750ms delay 1s ease power3.out)"
}
```

- Use one `canvas`; `camera` is optional.
- Render an imported asset with its alias directly. Do not invent `asset`, `video`, `scene`, `group`, `rect`, or `layer` block types.
- Built-in visual blocks are `text`, `overlay`, and `effect`.
- Valid layers: `background`, `hero`, `supporting`, `content`, `details`, `text`, `effects`.
- Common properties: `x`, `y`, `width`, `height`, `scale`, `rotation`, `originX`, `originY`, `skewX`, `skewY`, `opacity`, `blur`, `size`, `weight`, `color`, `fill`, `stroke`, `strokeWidth`, `center`, `cover`, `layer`, `duration`, `delay`, `easing`.
- Use `size`, not `fontSize`. Explicit animations use `easing`; preset options use `ease`.

Explicit animation:

```motion
animate title {
  from {
    opacity 0
    y 80
    blur 10
  }

  to {
    opacity 1
    y 0
    blur 0
  }

  duration 1s
  delay 0s
  easing power3.out
}
```

Keyframes are percentage blocks inside `keyframes` inside `animate`. Persistent timeline rows use `track NAME { ... }`; media clips use `clip ALIAS { track NAME start 0s duration 5s trimIn 0s trimOut 0s }`. Project audio is `audio "./assets/music.mp3" { start 0s }`.

Prefer `power3.out`. Useful text presets: `keynoteText`, `wordReveal`, `charReveal`, `splitReveal`, `blurReveal`, `fadeUp`, `slideIn`, `scaleText`, `typewriter`, `maskReveal`, `gradientReveal`. Useful object/transition presets: `softReveal`, `maskReveal`, `dynamicSlide`, `shapeWipe`, `irisWipe`, `drawSVG`, `sceneExit`, `scaleReveal`. Use `drawSVG` only for simple stroked SVG logos. Camera presets include `slowPush`, `pan`, `pull`, and `speedZoom`.

## SVG and professional motion

- For local zooms, pans, push-ins, and pull-backs, animate the SVG object's own `x`, `y`, `scale`, `rotation`, `originX`, and `originY`; do not move the global camera.
- Stagger related vector/text parts, hold completed compositions long enough to read, and make exits faster than entrances.
- Use one focal subject per shot, clear hierarchy, meaningful transitions, and deliberate scene progression. Avoid repeated fade-only scenes, clutter, stale layers, and constant camera drift.
- Path morphing and deterministic animated-SVG seeking are not currently available; use editable transforms/masks or state the limitation.

## Validate and preview

From the project folder:

```bash
npx motionly dev
```

This loads `project.motion` and `assets/`, opens the editor, and saves changes back to `project.motion`. Verify the canvas size, FPS, exact duration, imports, readable holds, transitions, final frame, and save/reload behavior before finishing.
