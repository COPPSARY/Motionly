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

logo {
  center
  layer hero
  width 240
  x 0
  y 0
  scale 1
  rotation 0
  opacity 0
  animation maskReveal(delay 1s duration 800ms direction down exitAt 5s exitDuration 450ms ease power3.out)
}
```

Preserve aspect ratio by setting one of `width` or `height`. Useful properties include `x`, `y`, `width`, `height`, `scale`, `rotation`, `opacity`, `blur`, `brightness`, `shadow`, `center`, `cover`, and `layer`.

Layer order: `background`, `hero`, `supporting`, `content`, `details`, `text`, `effects`.

## Audio

```motion
audio "/assets/my-project/background.mp3"
```

Audio files persist in `.motion` format and play during preview. Audio is not yet included in MP4 export.

## Timeline Clips

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

Timeline clips reference imported assets (images, SVGs, videos). They appear on the timeline and can be created visually by dragging from the Assets panel.

Properties:
- `track`: timeline track number (default 1)
- `start`: when clip starts on timeline
- `duration`: how long clip plays
- `trimIn`: source media start offset (default 0s)
- `trimOut`: source media end offset (default 0s)
- `volume`: audio volume 0-1 (optional, default 1)
- `mute`: whether to mute clip audio (optional, default false)

Clips are rendered at their natural size unless transformed. Keep original asset files in the same location for projects to reload correctly.

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
