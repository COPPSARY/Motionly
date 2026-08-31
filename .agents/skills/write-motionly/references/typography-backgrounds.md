# Typography and background systems

## One thought, one hierarchy

Set one complete sentence at the dominant editorial size. Highlight a phrase within it by color, weight, or motion instead of demoting the rest into a subtitle.

Do not use oversized title plus microcopy, eyebrow + headline + body for one spoken line, stacked cards carrying sentence fragments, or unreadable secondary text. Secondary labels are valid only when they belong to a real interface, metric, source, or CTA.

## Split-text integrity

- Split after fonts load and dimensions are measurable.
- Make word spans `inline-block` while preserving whitespace inline.
- Keep punctuation with its word.
- Set stable width or `white-space` behavior before animation.
- Avoid letter-spacing or width changes that cause collisions.
- Reuse existing split spans; do not split them into overlapping copies.
- Test the longest sentence at the target aspect ratio.

## Continuous gradients

For split words, map every word to the parent sentence coordinates: measure the full width, share one gradient and background size, and offset each word by its position. Never restart `0% -> 100%` independently on every word.

## Select text motion by purpose

- Giant-to-settle: hooks, turns, and final promises.
- Word slide/rotate: conversational editorial lines.
- Character spring: short tactile objections or confirmations.
- 3D reveal: structured statements and typed content.
- Gradient sweep: one keyword or payoff, not every sentence.

Stagger in reading order and leave time after the last word for the full sentence to be read.

## Background hierarchy

1. Base: solid or softly graded field with text contrast.
2. Structure: faint grid, lines, or texture.
3. Ambient: slow aurora, waves, or light drift.
4. Semantic accent: rings, arrows, scans, ripples, or particles tied to the idea.

Keep the semantic accent behind the subject. Lower contrast, opacity, sharpness, and speed when text arrives. During holds, use long `sine.inOut` motion with small travel. Continuous motion should reward attention, not demand it. Vary axes and periods; do not pulse every layer in sync.

## Stability

- Lock counters to fixed or tabular width.
- Constrain fixed-format stages explicitly.
- Keep settled text inside title-safe bounds.
- Giant entrances may crop; settled text may not.
- Remove obsolete clipping masks.
- Ensure filters sharpen fully at the readable state.
