---
name: motion-system
description: Use Motionly beats, layouts, showcases, asset intelligence, and planned transitions to compose professional product films without hand-placing disposable geometry.
---

# Motion System

Read [authoring-contract.md](../../references/authoring-contract.md) for exact
syntax and [motion-catalog.md](../../references/motion-catalog.md) for available
moves. This layer is the planning surface above ordinary renderer elements.

## Selection Order

1. `beat` for pacing and focus.
2. `layout` for spacing, alignment, and hierarchy.
3. `showcase` for one real screenshot/video presentation.
4. `component` for recognizable UI.
5. primitives only for artwork the registry cannot express.

Layouts resolve positions on an 8px rhythm and generate focal/support entrance
weights. Showcases generate device/window geometry, media crop, chrome, shadow,
highlight, and optional camera behavior. Nothing needs to be installed; blocks
compile into editable ordinary elements.

## Layouts

`verticalStack`, `horizontalStack`, `grid`, `centerLayout`, `heroLayout`,
`splitLayout`, `dashboardLayout`, `cardGrid`, `bentoGrid`, `featureGrid`,
`masonryGrid`, `deviceStack`, `logoWall`, `comparisonLayout`, `timelineLayout`,
`carousel`, `gallery`, and `floatingCollage`.

Use `columns`, `gap`, `width`, `height`, `itemWidth`, `itemHeight`, `order`,
`stagger`, `delay`, `beat`, and `parent`. Children declare `parent NAME`.

## Showcases

`productHero`, `phoneShowcase`, `browserShowcase`, `laptopShowcase`, `appWindow`,
`dashboardShowcase`, `screenshotPresentation`, and `uiWalkthrough`.

Use `media ALIAS`, `headline`, `caption`, `label`, `width`, `accent`, `surface`,
`focusX`, `focusY`, `beat`, `parent`, `delay`, and `duration`. Behaviors are
`still`, `push`, `perspective`, `tour`, `highlight`, and `float`.

Use the exact screenshot/video as the media source. For staged product proof,
prefer a showcase or `mediaTour` over recreating the UI from approximate cards.

## Beats And Transitions

Beats use routes `stagedReveals`, `cameraIntent`, `uiLife`, `sequence`,
`cursorLed`, and `hold`. Transition kinds are `sharedElement`, `objectMorph`,
`layoutMorph`, `cameraMove`, `continuous`, and `cut`. Paired kinds require
declared `from` and `to` endpoints.

Do not default to fade out/in, global camera drift, or the same zoom on every
asset. Choose movement from the relationship between the shots.

Implementation: `src/motion-system/`; lowering: `src/semantic/motion-lowering.ts`.
Use the catalog and registry examples before reading implementation details.
