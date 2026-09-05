---
name: dark-pattern-audit
description: |
  Audits codebases and product copy for deceptive dark patterns inferable from
  local source code and text — no runtime inspection or screenshots needed.
  Produces a structured narrative report with confidence grading, source
  locations, concise reasoning, and official pattern reference links for each
  detected pattern. Covers pricing, subscriptions, consent, modals, preselected
  controls, misleading CTAs, and more.
triggers:
  - "dark pattern audit"
  - "dark pattern detection"
  - "deceptive design audit"
  - "dark-pattern-audit"
  - "deceptive patterns"
  - "manipulative UI audit"
das:
  type: package
  category: accessibility-quality
  upstream: "https://github.com/SidKH/skills"
  version: latest
---

# dark-pattern-audit

> Catalogue stub — full skill: [SidKH/skills](https://github.com/SidKH/skills)

## Install the full skill

```bash
# Global
git clone https://github.com/SidKH/skills /tmp/sidhk-skills
cp -r /tmp/sidhk-skills/dark-pattern-audit ~/.agents/skills/dark-pattern-audit

# Project
cp -r /tmp/sidhk-skills/dark-pattern-audit .agents/skills/dark-pattern-audit
```

## What it does

Static analysis of a codebase for dark patterns — purely from source code and copy, without runtime access:

**Surfaces covered:**
- Pricing, checkout, billing, fees, cart, upsells
- Subscriptions, trials, renewals, cancellation flows
- Consent dialogs, privacy prompts, notification permissions
- Modals, interstitials, countdown timers, fake stock counters
- Preselected controls, bundled choices, forced steps
- Misleading CTA text, low-contrast disclosures, hidden disclaimers

**Output per finding:**
- Pattern name + official reference link
- Confidence grade (conservative — only high-confidence findings reported)
- Exact source location (file, line, component)
- Concise reasoning grounded in local evidence

**Workflow:** Confirm scope → load pattern catalog → search evidence in code/copy → report

## When NOT to use

- General design quality audit (typography, dark mode, RTL) → use `design-auditor`
- WCAG accessibility compliance → use `wcag-ai-skill`
- AI writing pattern detection → use `humanize-text`
- Ethical design strategy → use `plan-design-review`
