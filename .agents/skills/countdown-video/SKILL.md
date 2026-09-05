---
name: countdown-video
description: This skill should be used when the user asks to "make a countdown timer video", "create a countdown animation", "build a stream starting soon countdown", "do an event/launch/sale countdown", "animate a mm:ss or dd:hh:mm:ss timer", "add digit roll/flip transitions to a counter", or "loop a countdown background". Covers frame-accurate (drift-free) timers, digit flip/roll motion, time formatting, and a configurable duration prop.
version: 0.1.0
---

# Countdown Video

Make a countdown that ends exactly when it should. The whole craft is one idea: derive the remaining time from the frame (or a monotonic timestamp), then format and animate that number — never count down with a `setInterval`. Covers livestream "starting soon" screens, launch/sale countdowns, and looping backgrounds.

## When to use

- "Starting soon" / "be right back" livestream screens with a 5–10 min timer.
- Launch and flash-sale countdowns (dd:hh:mm:ss down to a target date; mm:ss for urgency).
- Any animated counter where the number must land on zero on the exact frame.

## The one rule: drive the number from the clock, never a tick

A `setInterval(fn, 1000)` countdown **drifts** — the callback fires *at least* 1000 ms later, never exactly, and stacks up when the tab is throttled or a render frame is slow. Reports of ~1 second lost per minute are common. The fix is the same for rendered video and live web: compute remaining time as a pure function of an authoritative clock, so a late frame self-corrects on the next frame instead of accumulating error.

| Context | Authoritative clock | Remaining time |
|---|---|---|
| Remotion render | `useCurrentFrame()` | `total − frame/fps` |
| Web (live page) | `performance.now()` or `Date.now()` | `targetMs − now` |
| To a fixed date | `Date.now()` | `targetTimestamp − Date.now()` |

Never store remaining time in state and decrement it. Recompute it every frame.

## Frame-accurate countdown (Remotion → MP4)

`useCurrentFrame()` is deterministic: frame N is always rendered at exactly `N/fps` seconds. Subtract from the total and the timer is drift-free by construction.

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";

export const Countdown: React.FC<{ durationInSeconds: number }> = ({
  durationInSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // remaining seconds, clamped at 0 — ceil so "1" shows for its full second
  const elapsed = frame / fps;
  const remaining = Math.max(0, Math.ceil(durationInSeconds - elapsed));

  return <div style={{ fontVariantNumeric: "tabular-nums" }}>{formatMMSS(remaining)}</div>;
};
```

`durationInSeconds` is a **prop**, not a constant — the same composition renders a 5-minute stream timer or a 30-second sale timer by changing one input. Set the composition's `durationInFrames` to `durationInSeconds * fps` so the video is exactly as long as the countdown.

## Web timer (live page, requestAnimationFrame)

For a live page, drive an rAF loop from `performance.now()` and only repaint when the displayed second changes (no work 60×/sec for a 1 Hz number):

```js
const start = performance.now();
let lastShown = -1;
function tick(now) {
  const remaining = Math.max(0, Math.ceil(duration - (now - start) / 1000));
  if (remaining !== lastShown) { render(remaining); lastShown = remaining; }
  if (remaining > 0) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

Counting down to a fixed date is the same idea with `Date.now()`: `Math.max(0, target - Date.now())`. See `references/countdown-cookbook.md` for the full date-target version with timezone handling.

## Time formatting

Break a remaining-seconds integer into fields with division + modulo, then zero-pad. Pick the format to fit the duration — never show `00d 00h 05m` when minutes is all that matters.

```js
const pad = (n) => String(n).padStart(2, "0");
const formatMMSS = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const formatDHMS = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(sec)}`;
};
```

| Format | Use | Drop fields when |
|---|---|---|
| `mm:ss` | stream "starting soon", short timers (<1h) | — |
| `hh:mm:ss` | flash sale, same-day event | hide `dd` while 0 |
| `dd:hh:mm:ss` | launch / multi-day countdown | hide leading 0 units for cleaner read |

Always set `font-variant-numeric: tabular-nums` (or a monospace digit font) so digits keep equal width and the layout does not jitter as numbers change.

## Digit roll / flip transitions

A flat number swap reads as cheap; the rolling "odometer" look sells the countdown. Render each digit as a vertical strip 0–9 and translate it by `-digit × digitHeight`. Animate the *position*, not the text content, so the change is a glide, not a pop.

```css
.reel { height: 1em; overflow: hidden; }
.reel .col { transition: transform .45s cubic-bezier(.22,1,.36,1); }
/* col holds stacked 0..9; shift by -value em */
```

In Remotion, drive the strip offset off the frame instead of a CSS transition (so it is deterministic). The flip-card style (top half folds down over the bottom) and the per-digit reel are both detailed, with runnable components, in `references/digit-flip.md`.

## Looping background

Stream screens hold for minutes, so the background must loop seamlessly. Build motion on a cycle that divides evenly into the timeline (e.g. a gradient or particle drift whose period is `loopFrames`), and read it as `frame % loopFrames` so there is no visible seam at the wrap. Keep it low-contrast and slow — the number is the subject; the background is ambience. Recipes in `references/countdown-cookbook.md`.

## Output checklist

- Remaining time recomputed from `useCurrentFrame()` / `performance.now()` every frame — no `setInterval` decrement.
- Timer hits `00:00` on the exact intended frame; `durationInFrames === durationInSeconds × fps`.
- Duration is an input prop, not a hardcoded constant.
- Digits use `tabular-nums`; layout does not shift as numbers change.
- Format matches the span (mm:ss vs dd:hh:mm:ss); leading zero units dropped when distracting.
- Background loop period divides the timeline evenly; no seam at the wrap.

## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

The countdown ships as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`, `durationInSeconds` a prop) — the timer is a pure function of `useCurrentFrame()`, never `setInterval` / `Date.now()` / `Math.random()`. Set `durationInFrames = durationInSeconds * fps`. Deliverable = `out/*.mp4` + the project. 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** The whole point is frame-accuracy, so check the *digit value* at exact frames before encoding.

```bash
# Stills at start / mid / end — WITH SHIPPED PROPS (the real duration you'll render)
npx remotion still Countdown out/f-start.png --frame=0   --props='{"durationInSeconds":300}'
npx remotion still Countdown out/f-mid.png   --frame=N   --props='{"durationInSeconds":300}'
npx remotion still Countdown out/f-end.png   --frame=L   --props='{"durationInSeconds":300}'  # L = durationInFrames-1

# Inspect each PNG — the digits must read EXACTLY the frame/fps math:
#  - at frame N, displayed = ceil(durationInSeconds - N/fps)  (e.g. 300s @ 30fps, frame 4500 → 150s → "02:30")
#  - last frame reads 00:00 (or the end-state hold); no drift, no off-by-one second
#  - tabular-nums: layout does not jitter between frames
#  - 9:16 safe area: the timer + brand block sit clear of top ~12% and bottom ~20-35% UI and the right action rail

npx remotion render Countdown out/countdown.mp4 --props='{"durationInSeconds":300}'   # encode once digits verify
npx remotion render Countdown out/demo.gif --codec=gif                                 # README proof clip
```

Use `npx remotion compositions` to confirm `durationInFrames`/`fps`, then compute the frame for any second you want to check.

**Before you finish:**
1. Stills render cleanly at frame 0, mid, and last — no errors.
2. The digit value at frame N equals `ceil(durationInSeconds - N/fps)` exactly; last frame hits 00:00 on the intended frame (no drift / off-by-one).
3. Timer + brand stay inside the 9:16 safe area at every checked frame.
4. Frame-driven only — no `setInterval` / `Date.now()` / timers; `tabular-nums` so layout holds.
5. Shipped `durationInSeconds` (not just `defaultProps`) renders correctly; MP4 encoded, GIF optional.

## Reference files

- `references/countdown-cookbook.md` — complete runnable Remotion `<Countdown>` (configurable duration, mm:ss / dd:hh:mm:ss, end-state hold), the count-down-to-a-fixed-date web component with timezone handling, a "starting soon" stream-screen layout (brand block + social handles + looping gradient background), and the seamless-loop background pattern.
- `references/digit-flip.md` — two deterministic digit-animation components: the odometer reel (vertical 0–9 strip driven by frame) and the flip-card (top-half fold) effect, plus when each suits launch vs sale vs stream.
