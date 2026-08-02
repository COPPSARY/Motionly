# Motionly Catalog Reference

Use `npx @coppsary/motionly catalog` for the live catalog. The names below are
the authored public vocabulary in this checkout. Catalog entries validate their
options; unknown options fail with the available field list.

## Text Entrances And Exits

Use on a `text` property as `textAnimation "NAME(options)"`.

| Name | Use |
| --- | --- |
| `keynoteText` | hero line or word-masked editorial reveal |
| `wordReveal` | readable word-by-word reveal |
| `charReveal` | short energetic character treatment |
| `splitReveal` | split line/word reveal |
| `blurReveal` | short focus/rise reveal; use sparingly |
| `fadeUp` | restrained rise for support copy |
| `slideIn` | directional text entrance |
| `scaleText` | restrained scale entrance |
| `typewriter` | typed interface/code moment; usually once per film |
| `maskReveal` | clipped text/media reveal when a real edge is meaningful |
| `gradientReveal` | accent-colored text reveal |
| `countUp` | numeric value from zero; keep label stable |
| `fadeIn`, `fadeOut` | explicit whole-line opacity treatments, not default arrivals |
| `bounceIn`, `bounceOut` | compact playful entrance/exit only |
| `slideLeft`, `slideRight`, `slideUp`, `slideDown` | directional text travel |
| `zoomIn`, `zoomOut` | clean scale in/out |
| `spinIn`, `spinOut` | one controlled rotation for a logo/icon-like text moment |
| `fallDown`, `riseUp`, `driftUp` | vertical letter or line travel |
| `expand`, `concentrate` | tracking expansion/contraction |
| `roll`, `rollIn` | vertical roll; use only when the message supports it |
| `swing`, `pendulum`, `pendulumSwing` | deliberate swinging emphasis/loop |

## Text Loops And Text Transitions

Loops are finite and seek-safe, but still need a narrative reason:
`flicker`, `wave`, `jitter`, `jigglyWobble`, `rainbow`, `fontShift`, and `pulse`.

Text transitions are effects on a title state, not a substitute for scene
planning: `glitchTransition`, `blurPass`, `whiteFlash`, `blackSmoke`, `pullIn`,
`pullOut`, `slideTransition`, `splitMaskWipe`, `revolvingChecker`, `fanOut`,
`clockWipe`, `zoomLens`, `pageCurl`, `mosaicPixelate`, `neonGlowWipe`,
`verticalBlinds`, `horizontalBlinds`, `smoothScale`, `doubleCrossShift`, and
`waveWarp`.

Use a text transition only when the title is changing state. Do not stack three
text transitions or apply one to every label.

## Object And Media Moves

Core object moves: `softReveal`, `springIn`, `float`, `heroLogo`, `drawSVG`,
`scaleReveal`, `productPanel`, `cardReveal`, `buttonPop`, `progressFill`,
`productReveal`, `morph`, `rotateReveal`, `rotateOut`, `rotateScale`,
`logoSpinReveal`, `spin`, `kenBurns`, `tiltReveal`, `sceneExit`, `cascadeIn`,
`snapMove`, `popover`, `cursorTap`, `shakeReject`, `orbitDrift`, `rackFocus`,
`depthSwap`, `highlight-circle-reveal`, `animated-arrow-point`,
`callout-text-pop`, and `spotlight-mask`.

Use `mediaTour` for one screenshot with authored focus points. It is the correct
way to showcase one exact UI asset in stages without reconstructing the UI.
Use `zoomThrough` for a genuine match-cut handoff into another asset, and
`whipPan` only when a fast directional cause exists.

## Camera Moves

`slowPush`/`push` establish a restrained product push, `pan` travels across a
large composition, `pull` widens context, and `speedZoom` is one short punch.
`sceneSlide`, `sceneZoom`, `sceneWhip`, `sceneFocus`, and `scenePivot` are scene
transition recipes in the catalog, but storyboard scenes should normally use the
scene `transition` property and let the planner emit the appropriate transform.

## Transition Choice

Use the relationship first:

| Situation | Choice |
| --- | --- |
| same subject changes scale/position | `sharedElement` or a local transform |
| matched product object becomes another | `objectMorph` with endpoints |
| cards rearrange into a new arrangement | `layoutMorph` with endpoints |
| persistent frame changes attention | `cameraMove` |
| same composition continues | `continuous` |
| deliberately unrelated shot | `cut` |
| media clips overlap on one track | clip `crossfade` |

The generic object transition moves are `dynamicSlide`, `focusZoom`, `zoomThrough`,
`whipPan`, `depthSwap`, and `snapMove`. Choose one based on the visual cause;
they are not interchangeable aliases for “zoom everything.”

Transition defaults follow a compact usage scale: `.08s` micro, `.15s` quick,
`.25s` fast, `.35s` medium, `.4s` slow, and `.5s` emphasis. Ordinary object
travel is `4-30px`, ordinary scale starts at `.96-.99`, and ordinary blur is
`2-3px` (`8px` is reserved for a deliberate flash). Planned transform handoffs
use `cubic-bezier(0.22, 1, 0.36, 1)`; authored calls use `power4.out` or
`power3.out`. Scene moves may travel
far enough to cover the canvas, but scene depth should normally stay within
`.96-1.06`. Exits are shorter and quieter than entrances.

## Preset Options

Common options are `delay`, `duration`, `ease`, `easing`, `exitAt`,
`exitDuration`, `exitEase`, `exitDistance`, `exitDirection`, `split`, `stagger`, `direction`, `distance`,
`from`, `to`, `peak`, `opacity`, `blur`, `intensity`, `repeat`, `loop`,
`order`, `rotationFrom`, `rotationTo`, `xFrom`, `xPeak`, `xTo`, `xExit`,
`yFrom`, `yPeak`, `yTo`, `yExit`, `panX`, `panY`, `focusX`, `focusY`,
`focus2X`, `focus2Y`, `focus2Scale`, `focus3X`, `focus3Y`, `focus3Scale`,
`focusScale`, `siblingScale`, `siblingOpacity`, `pushX`, and `pushY`.

Use `duration` under 800ms for one entrance, shrinking support durations and
stagger gaps across a group. `power4.out` is the arrival default and
`power3.out` is the settle default. `inOut` is for a movement that genuinely
reverses direction, not an arrival.

## Catalog And Registry

`registry/**/registry-item.json` is generated discovery metadata. It records
name, category, description, keywords, schema, defaults, and example paths.
Do not edit generated manifests by hand. Change the source definition and run
`npm run registry:generate`.
