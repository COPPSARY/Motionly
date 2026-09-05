---
name: creative-director
description: |
  Senior Creative Director skill with 20+ ideation methodologies (SIT, TRIZ, SCAMPER,
  Bisociation, Synectics) and a 3-axis evaluation framework calibrated against
  Cannes Lions, D&AD, and HumanKind award standards.
triggers:
  - "creative director"
  - "creative strategy"
  - "ideation"
  - "campaign concept"
  - "creative brief"
  - "SCAMPER"
  - "TRIZ"
das:
  category: design-review
  upstream: "https://github.com/smixs/creative-director-skill"
  upstream_path: "creative-director/SKILL.md"
  version: latest
  install: true
---

# creative-director

> Catalogue stub — full skill: [smixs/creative-director-skill](https://github.com/smixs/creative-director-skill)

## Decision tree

1. **Is the full skill already installed?**
   Check whether the skill at this location still has a `das:` block:
   - Global: `grep -q "^das:" ~/.agents/skills/creative-director/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - Project: `grep -q "^das:" .agents/skills/creative-director/SKILL.md 2>/dev/null && echo "pointer" || echo "installed"`
   - No `das:` block → full skill installed, invoke it and proceed
   - `das:` block present → go to step 2

2. **Detect scope, then install:**

   To detect scope:
   ```bash
   [ -e ~/.agents/skills/creative-director ] && echo "global" || echo "project"
   ```

   **Global** (installed with `-g`):
   ```bash
   npx skills add smixs/creative-director-skill --skill creative-director -g -y
   ```

   **Project** (installed without `-g`):
   ```bash
   npx skills add smixs/creative-director-skill --skill creative-director -y
   ```
   > **Claude Code:** send either command as a chat message starting with `!` to run it without leaving the conversation.


## Invoke after install

- Skill name: `creative-director`
- Trigger phrases: "creative director", "creative strategy", "ideation", "campaign concept"

## What it does

Applies senior creative director thinking with 20+ proven ideation methodologies including SIT, TRIZ, Bisociation, SCAMPER, and Synectics. Evaluates ideas on a 3-axis framework (originality, relevance, craft) calibrated against Cannes Lions, D&AD, and HumanKind award standards. Useful for campaign strategy, brand positioning, and breaking out of generic creative solutions.
