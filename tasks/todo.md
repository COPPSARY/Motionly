# Editor Reliability Fixes

## Task 1: Select authored scene layers

**Acceptance criteria:**

- [x] Generated parts are excluded using AST identity, not `__` naming.
- [x] Authored identifiers containing `__` remain visible.
- [x] An active scene returns only its declared members.

**Verification:** focused selector tests and a large-list timing check.

## Task 2: Open a scene-local timeline

**Acceptance criteria:**

- [x] Selecting a storyboard scene shows its member rows.
- [x] Timeline time/frame and seek/reset are relative to the scene start.
- [x] Returning to the storyboard shows scene-root rows.

**Verification:** MotionEditor DOM integration tests.

## Task 3: Inherit active-scene membership

**Acceptance criteria:**

- [x] Added text includes `scene ACTIVE` and local start timing.
- [x] Added background, atmosphere, and surface effects include `scene ACTIVE`.

**Verification:** serialized-source integration tests.

## Task 4: Edit visible effect opacity

**Acceptance criteria:**

- [x] Inspector reads the generated effect opacity.
- [x] Changing opacity updates the `backgroundEffect` option and rendered result.

**Verification:** source and evaluated-frame integration tests.

## Task 5: Expose text-preset markers

**Acceptance criteria:**

- [x] Pure `textAnimation` presets display keyframe markers.
- [x] First marker edit materializes a source animation without collapsing fragments.

**Verification:** DOM marker and evaluated text-fragment tests.

## Task 6: Safe text placement and identifiers

**Acceptance criteria:**

- [x] Compiled child count cannot push new text off-canvas.
- [x] Authored `__` layer names appear in the timeline.

**Verification:** MotionEditor integration tests.

## Task 7: Stop playback on teardown

**Acceptance criteria:**

- [x] Unmounting during playback cancels the pending animation frame.

**Verification:** component lifecycle regression test.

## Final verification

- [x] Focused tests pass.
- [x] Full suite passes.
- [x] Type-check passes.
- [x] Build passes and bundle output is compared with the baseline.
- [x] No commit, push, or PR is created.
