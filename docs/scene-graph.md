# Scene Graph

Motionly normalizes parsed `.motion` files into a deterministic scene graph.

```text
.motion source
  -> parser
  -> AST
  -> scene graph
  -> animation preset compiler
  -> animation evaluator
  -> canvas renderer
```

## Responsibilities

The scene graph should:

- Resolve canvas settings.
- Resolve imports without mutating asset data.
- Normalize element properties.
- Normalize camera state.
- Preserve layer hierarchy.
- Expand animation presets into deterministic instructions.

The scene graph should not:

- Render pixels.
- Read hidden runtime state.
- Mutate imported assets.
- Depend on wall-clock time.

## Layers

Recommended semantic layers:

- `background`
- `hero`
- `supporting`
- `details`
- `text`
- `effects`

Layers should help the renderer and author understand visual hierarchy without turning Motionly into a complex compositor.
