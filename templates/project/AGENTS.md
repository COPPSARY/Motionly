# Motionly Agent Notes

Keep Motionly simple and visual.

Read the installed `motionly` skill before creating or substantially editing `project.motion`.

## Agent Skill

Installing the skill placed it at `.<agent>/skills/motionly/SKILL.md` (Codex uses
`.agents/`, plus `.claude/`, `.gemini/`, `.opencode/`, or `.kiro/`). That file is the
quick contract; a full reference library sits beside it under `references/` (`llms.txt`
index plus focused skills: `motion-dsl`, `svg`, `animation`, `easing`, `camera`, `composition`,
`typography`, `transitions`, `timeline`, `assets`, `rendering`, `templates`).

Before writing or repairing `.motion` beyond a trivial edit:

1. Read this file and `project.motion`.
2. Open the skill `SKILL.md`, then `references/llms.txt`, and load
   `references/skills/motion-dsl/SKILL.md` plus only the other reference skills the
   task needs.
3. Treat the reference library and Motionly's parser/renderer as authoritative over
   the short summary below.

If the skill was not installed, run `npx @coppsary/motionly skills add` to add it (with its
reference library) for your agent.

## Product Rule

Motionly is a motion graphics editor around `.motion`. The user edits visually; `.motion` is the saved source format underneath.

Do not make users hand-write `.motion` for normal animation creation.

## Project Files

- `project.motion` is the editable animation source.
- Keep local media in `assets/` and reference it by filename, such as `./assets/logo.svg`.
- Preserve asset aspect ratios by setting only `width` or `height`.
- Run `npx @coppsary/motionly dev` to load, validate, preview, and visually refine the project.

## `.motion` Syntax

Use this shape:

```motion
canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #020308
}

text title {
  value "Hello"
  center
  size 72
  color #ffffff
  opacity 1
}

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

  duration 1.2s
  delay 0s
  easing power3.out
}
```

Prefer these properties: `x`, `y`, `scale`, `rotation`, `opacity`, `blur`, `size`, `color`, `center`, `duration`, `delay`, `easing`.

Use `size`, not `fontSize`. Use `easing`, not `ease`.

## Preset Guidance

Presets should be subtle:

- Fade in: `opacity 0` to target opacity
- Rise in: `opacity 0`, `y + 80` to target
- Scale in: `opacity 0`, `scale .85` to target
- Blur reveal: `opacity 0`, `blur 12`, slight `y` offset to target
- Soft drift: slight `x` offset to target

Default to `power3.out` for smooth professional motion.

Build scenes around one focal subject. Use scene color changes and purposeful object movement to mark progression; avoid constant camera drift and repeating the same fade on every object.

For simple stroked SVG logos, `animation drawSVG(...)` animates their paths and resolves into the original artwork. Use it sparingly on a hero logo; use normal image reveals for detailed SVGs, mockups, and photos.

Treat MP4, WebM, MOV/M4V, GIF, animated SVG, and Lottie as animated assets. Never flatten or silently ignore their animation. Prefer native editable SVG for logos, icons, diagrams, illustrations, badges, line art, and UI graphics unless an existing animation must be preserved. Animate local SVG focus with the object's own `x`, `y`, `scale`, `rotation`, `originX`, and `originY` instead of the global camera.

Use the small transition set when a shot actually changes: `shapeWipe`, `irisWipe`, `maskReveal`, `dynamicSlide`, and camera `speedZoom`. Prefer one strong transition per scene over stacking effects.
