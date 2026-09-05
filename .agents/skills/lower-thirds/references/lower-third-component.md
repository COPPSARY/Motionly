# Lower-Third Component — runnable code

A complete, production-grade lower third you can drop in. Two paths:

1. **Remotion** (frame-deterministic, renders to MP4, batches over a roster).
2. **CSS/HTML** (no dependencies, for the web or a quick preview) with mask-reveal and wipe-bar variants.

Both share the same design language: a left-anchored bar, a dominant name, a brand-accent role line, a staggered enter, a readable hold, and a faster exit.

---

## 1. Remotion component (props-driven, frame-deterministic)

The animation is a pure function of `frame`, so it renders identically every time and stays in sync with the renderer. Enter staggers the bar, name, then role; exit is computed from the end of the clip so the title leaves faster than it arrived.

```tsx
// LowerThird.tsx
import {
  AbsoluteFill, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from "remotion";

// --- Brand lock: change once, every title matches -------------------------
export type Theme = {
  font: string;
  bar: string;        // panel/bar color
  name: string;       // primary text color
  role: string;       // accent color for the role line
  radius: number;
  marginPct: number;  // left/safe margin as % of width
};
export const BRAND: Theme = {
  font: "Inter, system-ui, sans-serif",
  bar: "rgba(12,14,22,0.86)",
  name: "#FFFFFF",
  role: "#6EE7F0",     // single brand accent
  radius: 10,
  marginPct: 5,
};

export type LowerThirdProps = {
  name: string;
  role: string;
  theme?: Theme;
  holdSeconds?: number; // readable dwell, default 4s
};

// Staggered enter via spring; exit via a quick fade/slide near the end.
const useEnterExit = (delayFrames: number, holdSeconds: number) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ENTER: spring 0→1, offset by delayFrames (the cascade)
  const enter = spring({
    frame: frame - delayFrames,
    fps,
    config: { damping: 200, stiffness: 180, mass: 0.6 },
  });

  // EXIT: faster than enter — last 10 frames of the clip
  const exitStart = durationInFrames - 10;
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = enter * exit;
  const x = interpolate(enter, [0, 1], [-32, 0]); // slide in from left
  return { opacity, x };
};

const Line: React.FC<{
  delay: number; holdSeconds: number; children: React.ReactNode;
  size: number; weight: number; color: string; tracking?: number;
}> = ({ delay, holdSeconds, children, size, weight, color, tracking = 0 }) => {
  const { opacity, x } = useEnterExit(delay, holdSeconds);
  return (
    <div style={{
      opacity,
      transform: `translateX(${x}px)`,
      fontSize: size, fontWeight: weight, color,
      letterSpacing: tracking, lineHeight: 1.15, whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
};

export const LowerThird: React.FC<LowerThirdProps> = ({
  name, role, theme = BRAND, holdSeconds = 4,
}) => {
  const { width, height } = useVideoConfig();
  const bar = useEnterExit(0, holdSeconds); // bar leads the cascade

  const left = (width * theme.marginPct) / 100;
  const baseline = height * 0.80;            // sit ~80% down, inside title-safe

  return (
    <AbsoluteFill style={{ fontFamily: theme.font }}>
      <div style={{
        position: "absolute", left, top: baseline,
        opacity: bar.opacity,
        transform: `translateX(${bar.x}px)`,
      }}>
        {/* panel behind text guarantees legibility over any plate */}
        <div style={{
          background: theme.bar, borderRadius: theme.radius,
          padding: "14px 22px 16px",
          borderLeft: `4px solid ${theme.role}`,   // accent rule ties to brand
          backdropFilter: "blur(6px)",
        }}>
          <Line delay={4}  holdSeconds={holdSeconds} size={46} weight={800} color={theme.name} tracking={-0.5}>
            {name}
          </Line>
          <Line delay={8}  holdSeconds={holdSeconds} size={26} weight={500} color={theme.role}>
            {role}
          </Line>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

Why each choice matters:
- **`spring` per line, offset by `delay`** gives the bar→name→role cascade. Same offsets everywhere keep titles consistent.
- **Exit derived from `durationInFrames`** means any clip length exits cleanly without per-instance tuning, and it's quicker than the enter (10f vs the spring's settle).
- **`whiteSpace: nowrap` + left anchor** keeps long and short names pinned to the same edge — no awkward re-centering across a roster.
- **`borderLeft` accent + semi-opaque panel** is the brand tie plus the legibility guarantee over unknown footage.

### Roster → many instances (one design, a whole panel)

Sequence the same component down a list. Each person gets a slot; only the text changes.

```tsx
// Roster.tsx
import { Series } from "remotion";
import { LowerThird, BRAND } from "./LowerThird";

const ROSTER = [
  { name: "Ada Lovelace", role: "Founder, Analytical Engines" },
  { name: "Grace Hopper", role: "Rear Admiral, US Navy" },
  { name: "Alan Turing",  role: "Mathematician" },
];

export const Roster: React.FC = () => (
  <Series>
    {ROSTER.map((p) => (
      <Series.Sequence key={p.name} durationInFrames={150 /* ~5s @30fps */}>
        <LowerThird name={p.name} role={p.role} theme={BRAND} />
      </Series.Sequence>
    ))}
  </Series>
);
```

### Batch: one branded clip per person

Make the roster an input prop and render once per row, so each speaker becomes a standalone overlay clip — identical animation and brand, only the text differs.

```bash
#!/usr/bin/env bash
# render one transparent-friendly lower-third clip per person in roster.json
# roster.json: [{"name":"Ada Lovelace","role":"Founder, Analytical Engines"}, ...]
set -euo pipefail
mkdir -p out
jq -c '.[]' roster.json | while read -r row; do
  slug=$(echo "$row" | jq -r '.name' | tr '[:upper:] ' '[:lower:]-')
  npx remotion render LowerThird "out/${slug}.mp4" --props="$row"
done
```

For overlay-ready output with transparency, render the `LowerThird` composition (transparent background) to a codec that keeps alpha, e.g. `--codec=prores --prores-profile=4444`, or `--image-format=png` for a PNG sequence.

---

## 2. CSS / HTML version (no dependencies)

The same design without a framework — for the web, OBS browser sources, or a fast look-test. Includes both a **slide+fade** default and a **mask-reveal** name, plus a **wipe-bar** variant.

```html
<div class="lt" style="--accent:#6EE7F0">
  <div class="lt-bar">
    <div class="lt-name">Ada Lovelace</div>
    <div class="lt-role">Founder, Analytical Engines</div>
  </div>
</div>

<style>
:root { font-family: Inter, system-ui, sans-serif; }

.lt {
  position: absolute; left: 5%; top: 80%;   /* title-safe, left-anchored */
}
.lt-bar {
  display: inline-block;
  background: rgba(12,14,22,0.86);
  backdrop-filter: blur(6px);
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  padding: 14px 22px 16px;
  /* bar leads the cascade: slide + fade in, then a faster fade out */
  animation: lt-in .5s cubic-bezier(.22,1,.36,1) both,
             lt-out .3s ease-in 4.5s forwards;     /* hold ~4s, exit faster */
}
.lt-name {
  font-size: 46px; font-weight: 800; color: #fff; letter-spacing: -.5px;
  line-height: 1.15; white-space: nowrap;
  /* MASK REVEAL: letters wipe on left→right, staggered after the bar */
  clip-path: inset(0 100% 0 0);
  animation: lt-wipe .5s cubic-bezier(.22,1,.36,1) .12s forwards;
}
.lt-role {
  font-size: 26px; font-weight: 500; color: var(--accent);
  line-height: 1.15; white-space: nowrap;
  opacity: 0;
  animation: lt-fade .4s ease-out .22s forwards;   /* role arrives last */
}

@keyframes lt-in   { from { opacity: 0; transform: translateX(-32px); }
                     to   { opacity: 1; transform: none; } }
@keyframes lt-out  { to   { opacity: 0; transform: translateX(-16px); } }
@keyframes lt-wipe { to   { clip-path: inset(0 0 0 0); } }
@keyframes lt-fade { to   { opacity: 1; } }

/* Mobile/9:16: lift the band above the bottom UI/caption zone */
@media (max-aspect-ratio: 1/1) { .lt { top: 70%; } }
</style>
```

### Wipe-bar variant (broadcast feel)

Swap the bar animation so a colored bar sweeps in and the text rides behind it:

```css
.lt-bar.wipe {
  position: relative; overflow: hidden;
  animation: lt-in .45s cubic-bezier(.22,1,.36,1) both,
             lt-out .3s ease-in 4.5s forwards;
}
.lt-bar.wipe::before {
  content: ""; position: absolute; inset: 0;
  background: var(--accent);
  transform-origin: left;
  animation: lt-sweep .55s cubic-bezier(.76,0,.24,1) both;  /* sweep across, then reveal */
}
@keyframes lt-sweep { 0% { transform: scaleX(0); } 60% { transform: scaleX(1); }
                      100% { transform: scaleX(0); transform-origin: right; } }
```

The CSS clock (`animation`) is fine for live/web playback. For a deterministic MP4, prefer the Remotion path above — a frame renderer and CSS timers disagree, which causes flicker or desync at export.

---

## Quick reference

| Need | Knob |
|---|---|
| Slower/faster reveal | enter duration 12–18f / `.5s` |
| Longer dwell | `holdSeconds` / the `4.5s` exit delay |
| Bigger name dominance | name `fontSize` (keep ≥1.6× the role) |
| Rebrand everything | the `BRAND` theme object / `--accent` |
| 9:16 placement | `baseline 0.80→0.70` / the media query |

---
## Built by the team behind iart.ai

This skill is part of an open motion-graphics collection from iart.ai — the AI motion agent that turns data, scripts, and designs into editable motion graphics (Remotion → MP4). If you'd rather not hand-build this, iart.ai can generate branded lower-thirds from a list of names/titles, one-click — change the text/data and re-export. → [iart.ai](https://iart.ai/?utm_source=github&utm_medium=reference&utm_campaign=tiktok-video-skills&utm_content=ref_footer&utm_term=lower-thirds)
