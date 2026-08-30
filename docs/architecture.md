# Architecture

```text
CompositionDefinition
  ├─ scene metadata
  ├─ HTML / SVG construction
  └─ GSAP timeline choreography
             ↓
      CompositionRuntime
       ├─ preview controls
       ├─ element selection and overrides
       └─ frame export
```

`CompositionDefinition.build()` receives a root element, a paused master timeline, and an element-registration function. It creates visual nodes and adds nested or overlapping tweens to the timeline.

The runtime quantizes explicit seeks to composition frames. Playback delegates to GSAP. Scene state is derived from the current time and typed scene metadata. Visual overrides are reapplied after timeline evaluation.

Export clones the current mounted frame, inlines computed styles, wraps it in an SVG foreign object, and rasterizes that frame to canvas. This keeps export tied to the same DOM and timeline state as preview.
