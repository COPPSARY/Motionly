---
name: easing
description: Choose Motionly easing, duration, stagger, anticipation, and settle timing for natural professional motion. Use when animation feels robotic, slow, bouncy, repetitive, or mistimed.
---

# Easing

Use `power4.out` for arrivals, `power3.out` for settling, and `power2.in` or
`power3.in` for decisive exits. Use `sine.inOut` for a camera path or reversible
travel. Use `linear` for true loops such as a constant rotation. Avoid `inOut`
on entrances and avoid spring/elastic for polished SaaS UI unless playful motion
is intentional.

One entrance: 0.4-0.8s. Focal subject: roughly 64px travel over 620ms. Support:
roughly 40px over 460ms. A group lands within 500ms with shrinking stagger gaps.
Exits are usually shorter than arrivals. Hold 300-750ms after a meaningful action
before its result.

Preset syntax uses `ease`; explicit blocks use `easing`:

```motion
text title { textAnimation "wordReveal(split words stagger 70ms duration 760ms ease power4.out)" }
animate panel {
  from { y 60 scale .96 }
  to { y 0 scale 1 }
  duration 620ms
  easing power3.out
}
```

If motion feels generic, change the route or composition before changing the
curve. Easing cannot fix a stale layer, wrong focal subject, bad spacing, or a
transition with no object relationship.
