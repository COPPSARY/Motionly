# Architecture

```text
composition.html + scoped CSS
              + timeline.js / GSAP
                         ↓
          thin CompositionDefinition adapter
                         ↓
                CompositionRuntime
                 ├─ preview controls
                 ├─ element selection and overrides
                 └─ frame export
```

The HTML template is the authored visual composition. `timeline.js` receives the root, paused master timeline, and element-registration function, then adds nested or overlapping tweens. `CompositionDefinition.build()` is only the adapter that clones the template and invokes that timeline builder.

Do not add a DSL, parser, JSON scene representation, generated DOM layer, or a second renderer. The browser DOM and caller-owned GSAP timeline are the source used by both preview and export.

The runtime quantizes explicit seeks to composition frames. Playback delegates to GSAP. Scene state is derived from the current time and scene metadata. Visual overrides are reapplied after timeline evaluation.

Export seeks and captures the same mounted composition used by preview. This keeps text, SVG, transforms, media, and GSAP state deterministic between the editor and rendered frames.
