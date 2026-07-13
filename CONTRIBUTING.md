# Contributing to Motionly

Motionly is a lightweight, deterministic motion graphics renderer. Contributions should keep the project approachable: small files, clear names, readable `.motion` scenes, and no hidden renderer state.

## Setup

```powershell
npm install
npm start
```

Open:

```text
http://localhost:5173
```

## Test

```powershell
npm test
```

Run tests before opening a pull request.

## Good First Areas

- Improve export reliability and frame pacing.
- Add focused tests for parser, scene graph, animation presets, camera, and export.
- Improve `.motion` examples without making the language larger.
- Add renderer optimizations that preserve deterministic frame output.
- Improve docs for writing simple, professional scene files.

## Code Style

- Keep files small and readable.
- Prefer explicit code over clever abstractions.
- Reuse existing helpers before adding new utilities.
- Avoid new dependencies unless they clearly reduce project complexity.
- Keep renderer behavior deterministic: every frame should come from the scene graph.
- Never mutate imported assets.

## Writing `.motion` Files

The primary showcase entry point is:

```text
video-motion/codex-showcase.motion
```

Scene assets live in:

```text
video-motion/assets/
```

Follow `AGENTS.md` when authoring `.motion` files. It explains the motion philosophy, scene structure, camera usage, layer hierarchy, and animation preset expectations for AI agents and human contributors.

## Pull Requests

Before opening a PR:

- Run `npm test`.
- Keep changes scoped and reversible.
- Include screenshots, GIFs, or short videos for visual changes.
- Explain any animation timing or renderer tradeoffs.
- Update docs when changing `.motion` syntax, presets, export behavior, or public API.
