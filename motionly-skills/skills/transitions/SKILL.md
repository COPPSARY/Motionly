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
- `sceneSlide`: connected whole-scene push in `up|right|down|left`.
- `sceneZoom`: whole-scene zoom-through into the next shot.
- Clip `crossfade`: two touching media clips on the same track.

## Connected Scene Transitions

```motion
scene outgoing {
  start 0s
  duration 5.5s
  transitionOut "sceneSlide(direction down duration .5s)"
}

scene incoming {
  start 5s
  duration 5s
  transitionIn "sceneSlide(direction down duration .5s)"
}
```

Pair both sides with the same name, direction, and duration. The direction is
camera travel: `down` moves the outgoing scene up and brings the incoming scene
from below. Because the scene root moves, every child layer travels with it.
Use `sceneZoom` the same way for a zoom-through boundary.

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

Do not animate individual exits before a paired scene transition; the transition is the exit. Keep most transitions between `350–700ms`. Inspect frames around every boundary for flashes, stale layers, blank gaps, and unreadable overlapping copy.

Prefer one strong transition per real scene change. Stacking a wipe, spin, zoom, and blur weakens the visual grammar.
