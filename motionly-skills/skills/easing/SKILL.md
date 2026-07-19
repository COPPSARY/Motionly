---
name: easing
description: Choose and tune Motionly easing, duration, and stagger. Use when motion feels linear, abrupt, floaty, bouncy, robotic, too slow, too fast, or inconsistent, and when authoring explicit animations or preset calls.
---

# Easing

Default to `power3.out` for professional entrances: it moves decisively, then settles gently. Match easing to intent before adding more keyframes.

## Practical Map

- Hero entrance: `power3.out`, `750ms–1.1s`.
- Supporting card: `power3.out`, `550–800ms`.
- Fast exit: `power3.in`, `300–500ms`.
- Soft ambient change: `sine.inOut`, `1.5–4s`.
- Mechanical UI response: `power2.out`, `250–500ms`.
- Elastic/bounce: only when the brand explicitly calls for playfulness.

Explicit blocks use `easing`:

```motion
animate title {
  from { opacity 0 y 72 }
  to { opacity 1 y 0 }
  duration 850ms
  easing power3.out
}
```

Preset calls use `ease`:

```motion
animation "dynamicSlide(duration 700ms direction up ease power3.out)"
```

## Timing Relationships

- Make the focal entrance longer than supporting entrances.
- Keep exits about 55–70% of entrance duration.
- Use `60–100ms` character stagger, `80–160ms` word/item stagger.
- Start support after the hero is recognizable, not necessarily after it fully stops.
- Preserve at least one second of readable hold for short copy; longer copy needs more.

If motion feels sluggish, shorten distance or duration before choosing a harsher ease. If it snaps at the end, use a gentler out curve or add a restrained settle keyframe.
