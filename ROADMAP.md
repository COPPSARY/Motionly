# Motionly Roadmap

Motionly is focused on foundation first. The goal is not a large feature list; it is a simple renderer that produces smooth, professional motion from readable scene files.

## V1 Foundation

- Keep `.motion` syntax minimal and CSS-like.
- Maintain a clear pipeline: parser -> AST -> scene graph -> animation evaluator -> renderer.
- Render every frame from deterministic scene graph state.
- Support SVG, image, text, camera, layers, preview playback, and export.
- Keep the showcase animation polished enough to prove the system.

## Near Term

- Make the showcase animation better: stronger story, clearer hierarchy, better camera movement, and more deliberate transitions.
- Fix export reliability and lag.
- Improve GIF/WebM/MP4 export options.
- Add tests around frame pacing, camera transforms, scene layers, and animation presets.
- Document the `.motion` language and preset library.

## Later

- More professional animation presets.
- More examples for product launches, logo reveals, and UI demos.
- Better editor diagnostics for invalid `.motion` files.
- Timeline inspection tools.
- Performance profiling tools.

## Not Yet

Do not add these before V1 is stable:

- AI generation.
- Cloud rendering.
- Collaboration.
- Plugins.
- 3D.
- Physics.
- Audio.
