---
name: scenes
description: Plan and author connected Motionly storyboard scenes and beats. Use for shot planning, scene ownership, shared identities, lifecycle, boundary transitions, scene audit findings, stale layers, and continuous product-film pacing.
---

# Scenes

Read [authoring-contract.md](../../references/authoring-contract.md) and
[production-checklist.md](../../references/production-checklist.md).

Motionly scenes are storyboard ownership, not automatic slides. Plan the story,
then the layout and components, then continuity, then animation.

```motion
scene promise { label "Promise" duration 3s background #080b12 clear transition cut }
scene proof {
  label "Proof"
  duration 6s
  transition sharedElement
  transitionDuration 700ms
}

text markA { scene promise identity brand value "Motionly" center size 80 }
text markB { scene proof identity brand value "Motionly" size 32 x -760 y -430 }
```

## Rules

- Every storyboard object declares `scene NAME`.
- Omit `start` for back-to-back scenes; timing inside content is scene-local.
- Use `clear` only when the outgoing scene must close its remaining members.
- Pair recurring subjects by `identity`; the same name also pairs by default.
- At every boundary classify each item as shared, enter, or exit.
- Shared subjects transform; new subjects arrive as a wave; genuine exits leave deliberately.
- There is no scene fade. Boundary kinds are `sharedElement`, `cameraMove`, `continuous`, and `cut`.
- Prefer beats for focus changes inside one persistent composition; beats do not clear.

Scene properties: `label`, `duration`, `start`, `background`, `zoom`, `cameraX`,
`cameraY`, `transition`, `transitionDuration`, `easing`, and `clear`.

Beat properties: `start`, `duration`, `focus`, `zoom`, `cameraX`, `cameraY`,
`transition`, `from`, `to`, `transitionDuration`, `easing`, `route`, and `label`.
Routes are `stagedReveals`, `cameraIntent`, `uiLife`, `sequence`, `cursorLed`,
and `hold`.

Validate with:

```bash
npm run inspect:motion -- project.motion --strict
```

Fix `scene-orphan`, `scene-gap`, `scene-overlap`, `scene-still`, and
`scene-discontinuity`; do not silence them without a visual reason.
