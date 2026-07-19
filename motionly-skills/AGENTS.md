# Motionly Skills Agent Instructions

Use [`llms.txt`](llms.txt) as the discovery index. Load only skills relevant to the request instead of reading the entire library.

Always load `skills/motion-dsl/SKILL.md` before creating or repairing `.motion` syntax. Then load focused skills by intent:

- vector/logo/icon/diagram work: `svg`
- choreography or keyframes: `animation` and `easing`
- push/pan/zoom decisions: `camera`
- layout, brand, or scene review: `composition`
- text motion: `typography`
- scene changes: `transitions`
- clip/audio sequencing: `timeline`
- imported media: `assets`
- preview/export diagnosis: `rendering`
- a new brief or storyboard: `templates`

Preserve existing user work, exact copy, real asset paths, and editable timeline structure. Prefer native SVG/vector animation for logos, icons, illustrations, diagrams, badges, and UI graphics unless the user explicitly wants to preserve an imported animation. Never flatten or silently ignore animated media.

Validate against the Motionly repository's current parser, evaluator, renderer, and serializer when available. Report real browser/renderer limitations plainly.
