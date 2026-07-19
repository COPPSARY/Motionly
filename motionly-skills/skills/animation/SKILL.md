---
name: animation
description: Choreograph polished Motionly object animation and sequences. Use for entrances, holds, exits, keyframes, stagger, presets, scene beats, motion hierarchy, product reveals, logo stings, UI demonstrations, and replacing repetitive fade-only motion.
---

# Animation

Design motion around attention and story beats. One focal subject moves first; supporting detail follows; the completed composition holds; exits clear space for the next idea.

## Build A Beat

1. Anticipate with a small offset, mask, or contrast change.
2. Enter the focal subject over roughly `650ms–1s`.
3. Stagger support by `80–180ms`.
4. Hold long enough to read or understand.
5. Exit in `350–550ms`, usually faster than the entrance.
6. Transition only when the story actually changes.

## Production Entrance

```motion
animate panel {
  keyframes {
    0% { opacity 0 y 90 scale .94 blur 10 }
    72% { opacity 1 y -6 scale 1.01 blur 0 }
    100% { opacity 1 y 0 scale 1 blur 0 }
  }
  duration 900ms
  delay 1.2s
  easing power3.out
}
```

The small overshoot makes the settle visible without looking bouncy. Remove it for sober enterprise brands.

## Sequence Related Elements

```motion
sequence benefits {
  items icon title body
  delay 2s
  gap 120ms
}

animate icon {
  from { opacity 0 scale .8 rotation -8 }
  to { opacity 1 scale 1 rotation 0 }
  duration 700ms
  easing power3.out
  sequence benefits
}
```

Use a sequence for a semantic group, not every object in the project. Reveal logos with their labels and diagram nodes with their connecting lines.

## Preset Selection

- `softReveal`: quiet supporting content.
- `maskReveal`: hero image/video or product panel.
- `dynamicSlide`: directional support and UI cards.
- `drawSVG`: simple stroked vector hero.
- `shapeWipe`/`irisWipe`: real scene change.
- `sceneExit`: deliberate cleanup.

## Avoid Generic Motion

- Do not fade every object from opacity zero.
- Do not apply the same entrance duration/direction to every layer.
- Do not keep objects moving after the audience should read them.
- Do not stack scale, spin, blur, and bounce without a story reason.
- Do not leave stale layers visible under the next scene.

For a software launch, alternate full-frame promise, product proof, focused feature detail, and brand close. Reuse motion language, not identical choreography.
