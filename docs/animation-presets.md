# Animation Presets

Animation presets encode professional motion decisions behind simple names.

Authors should be able to describe intent:

```motion
text title {
  value "Built with Codex"
  textAnimation splitReveal(split words stagger 80ms duration 1.2s)
}
```

Instead of manually defining every opacity, position, blur, and scale keyframe.

## Current Preset Areas

- Text reveals.
- Logo/object entrances.
- Camera pushes and pulls.
- Background atmosphere.
- Product-style panels.
- Scene exits.

## Design Rules

- Presets must generate deterministic timeline instructions.
- Presets should avoid random motion.
- Presets should not make every element move at once.
- Presets should support hierarchy: one hero object, supporting content, and background atmosphere.
- Fade can support motion, but should not replace motion.

## Quality Bar

Good presets feel:

- smooth
- subtle
- confident
- premium
- readable

Avoid:

- excessive blur
- bouncing
- cartoon timing
- random effects
- repeated logo entrances
