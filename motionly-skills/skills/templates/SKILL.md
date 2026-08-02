---
name: templates
description: Turn a product brief into an editable Motionly storyboard for SaaS launches, demos, logo reveals, diagrams, walkthroughs, metric stories, and social exports using intentional composition and continuity.
---

# Templates

Templates are starting story plans, not disposable visual slides. Read
[authoring-contract.md](../../references/authoring-contract.md) and build the
layout/components/showcase before animation.

## Product Launch Default

1. Promise: one large hero sentence and brand lockup.
2. Context: one clean statement about the workflow/problem.
3. Proof: exact product screenshot/video in a showcase or `mediaTour`.
4. Behavior: one visible click, progress, count, chart, or UI response.
5. Composition: editor/workspace or feature arrangement only if it advances the story.
6. Delivery: export/result state with no unnecessary modal construction.
7. Close: logo, CTA, and a readable final hold.

Vary shots by editorial purpose: centered type, split copy/media, full-frame
product UI, local detail tour, and clean close. Do not repeat the same zoom/pan,
small labels, or generic card grid.

## Other Patterns

- logo reveal: real SVG -> `heroLogo` or restrained `drawSVG` -> identity hold;
- diagram: named nodes -> `layout`/paths -> `connects` -> local focus;
- metric story: `metric-card`/`chart` -> `countUp`/`chartGrowth` -> result hold;
- UI walkthrough: exact screenshot/video -> `uiWalkthrough` -> focus points -> cause/effect;
- social stat: one number -> `countUp` -> one supporting phrase -> logo close.

Every template must still pass storyboard audit and visual frame review.
