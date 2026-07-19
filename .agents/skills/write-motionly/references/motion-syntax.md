# Motionly Syntax And Presets

## Core Project

```motion
canvas {
  size 1920x1080
  fps 60
  duration 8s
  background #050608
}

camera {
  zoom 1
  x 0
  y 0
  rotation 0
  cameraAnimation speedZoom(delay 3s duration 1s from 1 peak 1.08 to 1.02 ease power3.out)
}
```

Use `size`, not `fontSize`. Use `easing` in explicit animation blocks. Preset calls use the option name `ease`.

## Imports And Assets

```motion
import "./assets/logo.svg" as logo
import "./assets/video.mp4" as bgVideo
import "./assets/loader.lottie" as loader

logo {
  center
  layer hero
  width 240
  x 0
  y 0
  scale 1
  rotation 0
  originX .5
  originY .5
  opacity 0
  animation maskReveal(delay 1s duration 800ms direction down exitAt 5s exitDuration 450ms ease power3.out)
}
```

Preserve aspect ratio by setting one of `width` or `height`. Useful properties include `x`, `y`, `width`, `height`, `scale`, `rotation`, `originX`, `originY`, `skewX`, `skewY`, `opacity`, `blur`, `brightness`, `contrast`, `saturation`, `hue`, `grayscale`, `sepia`, `invert`, `shadow`, `center`, `cover`, and `layer`. Transform origins are normalized from `0` to `1`.

Motionly treats PNG/JPEG, static or animated SVG, GIF, MP4, WebM, MOV/M4V, and `.lottie` as visual assets. Video, Lottie, and supported GIFs seek to project time for preview and export. Animated SVG uses a real-time Canvas SVG runtime; its internal timeline cannot be deterministically frame-seeked, and CSS keyframes may differ from browser DOM playback. Motionly reports those limitations in the editor.

Simple imported path SVGs can use editable fill/stroke overrides:

```motion
logo {
  center
  width 320
  fill #38bdf8
  stroke #ffffff
  strokeWidth 2
}
```

`fill`, `stroke`, and `strokeWidth` can appear in explicit keyframes. For a local push-in or pan, animate the SVG's own transform and origin rather than the global camera.

Adjustment values are serializable and animatable. `brightness`, `contrast`, and `saturation` are multipliers (default `1`); `hue` is degrees (default `0`); `grayscale`, `sepia`, and `invert` range from `0` to `1`; and `blur` is measured in pixels. These use deterministic Canvas 2D filters in preview and export. Chroma key is not currently supported.

## Layer Masks

Any visual layer can reuse another layer's evaluated alpha:

```motion
text matte {
  value "MASK"
  center
  size 220
}

photo {
  center
  width 900
  mask matte
  maskInvert false
  maskVisible false
}
```

`mask` stores the source layer ID, `maskInvert` uses inverse alpha, and `maskVisible` keeps the matte visible as normal artwork. Mask layers are hidden by default. Missing, self-referencing, and nested masks are rejected so preview and export remain deterministic.

Layer order: `background`, `hero`, `supporting`, `content`, `details`, `text`, `effects`.

## Audio

```motion
audio "/assets/my-project/background.mp3" {
  start 0s
}
```

Audio persists in `.motion`, plays during preview, and is included in MP4 export. It remains on the bottom audio track. Dragging it horizontally updates `start`; it does not move onto visual layers.

## Timeline Clips

Tracks are stable, persisted timeline rows. Visual tracks behave as simple layers: clips move freely in time, can overlap, and can be placed on any visual track without content compatibility rules. `role` and `content` remain serialized metadata for existing projects; they do not enable magnetic packing, ripple editing, or automatic allocation. Audio remains a bottom-only track.

```motion
track main {
  label "Main Track"
  role main
  content primary
  order 0
}

track titles {
  label "Text Overlay"
  role overlay
  content text
  hidden false
  order 1
}

track music {
  label "Music"
  role audio
  content audio
  muted false
  order 2
}
```

`hidden` suppresses a visual track without deleting it. `muted` disables track audio while retaining clip-level volume/mute. `order` persists layer order. Existing projects with numeric or synthesized tracks remain compatible and receive explicit stable assignments when edited.

```motion
import "/assets/my-project/video.mp4" as bgVideo

clip bgVideo {
  track 1
  start 0s
  duration 5s
  trimIn 0s
  trimOut 0s
  volume 1
  mute false
}
```

Timeline clips reference imported images, static/animated SVG, GIF, MP4, WebM, MOV/M4V, and Lottie assets. They appear on the timeline and can be created visually by dragging from the Assets panel. Animated frames are synchronized from `trimIn + (projectTime - start)` when the format exposes seeking.

Video limitations:

- Codec support follows the current browser (typically H.264/AAC MP4 and VP8/VP9 WebM; MOV support depends on its codec).
- Video clip audio is currently muted; use the project `audio` track for preview and exported sound.
- Two simultaneous clips referencing the same imported video cannot display different source times yet; import the file under two aliases as a workaround.
- Embedded video uploads increase `.motion` file size and are limited to 100 MB in the editor.

Properties:

- `track`: timeline track number (default 1)
- `start`: when clip starts on timeline
- `duration`: how long clip plays
- `trimIn`: source media start offset (default 0s)
- `trimOut`: source media end offset (default 0s)
- `volume`: audio volume 0-1 (optional, default 1)
- `mute`: whether to mute clip audio (optional, default false)

Clips are rendered at their natural size unless transformed. Keep original asset files in the same location for projects to reload correctly.

### Clip Transitions

Drag **Crossfade** from Effects → Clip Transitions onto the cut between two touching clips on the same track. The transition is saved on both sides of the cut:

```motion
clip outgoing {
  track 1
  start 0s
  duration 3s
  transitionOut crossfade
  transitionOutDuration 500ms
}

clip incoming {
  track 1
  start 3s
  duration 3s
  transitionIn crossfade
  transitionInDuration 500ms
}
```

The outgoing clip fades out while the incoming clip fades in. Select the transition marker on the timeline to change its duration or remove it. Paired transition properties should use the same type and duration; normal visual editing writes both sides automatically.

## Text

```motion
text title {
  value "Make it move."
  center
  layer text
  x 0
  y -40
  size 72
  weight 740
  color #ffffff
  opacity 1
  textAnimation keynoteText(split words stagger 80ms duration 750ms delay 1s ease power3.out exitAt 4s exitDuration 450ms)
}
```

Supported text presets:

- `keynoteText`
- `wordReveal`
- `charReveal`
- `splitReveal`
- `blurReveal`
- `fadeUp`
- `slideIn`
- `scaleText`
- `typewriter`
- `maskReveal`
- `gradientReveal`

Common options: `split`, `stagger`, `delay`, `duration`, `ease`, `exitAt`, `exitDuration`.

## Image Layers And Vector Overlays

Use an `image` layer when vector annotations must stay attached to a static picture. `source` names an imported bitmap. An `overlay` with `parent` uses the source image's intrinsic pixel coordinate system, so `x`, `y`, `x2`, `y2`, radii, and path coordinates continue to line up when the image is resized, centered, rotated, or animated.

```motion
import "./assets/dashboard.png" as dashboardPng

image dashboard {
  source dashboardPng
  center
  layer content
  width 1400
  opacity 1
}

overlay focusRing {
  parent dashboard
  shape circle
  x 1060
  y 310
  radius 92
  fill none
  stroke #7cf7c5
  strokeWidth 10
  opacity 1
  animation highlight-circle-reveal(delay 800ms duration 900ms ease power3.out)
}

overlay pointer {
  parent dashboard
  shape arrow
  x 760
  y 470
  x2 230
  y2 -120
  fill none
  stroke #ffffff
  strokeWidth 8
  opacity 1
  animation animated-arrow-point(delay 1.3s duration 700ms ease power3.out)
}

overlay label {
  parent dashboard
  shape text
  x 650
  y 520
  value "Review this trend"
  fill #ffffff
  font "Inter, sans-serif"
  size 46
  weight 700
  opacity 1
  animation callout-text-pop(delay 1.5s duration 650ms ease power3.out)
}

overlay spotlight {
  parent dashboard
  shape spotlight
  x 1060
  y 310
  radiusX 150
  radiusY 110
  fill rgba(0,0,0,.58)
  opacity 1
  clip
  animation spotlight-mask(delay 2.4s duration 800ms ease power3.out)
}
```

Supported shapes are `circle`, `ellipse`, `rect`, `line`, `arrow`, `path`, `text`, and `spotlight`. For `path`, set `path` to SVG `d` data. `clip` confines a sublayer to the image. All overlay properties use the normal `animate` blocks and keyframes; overlays also follow their parent's evaluated visibility and transform.

Starter presets:

- `highlight-circle-reveal`: draws a circle/ellipse stroke around the target.
- `animated-arrow-point`: draws an arrow toward the target.
- `callout-text-pop`: reveals a vector callout with a restrained scale and rise.
- `spotlight-mask`: opens an elliptical cutout in a dimming mask.

Motionly uses native SVG-compatible path data with Canvas2D rendering, not ThorVG. This avoids adding a WASM runtime and guarantees the same JS-evaluated frame in preview and export. The tradeoff is that advanced SVG filters and full SMIL semantics are not supported; convert those effects to ordinary Motionly properties or a pre-rendered asset.

## Scene Backgrounds

```motion
overlay nextScene {
  layer background
  fill #09111d
  opacity 0
  animation shapeWipe(delay 4s duration 800ms direction right ease power3.out)
}

overlay atmosphere {
  layer background
  opacity 0
  backgroundEffect aurora(duration 8s opacity .18 intensity .55)
}
```

Background effects currently include `gradientMotion`, `noise`, `grid`, `aurora`, `prism`, `rippleGrid`, `ripple-grid`, and `particles`. Keep opacity restrained behind copy.

## Object Presets

Preferred production set:

- `softReveal`: subtle opacity, position, scale, and optional blur.
- `maskReveal`: directional clipped reveal; suitable for media.
- `dynamicSlide`: directional slide with settle and optional exit.
- `shapeWipe`: directional full-scene transition.
- `irisWipe`: circular full-scene transition.
- `drawSVG`: path progress for simple stroked SVGs only.
- `heroLogo`, `productPanel`, `rotateReveal`, `scaleReveal`: use selectively.

Other supported object presets include `sceneExit`, `springIn`, `bounceIn`, `float`, `pulse`, `morph`, `productReveal`, `appleHero`, and `startupLaunch`. Prefer the restrained set unless the brief calls for a different motion character.

Example supporting asset:

```motion
icon {
  center
  layer supporting
  width 160
  x 320
  y 80
  opacity 0
  animation dynamicSlide(delay 2s duration 700ms direction up distance 90 exitAt 5s exitDuration 450ms ease power3.out)
}
```

Directions are `left`, `right`, `up`, and `down`.

## Camera Presets

- `slowPush` or `push`: restrained zoom over a shot.
- `pan`: horizontal camera movement.
- `pull`: settle from a closer view.
- `speedZoom`: short punch with `from`, `peak`, and `to` zoom values.

Camera movement affects every visible layer. Use it only when the composition has enough safe space.

## Explicit Animation

```motion
animate title {
  from {
    opacity 0
    y 80
    blur 10
  }

  to {
    opacity 1
    y 0
    blur 0
  }

  duration 1s
  delay 0s
  easing power3.out
}
```

Keyframes use percentage offsets:

```motion
animate fade {
  keyframes {
    0% { opacity 1 }
    2% { opacity 0 }
    98% { opacity 0 }
    100% { opacity 1 }
  }
  duration 8s
  easing power3.out
}
```

## Timing Pattern

For a shot from `8s` to `14s`:

- Start scene transition around `7.8s`.
- Reveal hero around `8.1s` for `800ms`.
- Reveal supporting copy around `8.7s`.
- Hold the complete composition long enough to read.
- Start exits around `13.5s` for `400ms` to `550ms`.
- Begin the next transition only after the focal content clears or intentionally covers it.

For narration, supplied timestamps override this pattern.
