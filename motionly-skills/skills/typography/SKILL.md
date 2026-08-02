---
name: typography
description: Design and animate Motionly display headlines, supporting copy, kinetic text, count-up values, typewriter moments, word/character/line splits, exits, readability, and narrative text transitions.
---

# Typography

Read [authoring-contract.md](../../references/authoring-contract.md) and
[motion-catalog.md](../../references/motion-catalog.md). Text can be the subject;
do not surround a hero sentence with unnecessary small labels.

## Selection

- hero promise: `keynoteText` or `splitReveal`;
- readable sentence: `wordReveal`;
- short energetic phrase: `charReveal`;
- product/code moment: one `typewriter`;
- support copy: `fadeUp`, `riseUp`, or `slideUp`;
- metric: `countUp` with a stable label;
- title state change: one text transition such as `slideTransition`, `splitMaskWipe`, or `blurPass`.

```motion
text hero {
  value "From brief to launch film."
  center
  y -80
  size 112
  weight 760
  color #f8fafc
  textAnimation "keynoteText(split words stagger 80ms duration 850ms delay 300ms ease power4.out exitAt 4.6s exitDuration 420ms)"
}
```

Keep full reveal plus a one-second readable hold. Preserve exact copy and
punctuation. Use width, wrap, lineHeight, weight, size, and tracking to solve
layout before adding effects. Avoid animating every word differently; reveal the
decisive word last only when it improves meaning. Finish exits before the next
headline becomes dominant. Verify the text at its largest scale and at every
transition boundary.
