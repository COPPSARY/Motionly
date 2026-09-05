# Digit Flip & Roll Transitions

Two ways to animate a digit changing. Both are driven by the frame (deterministic) so they render identically every time — no CSS transition clock that the renderer can disagree with.

Pick by tone:

| Effect | Feel | Best for |
|---|---|---|
| Odometer reel | smooth, continuous glide | launch countdowns, premium/minimal timers |
| Flip card | mechanical "snap", split-flap board | sale urgency, retro/airport-board style |

## Shared idea

A single displayed digit is a stack of glyphs `0..9` laid out vertically. Showing digit `d` means translating the stack so glyph `d` sits in the window: `translateY(-d × digitHeight)`. Animate the *offset*, not the text, and you get a roll. The trick for a countdown is that the offset is continuous: between whole seconds the digit eases from its old value toward its new one.

## Odometer reel (Remotion, frame-driven)

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

const DIGIT_H = 160; // px per glyph
const ROLL_FRAMES = 12; // how long a single digit roll takes

// Animated single digit: rolls from `prev` to `value` over the last ROLL_FRAMES
// of the current second.
const Reel: React.FC<{ value: number; prev: number; secondProgress: number }> = ({
  value,
  prev,
  secondProgress,
}) => {
  // secondProgress: 0→1 across the current whole second.
  // Start the roll near the end of the second so the number "settles" on change.
  const t = interpolate(secondProgress, [0.7, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  // continuous position between prev and value
  const shown = prev + (value - prev) * t;
  const offset = -shown * DIGIT_H;

  return (
    <div style={{ height: DIGIT_H, width: 110, overflow: "hidden", position: "relative" }}>
      <div style={{ transform: `translateY(${offset}px)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <div
            key={n}
            style={{
              height: DIGIT_H,
              lineHeight: `${DIGIT_H}px`,
              textAlign: "center",
              fontSize: 140,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};

// Renders an mm:ss reel where each digit rolls.
export const ReelClock: React.FC<{ durationInSeconds: number }> = ({ durationInSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const elapsed = frame / fps;
  const remaining = Math.max(0, Math.ceil(durationInSeconds - elapsed));
  const prevRemaining = Math.max(0, remaining + 1); // value one second ago
  const secondProgress = elapsed % 1; // 0→1 within the current second

  const digits = (s: number) =>
    [Math.floor(s / 600) % 10, Math.floor(s / 60) % 10, Math.floor(s / 10) % 10, s % 10];

  const cur = digits(remaining);
  const prev = digits(prevRemaining);

  return (
    <div style={{ display: "flex", gap: 8, color: "#fff", background: "#0b0d17", padding: 40 }}>
      {cur.map((d, i) => (
        <React.Fragment key={i}>
          {i === 2 && <div style={{ fontSize: 140, fontWeight: 800 }}>:</div>}
          <Reel value={d} prev={prev[i]} secondProgress={secondProgress} />
        </React.Fragment>
      ))}
    </div>
  );
};
```

Notes:
- Each digit only rolls when it actually changes; a digit whose `prev === value` sits still because `shown` stays constant.
- A `9 → 0` rollover rolls *backward* through the strip (the cheap-looking part). To make tens/units roll the natural way on a carry, render an extra `0` glyph below the `9` and clamp — covered as an exercise; for most timers the backward roll at the tens boundary is unnoticeable at speed.
- `ROLL_FRAMES` is unused above because the roll is tied to `secondProgress`; expose it instead if a fixed-length roll is preferred.

## Flip card (split-flap)

The top half of the old digit folds down over a static bottom half, revealing the new digit. Pure CSS keyframe version — fine for a live web page; for Remotion, drive the `rotateX` off `secondProgress` the same way as the reel so it stays deterministic.

```css
.flip { position: relative; width: 110px; height: 160px; perspective: 600px; }
.flip .card {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 140px; font-weight: 800; font-variant-numeric: tabular-nums;
  backface-visibility: hidden;
}
.flip .top    { clip-path: inset(0 0 50% 0); transform-origin: bottom; }
.flip .bottom { clip-path: inset(50% 0 0 0); }
/* on change, animate the leaf folding down */
.flip .leaf {
  position: absolute; inset: 0; transform-origin: bottom;
  animation: fold .45s cubic-bezier(.36,0,.66,-0.2) forwards;
}
@keyframes fold {
  0%   { transform: rotateX(0deg); }
  100% { transform: rotateX(-90deg); }
}
```

```js
// swap the digit and replay the fold whenever the value changes
function setFlip(el, newDigit) {
  if (el.dataset.v === String(newDigit)) return; // no change → no flip
  el.dataset.v = String(newDigit);
  el.querySelector(".top").textContent = newDigit;
  el.querySelector(".bottom").textContent = newDigit;
  const leaf = el.querySelector(".leaf");
  leaf.textContent = newDigit;
  leaf.style.animation = "none";
  void leaf.offsetWidth;            // reflow → restart the animation
  leaf.style.animation = "";
}
```

Drive `setFlip` from the same `requestAnimationFrame` + `performance.now()` loop in the cookbook (only call it when the displayed second changes), so the flips fire on real time and never drift.

## Choosing

- **Launch / premium:** odometer reel, slow ease, large tabular digits, muted palette.
- **Flash sale:** flip card for the mechanical urgency, or reel with a faster roll and a hot accent color on `mm:ss`.
- **Stream "starting soon":** either works, but keep it calm — a single reel on `mm:ss` reads better than a busy split-flap for a 5–10 minute hold.
