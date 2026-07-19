---
name: typography
description: Design and animate readable Motionly typography. Use for titles, captions, kinetic type, narration-synced copy, word/character reveals, typewriter effects, numeric callouts, hierarchy, line breaks, font sizing, tracking, and text timing.
---

# Typography

Preserve exact supplied copy. Split text for layout or timing without paraphrasing unless the user permits edits.

## Choose The Reveal

- Key promise: `keynoteText` or `wordReveal` with restrained word stagger.
- Short energetic phrase: `charReveal`, `60–80ms` stagger.
- Editorial headline: `splitReveal` or `maskReveal` by line.
- Technical label: `fadeUp` or `softReveal`.
- Typed interface moment: `typewriter`, used once.
- Metric: `countUp` with a stable label and enough hold to read the result.

```motion
text title {
  value "Build momentum, not busywork."
  center
  y -80
  size 92
  weight 760
  tracking -1
  color #f8fafc
  textAnimation "keynoteText(split words stagger 90ms duration 800ms delay 600ms ease power3.out exitAt 4.6s exitDuration 420ms)"
}
```

## Readability

- Keep short headline holds at least one second after the full reveal.
- Give narration-matched text time to remain visible through the spoken phrase.
- Make exits faster than entrances and clear old copy before conflicting copy arrives.
- Reduce size or split lines before allowing clipping or media overlap.
- Use weight, scale, contrast, and timing for hierarchy before adding decorative motion.

## Kinetic Type Pattern

Reveal the decisive noun or verb last, with stronger scale or color, while the rest settles quietly. Do not animate every word differently; the audience should read a sentence, not decode an effect demo.
