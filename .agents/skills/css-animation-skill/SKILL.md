---
name: css-animation-skill
description: |
  Four-phase workflow — scrapes your live app's design language, interviews you about
  what to animate, produces a brief and self-contained HTML/CSS animation file, then
  iterates. Requires Claude-in-Chrome MCP for live scraping.
triggers:
  - "CSS animation"
  - "custom animation"
  - "animation from live app"
  - "css-animation-skill"
das:
  type: skill
  category: motion-animation
  upstream: "https://github.com/neonwatty/css-animation-skill"
  upstream_path: "SKILL.md"
  version: latest
  install: true
---

# css-animation-skill

> Catalogue stub — full skill: [neonwatty/css-animation-skill](https://github.com/neonwatty/css-animation-skill)

## Decision tree

1. **Is the full skill already installed?**
   Check whether the skill at this location still has a `das:` block:
   - Global: `grep -q "^das:" ~/.agents/skills/css-animation-skill/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - Project: `grep -q "^das:" .agents/skills/css-animation-skill/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - No `das:` block → full skill installed, invoke it and proceed
   - `das:` block present → go to step 2

2. **Detect scope, then install:**

   To detect scope:
   ```bash
   [ -e ~/.agents/skills/css-animation-skill ] && echo "global" || echo "project"
   ```

   **Global** (installed with `-g`):
   ```bash
   npx skills add neonwatty/css-animation-skill --skill css-animation-skill -g -y
   ```

   **Project** (installed without `-g`):
   ```bash
   npx skills add neonwatty/css-animation-skill --skill css-animation-skill -y
   ```
   > **Claude Code:** send either command as a chat message starting with `!` to run it without leaving the conversation.


## Invoke after install

- Skill name: `css-animation-skill`
- Trigger phrases: "CSS animation", "custom animation", "animation from live app", "css-animation-skill"

## What it does

Runs a four-phase animation creation workflow: (1) scrapes your live app using Claude-in-Chrome MCP to extract the existing design language — colours, fonts, spacing, motion style; (2) interviews you about what element to animate, desired feel, and constraints; (3) produces an animation brief and a self-contained HTML/CSS output file with the custom `@keyframes` animation; (4) iterates based on feedback until the result is approved. Produces bespoke keyframe animations matched to your app's visual identity rather than off-the-shelf library classes.

## When NOT to use

- Library-based animations where custom keyframes aren't needed (use `animate-css-skill` or `framer-motion-skills`)
- Video or Lottie output (use `wiggle-claude-skill`)
