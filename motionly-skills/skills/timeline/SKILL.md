---
name: timeline
description: Organize Motionly tracks, clips, scene-local timing, trims, overlaps, exits, media sequences, and audio placement while preserving editable timing through serialization.
---

# Timeline

Scenes and beats are the story timeline. Tracks and clips are media timing. An
element animation's `delay` is not a clip start.

```motion
track product { label "Product" role main content video order 0 }
track overlay { label "Callouts" role overlay content mixed order 1 }
clip demo {
  track product
  start 2.4s
  duration 4s
  trimIn 1.2s
  transitionIn crossfade
  transitionInDuration 350ms
}
```

Horizontal movement changes time; vertical movement selects the explicit layer.
Overlaps are allowed only when visual ordering makes the overlap intentional.
Keep audio on the bottom audio track. `transitionIn`/`transitionOut` and their
durations are clip-only and currently support `crossfade`; scene transitions use
scene `transition` or beat transition kinds instead.

Retiming rules:

- move a layer when its keyframes should move with it;
- trim media visibility without silently retiming authored animation;
- preserve `start`, `duration`, `trimIn`, `trimOut`, track, and mute state;
- import the same video under two aliases for simultaneous source times;
- leave transition handles and readable holds at boundaries.

Validate strict inspection and parse/serialize/parse after every retime.
