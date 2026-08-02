---
name: motion-dsl
description: Author, repair, validate, and explain editable Motionly .motion source. Use for parser syntax, canvas, imports, scenes, beats, layouts, showcases, components, clips, tracks, audio, animations, keyframes, presets, and serialization errors.
---

# Motion DSL

Read [authoring-contract.md](../../references/authoring-contract.md) before
writing source. Read [motion-catalog.md](../../references/motion-catalog.md)
before choosing a preset. The parser and serializer are authoritative.

## Order

1. Set canvas size, FPS, duration, background, and audio policy.
2. Inventory and import real assets using stable single-word aliases.
3. Plan scenes or beats before content.
4. Choose layouts, showcases, and semantic components before primitives.
5. Add identities and boundary relationships.
6. Add presets or explicit animations.
7. Parse, serialize, parse, inspect, and preview representative frames.

## Valid Surface

Use `canvas`, `camera`, `import`, `track`, `clip`, `audio`, `scene`, `beat`,
`layout`, `showcase`, `component`, `text`, `overlay`, `effect`, `group`, `path`,
`svgpart`, `image`, imported aliases, `sequence`, `animate`, and `keyframes`.
Do not invent `rect`, `video`, HTML, CSS, or arbitrary layer blocks.

```motion
canvas { size 1920x1080 fps 60 duration 8s background #07090f }
import "./assets/product.png" as product

text title {
  value "A clear product promise."
  center
  size 112
  color #ffffff
  textAnimation "keynoteText(split words stagger 80ms duration 850ms)"
}

animate title {
  from { y 80 opacity 1 }
  to { y 0 opacity 1 }
  duration 620ms
  easing power4.out
}
```

Use `size`, never `fontSize`; use `easing` on explicit animations and `ease`
inside preset calls. `delay` offsets animation time; it does not retime a clip.
Use `start`/`duration` for visibility windows and `clip` for media timing.

## Repair Rules

- Preserve exact copy, imports, tracks, masks, keyframes, and unrelated user work.
- Confirm every animation target, asset alias, scene, beat, parent, and identity exists.
- Keep media proportions by setting one of `width` or `height`.
- Do not leave stale elements visible at a handoff; use a real exit or `clear`.
- Do not use scene `transitionIn`/`transitionOut`; those properties belong to clips.
- Run `npm run inspect:motion -- project.motion --strict` after every repair.

Full grammar, property meanings, component contracts, scene lifecycle, clip
syntax, and limitations are in the linked authoring contract.
