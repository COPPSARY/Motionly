---
name: content-strategy
description: |
  Define what content a product needs, how it is structured, and who owns it.
  Content audit, content model, voice and tone, governance, and content hierarchy.
triggers:
  - "content strategy"
  - "content model"
  - "content governance"
  - "voice and tone framework"
das:
  type: skill
  category: content-design
  upstream: "https://github.com/Owl-Listener/designer-skills"
  upstream_path: "ux-strategy/skills/content-strategy/SKILL.md"
  version: latest
---

# content-strategy

> Catalogue stub — full skill: [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills)

## Decision tree

1. **Is the full skill already installed?**
   - Global: `grep -q "^das:" ~/.agents/skills/content-strategy/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - Project: `grep -q "^das:" .agents/skills/content-strategy/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - No `das:` block → full skill installed, invoke and proceed
   - `das:` block present → go to step 2

2. **Detect scope, then install:**

   ```bash
   [ -e ~/.agents/skills/content-strategy ] && echo "global" || echo "project"
   ```

   **Global:**
   ```bash
   npx skills add Owl-Listener/designer-skills --skill content-strategy -g -y
   ```

   **Project:**
   ```bash
   npx skills add Owl-Listener/designer-skills --skill content-strategy -y
   ```
   > **Claude Code:** send either command as a chat message starting with `!` to run it without leaving the conversation.

## What it does

Owls product content-strategy framework: content audit (keep/revise/consolidate/remove), content model with typed attributes and relationships, voice-vs-tone with registers, governance (owners/review cycles/source-of-truth), and content hierarchy. Distinct from microcopy/UX-writing — this is the upstream framework that UX writing executes within.

## When NOT to use

- Writing individual UI strings → use `ux-writing-skill`
- Long-form marketing copy → use `copywriting-skill`
