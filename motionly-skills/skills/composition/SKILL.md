---
name: composition
description: Design Motionly frames with clear hierarchy, spacing, typography, color, real product media, safe aspect ratios, and intentional SaaS launch composition. Use for visual review and fixing clutter, overlap, clipping, or stale layouts.
---

# Composition

Read [authoring-contract.md](../../references/authoring-contract.md) and
[production-checklist.md](../../references/production-checklist.md).

Every shot has one job and one focal subject. A useful order is:

1. subject: largest scale/contrast and most meaningful motion;
2. proof: one UI asset, metric, or action that supports the subject;
3. context: quiet background or brand cue;
4. exit path: temporal and spatial room for the next shot.

Use `centerLayout`/`heroLayout` for a promise, `splitLayout` for editorial
feature proof, `dashboardLayout`/`bentoGrid` for structured product systems,
`cardGrid` for repeated cards, and `screenshotPresentation`/`uiWalkthrough` for
real media. Never hand-place random rectangles when a layout/component exists.

Use large intentional headlines. Supporting labels are optional; do not scatter
small text around every icon. Preserve aspect ratio, keep padding consistent,
and align to an 8px rhythm. Change background color when the story changes, not
for every beat. Maintain contrast during motion, not only at rest.

Review first frame, entrance midpoint, settled hold, pre/during/post boundary,
exit, and final frame. Delete anything that does not improve hierarchy. Treat
overlap, clipping, stretched media, stale layers, blank frames, and unexplained
camera movement as bugs.
