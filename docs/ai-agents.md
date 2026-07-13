# AI Agent Guide

`AGENTS.md` is the main guide for AI agents working on Motionly.

It explains:

- Motionly's product philosophy.
- How to write `.motion` files.
- How to structure scenes.
- How to use camera movement, layers, presets, and text reveals.
- What complexity to avoid.

The most important rule:

```text
The .motion file is the source of truth.
```

When an AI agent edits Motionly, it should read `AGENTS.md` before making implementation or scene-authoring decisions.

When an AI agent writes a `.motion` file, it should keep the result:

- readable
- deterministic
- visually hierarchical
- cinematic but subtle
- easy to modify by a human
