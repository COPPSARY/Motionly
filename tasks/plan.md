# Implementation Plan: Editor Timeline and Effect Reliability

## Overview

Fix the seven editor defects listed in the supplied audit while preserving the existing issue-62 work. Storyboard timelines will use authored scene membership and local time, effect controls will edit the visible generated effect, text presets will expose editable markers, text insertion will stay on-canvas, authored names containing `__` will remain visible, and playback will stop cleanly on teardown.

## Architecture Decisions

- Derive authored editor layers from AST element names instead of naming conventions. This distinguishes generated parts without rejecting valid authored identifiers.
- Keep timeline filtering linear-time with precomputed `Set` membership and retain the existing cached global timeline-range index.
- Treat the authored background-effect overlay as the editor handle, but read visible values from its generated effect and write effect options back into `backgroundEffect`.
- Use scene-local display time only while a scene timeline is open; convert at the UI boundary so the renderer continues using project-global time.

## Task List

### Phase 1: Storyboard timeline foundation

- [x] Task 1: Add tested authored-layer and scene-member timeline selectors.
- [x] Task 2: Scope storyboard timelines and playhead display to the selected scene.
- [x] Task 3: Assign newly created text/effect layers to the selected scene.

### Checkpoint: Storyboard behavior

- [x] Focused timeline and MotionEditor integration tests pass.
- [x] Large-list selector benchmark remains linear-time.

### Phase 2: Editor correctness

- [x] Task 4: Route effect opacity reads/writes to the visible preset effect.
- [x] Task 5: Surface and materialize text-preset keyframes from generated fragments.
- [x] Task 6: Keep new text placement on-canvas and preserve authored `__` identifiers.
- [x] Task 7: Cancel playback animation frames during component cleanup.

### Checkpoint: Complete

- [x] Focused regressions pass.
- [x] Full test suite and type-check pass.
- [x] Production build succeeds without a material bundle-size regression.
- [x] Diff and requirement-by-requirement audit are clean.

## Risks and Mitigations

| Risk                                                       | Impact | Mitigation                                                                                  |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Local timeline coordinates leak into global renderer state | High   | Centralize local/global conversion and cover seek/reset/keyframes with integration tests.   |
| Generated-element lookup becomes quadratic                 | Medium | Build sets/maps once per reactive update and benchmark a large fixture.                     |
| Effect option editing rewrites unrelated preset options    | Medium | Patch only the requested option and test preservation of duration/name.                     |
| Existing dirty work is overwritten                         | High   | Make surgical patches and inspect the final diff; do not reset or reformat unrelated files. |

## Open Questions

- None. The pasted audit and project scene doctrine provide sufficient acceptance criteria.
