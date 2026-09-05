# Countdown Cookbook

Complete, runnable recipes. Every value is derived from an authoritative clock (frame or timestamp) so nothing drifts.

## 1. Configurable Remotion countdown (mm:ss + dd:hh:mm:ss)

A single composition that handles any duration and either format. Drop into `src/Countdown.tsx`.

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

const pad = (n: number) => String(n).padStart(2, "0");

const formatTime = (totalSeconds: number, mode: "mm:ss" | "dd:hh:mm:ss") => {
  const s = Math.max(0, totalSeconds);
  if (mode === "mm:ss") {
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  // drop leading day field once it is zero, for a cleaner read
  return d > 0
    ? `${pad(d)}d ${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

export type CountdownProps = {
  durationInSeconds: number;
  format?: "mm:ss" | "dd:hh:mm:ss";
  label?: string;
};

export const Countdown: React.FC<CountdownProps> = ({
  durationInSeconds,
  format = "mm:ss",
  label = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ceil so the last whole second ("1") is shown for its full duration,
  // and the display reaches "0" exactly on the final frame.
  const remaining = Math.max(0, Math.ceil(durationInSeconds - frame / fps));
  const ended = remaining === 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "#0b0d17",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {label && (
        <div style={{ fontSize: 36, opacity: 0.7, marginBottom: 16, letterSpacing: 4 }}>
          {label.toUpperCase()}
        </div>
      )}
      <div
        style={{
          fontSize: 180,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums", // equal-width digits → no jitter
          lineHeight: 1,
          color: ended ? "#ff4d4d" : "#fff",
        }}
      >
        {ended ? formatTime(0, format) : formatTime(remaining, format)}
      </div>
    </AbsoluteFill>
  );
};
```

Register it so `durationInFrames` matches the countdown exactly — the video ends when the timer does:

```tsx
import { Composition } from "remotion";
import { Countdown } from "./Countdown";

const FPS = 30;
const DURATION_SECONDS = 300; // 5-minute "starting soon" timer

export const RemotionRoot = () => (
  <Composition
    id="Countdown"
    component={Countdown}
    durationInFrames={DURATION_SECONDS * FPS}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ durationInSeconds: DURATION_SECONDS, format: "mm:ss", label: "Starting soon" }}
  />
);
```

Render any duration/format without touching code — duration is a prop:

```bash
npx remotion render Countdown out/sale.mp4 \
  --props='{"durationInSeconds":86400,"format":"dd:hh:mm:ss","label":"Sale ends in"}'
```

To hold a final state (e.g. "WE'RE LIVE") instead of ending on `00:00`, extend `durationInFrames` past the countdown and branch on `ended`.

## 2. Count down to a fixed date (live web component)

For a real-time page that targets a calendar moment. Drift-free because remaining time is `target − Date.now()` recomputed each frame, never a decrement.

```js
// targetISO must include an offset, e.g. "2026-07-01T09:00:00-07:00",
// so the deadline is unambiguous regardless of the viewer's timezone.
function startCountdown(targetISO, el) {
  const target = new Date(targetISO).getTime();
  const pad = (n) => String(n).padStart(2, "0");
  let lastShown = -1;

  function tick() {
    const remainingMs = Math.max(0, target - Date.now());
    const s = Math.floor(remainingMs / 1000);
    if (s !== lastShown) {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      el.textContent = `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s % 60)}`;
      lastShown = s;
    }
    if (remainingMs > 0) requestAnimationFrame(tick);
    else el.textContent = "00:00:00:00"; // or swap to an "It's live" state
  }
  requestAnimationFrame(tick);
}
```

Timezone notes:
- Bake the offset into the target string (`-07:00`, `Z`). A bare `"2026-07-01T09:00:00"` is parsed as the viewer's *local* time and every viewer sees a different deadline.
- To show "ends 9am in *your* timezone everywhere," instead pick the wall-clock time per locale and let each viewer's `Date` resolve it — but that is a different deadline per region. Decide which you want before building.

## 3. "Starting soon" stream screen

Livestream lead-in screens hold 5–10 minutes: a clean brand block, social handles, and a calm looping background, with the timer as the focal point. Keep it low-clutter — chat and music carry the wait; the screen just signals "we're about to start."

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const StartingSoon: React.FC<{ durationInSeconds: number; handle: string; brand: string }> = ({
  durationInSeconds,
  handle,
  brand,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const remaining = Math.max(0, Math.ceil(durationInSeconds - frame / fps));
  const pad = (n: number) => String(n).padStart(2, "0");

  // seamless looping gradient: angle cycles over loopFrames with no seam
  const loopFrames = fps * 8;
  const angle = interpolate(frame % loopFrames, [0, loopFrames], [0, 360]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, #141a3a, #0b0d17 60%)`,
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 800, marginBottom: 8 }}>{brand}</div>
      <div style={{ fontSize: 28, opacity: 0.6, letterSpacing: 6, marginBottom: 40 }}>
        STARTING SOON
      </div>
      <div style={{ fontSize: 200, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
      </div>
      <div style={{ position: "absolute", bottom: 60, fontSize: 30, opacity: 0.7 }}>{handle}</div>
    </AbsoluteFill>
  );
};
```

Export as MP4 and add it as a Media/Video source in OBS, or use a looping playout for a browser source. Common durations: 300s (5 min) or 600s (10 min) at 1920×1080.

## 4. Seamless looping background

Any motion whose period divides the timeline evenly wraps without a seam. Read animation phase as `frame % loopFrames` so the value at the wrap equals the value at frame 0.

```tsx
const loopFrames = fps * 6;            // one full cycle every 6 seconds
const phase = (frame % loopFrames) / loopFrames; // 0 → 1, repeats
const driftY = Math.sin(phase * Math.PI * 2) * 40; // returns to start each cycle
```

Use sine/cosine (inherently periodic) or `interpolate(frame % loopFrames, [0, loopFrames], [a, a])` with matching start/end so there is no jump. Keep contrast low and motion slow — the number is the subject.

---
## Built by the team behind iart.ai

This skill is part of an open motion-graphics collection from iart.ai — the AI motion agent that turns data, scripts, and designs into editable motion graphics (Remotion → MP4). If you'd rather not hand-build this, iart.ai can render countdown videos from a template with a set time and brand — change the text/data and re-export. → [iart.ai](https://iart.ai/?utm_source=github&utm_medium=reference&utm_campaign=tiktok-video-skills&utm_content=ref_footer&utm_term=countdown-video)
