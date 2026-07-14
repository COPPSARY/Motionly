# Motion Language Reference

`.motion` is Motionly's source format. The editor should create and update it visually, but agents and contributors need to keep the syntax clean.

## Canvas

```motion
canvas {
  size 1920x1080
  fps 60
  duration 5s
  background #020308
}
```

## Text

```motion
text title {
  value "Motion graphics"
  center
  x 0
  y 0
  size 72
  color #ffffff
  opacity 1
}
```

Use `size`, not `fontSize`.

## Asset

```motion
import "./assets/logo.svg" as logo

logo {
  center
  width 240
  opacity 1
}
```

## Animation

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

  duration 1.2s
  delay 0s
  easing power3.out
}
```

Use `easing`, not `ease`.

## Useful Properties

- `x`
- `y`
- `width`
- `height`
- `scale`
- `rotation`
- `opacity`
- `blur`
- `brightness`
- `shadow`
- `size`
- `color`
- `center`
- `layer`

## Easing

Preferred:

- `power3.out`
- `smooth`
- `soft`
- `ease-out`
- `linear`

## Product Rule

Do not make `.motion` authoring the main user workflow. Keep it readable because it is the source of truth, but build UI controls first.
