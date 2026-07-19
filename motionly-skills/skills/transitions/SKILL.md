---
name: transitions
description: Choose and author Motionly scene and clip transitions. Use for scene changes, crossfades, wipes, iris reveals, dynamic slides, speed zooms, exits, continuity, and fixing abrupt cuts or stacked transition effects.
---

# Transitions

Use a transition to express a relationship between shots: continuity, replacement, reveal, escalation, or closure. A normal cut is valid when motion inside the shots already carries the change.

## Selection Map

- `shapeWipe`: decisive replacement or brand-color scene change.
- `irisWipe`: focus into/out of a circular subject.
- `maskReveal`: media enters through a controlled edge.
- `dynamicSlide`: supporting panel continues directional flow.
- `speedZoom`: short escalation or product-to-detail cut, once.
- Clip `crossfade`: two touching media clips on the same track.

## Clip Crossfade

```motion
clip outgoing {
  track hero
  start 0s
  duration 3s
  transitionOut crossfade
  transitionOutDuration 450ms
}

clip incoming {
  track hero
  start 3s
  duration 3s
  transitionIn crossfade
  transitionInDuration 450ms
}
```

Pair both sides with the same duration. Do not use a crossfade to hide mismatched composition if a clean cut or purposeful wipe communicates better.

## Timing

Start exits slightly before the transition covers them. Keep most transitions between `450–900ms`. Inspect frames around every boundary for flashes, stale layers, blank gaps, and unreadable overlapping copy.

Prefer one strong transition per real scene change. Stacking a wipe, spin, zoom, and blur weakens the visual grammar.
