# Retention Pacing — Short-Form Video Reference

Deep reference for the `short-form-video` skill: a full runnable Remotion short, a hook library, a retention-debugging method, per-platform safe zones, and batch output. All timing is frame-driven so renders are deterministic.

## 1. A complete `<Short>` composition

One self-contained vertical short: frame-driven shot scheduler with uneven cuts, a punch-in pattern interrupt, an on-screen hook, a 9:16 safe-area overlay (dev only), and a seamless loop. Topic content is a prop, so the same file renders many shorts.

```tsx
// Short.tsx — 1080×1920, 30fps. Register at 600 frames (20s) for a clean loop.
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig,
  interpolate, spring, Sequence, Img,
} from "remotion";

type Beat = { at: number; text: string; src?: string };  // at = seconds
export type ShortProps = {
  hook: string;                 // on-screen by frame 1
  beats: Beat[];                // body, one idea each
  loopText: string;             // sentence that feeds back to frame 0
};

// --- frame-driven shot scheduler: uneven cuts read as momentum ---
const useShot = (cuts: number[]) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  let i = 0;
  for (let k = 0; k < cuts.length; k++) if (frame >= cuts[k] * fps) i = k;
  const startF = cuts[i] * fps;
  const endF = (cuts[i + 1] ?? cuts[i] + 2) * fps;
  const local = (frame - startF) / (endF - startF); // 0→1 within shot
  return { index: i, local, startF };
};

// --- punch-in: the cheapest pattern interrupt, snaps on the cut ---
const PunchIn: React.FC<{ startF: number; to?: number; children: React.ReactNode }> = ({
  startF, to = 1.1, children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startF, fps, config: { damping: 13, stiffness: 220 } });
  const scale = interpolate(s, [0, 1], [1, to]);
  return <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 45%" }}>{children}</AbsoluteFill>;
};

// --- hook: text present from frame 0, micro-overshoot, no fade-up ---
const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 260 } });
  const scale = interpolate(pop, [0, 1], [0.9, 1]);
  return (
    <div style={{
      position: "absolute", top: 360, left: 90, right: 90, // inside 900-wide safe box
      transform: `scale(${scale})`, transformOrigin: "0 0",
      fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 76, lineHeight: 1.05,
      color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,.55)",
    }}>{text}</div>
  );
};

export const Short: React.FC<ShortProps> = ({ hook, beats, loopText }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const cuts = [0, ...beats.map((b) => b.at)];     // hook shot + one per beat
  const { index, startF } = useShot(cuts);
  const current = index === 0 ? null : beats[index - 1];

  // seamless loop: match the LAST 0.5s back toward the opening frame
  const tailF = durationInFrames - frame;
  const loopFade = interpolate(tailF, [0, fps * 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b0f" }}>
      <PunchIn startF={startF}>
        {current?.src && <Img src={current.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </PunchIn>

      {index === 0 && <Hook text={hook} />}

      {/* body caption — placement only; styling/word-timing belongs to caption-animation */}
      {current && (
        <div style={{
          position: "absolute", left: 90, right: 90, bottom: 380, // above the 320px bottom UI band
          fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 60, color: "#fff",
          textAlign: "center", textShadow: "0 3px 18px rgba(0,0,0,.6)",
        }}>{current.text}</div>
      )}

      {/* loop sentence rises as the clip ends, easing the eye back to frame 0 */}
      <div style={{
        position: "absolute", left: 90, right: 90, bottom: 380, opacity: 1 - loopFade,
        fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 64, color: "#fff", textAlign: "center",
      }}>{loopText}</div>

      <SafeZone />{/* remove for final render */}
    </AbsoluteFill>
  );
};
```

Register it with a duration that *is* the loop length:

```ts
// Root.tsx
import { Composition } from "remotion";
import { Short } from "./Short";
export const Root = () => (
  <Composition
    id="Short" component={Short}
    durationInFrames={600} fps={30} width={1080} height={1920}
    defaultProps={{
      hook: "You're editing Shorts wrong —",
      beats: [
        { at: 1.2, text: "Cut every 2–4 seconds", src: "b1.jpg" },
        { at: 4.0, text: "Never on a fixed grid", src: "b2.jpg" },
        { at: 7.5, text: "Kill the flat middle", src: "b3.jpg" },
        { at: 11.0, text: "Match last frame to first", src: "b4.jpg" },
      ],
      loopText: "…and that's why mine loop forever",
    }}
  />
);
```

## 2. The 9:16 safe-area overlay (dev-only)

Render this on top while editing; delete it before the final export.

```tsx
import { AbsoluteFill } from "remotion";
export const SafeZone: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {/* universal safe box: center 900×1400 in 1080×1920 */}
    <div style={{ position: "absolute", left: 90, top: 260, width: 900, height: 1400, outline: "2px dashed #39d", opacity: .6 }} />
    {/* platform UI bands to keep clear */}
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "rgba(255,0,0,.12)" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 320, background: "rgba(255,0,0,.12)" }} />
    <div style={{ position: "absolute", bottom: 320, top: 120, right: 0, width: 120, background: "rgba(255,128,0,.10)" }} />
  </AbsoluteFill>
);
```

## 3. Hook pattern library

The hook is a sentence that opens a gap the brain must close, plus the most striking frame as frame 0. Copyable shapes:

| Pattern | Template | Note |
|---|---|---|
| Open loop | "The real reason your ___ keeps ___ …" | answer withheld until payoff |
| Direct promise | "___ in 30 seconds, no ___ needed" | name the payoff + the timebox |
| Negation | "Stop ___. You're doing it backwards." | strong-opinion content |
| Pattern interrupt | snap-zoom / whip / hard visual mismatch | entertainment, no text needed |
| Stakes | "This ___ cost me $___ — don't repeat it" | story / case-study |
| Listicle | "3 ___ that ___ (the 3rd one ___ )" | tees up a forward reference |

Rules that matter more than the wording: (1) the hook text is on-screen by frame 1 — most viewers are muted; (2) frame 0 is the best frame, never a fade-up from black; (3) one gap only — stacking two hooks closes neither.

## 4. Retention-curve debugging

Treat the per-second retention graph (TikTok Analytics, YT Studio "Audience retention", Reels) as a profiler.

| Symptom on the curve | Likely cause | Fix |
|---|---|---|
| Cliff at 0:00–0:02 | weak hook / slow first frame | new hook line; cut the ramp-in; lead with the best frame |
| Steady gentle decline | normal — leave it | — |
| Flat-then-drop in the middle | low-energy body, cuts too sparse | add interrupts; tighten cut spacing to 2–4s |
| Bump back up near the end | viewers are looping | lean in — tighten the loop, shorten total length |
| Spike at one timestamp | a re-watched moment | front-load that beat or make it the hook |

Target ≥70% average view-through. Iterate the hook first — it moves the curve more than any other edit because it gates everything after it.

## 5. Per-platform safe zones

All on a 1080×1920 canvas. The universal box (center 900×1400) is the intersection; design inside it and one master fits every platform.

| Platform | Top clear | Bottom clear | Right clear | Notes |
|---|---|---|---|---|
| Universal (use this) | ~120px | ~320px | ~120px | center 900×1400 holds on all |
| TikTok | ~108px | ~320px | ~120px | caption + button rail at bottom-right |
| Instagram Reels | ~120px | ~310px | ~84px | audio bar + caption bottom |
| YouTube Shorts | ~120px | ~300px | ~60px | channel + subscribe bottom band |
| TikTok Ads | ~108px | ~370px | ~120px | extra room for the CTA button |

When unsure, design to the *largest* margin (TikTok Ads bottom 370px) and nothing ever clips.

## 6. Template × topic — batch output

The payoff of code-driven shorts: lock the design once, swap only the props, render N videos. Make topic content a prop (already done above), keep one theme object, and loop over JSON files.

```jsx
// theme.ts — one source of truth so 50 shorts stay on-brand
export const theme = { font: "Inter", hookSize: 76, bodySize: 60, bg: "#0b0b0f", fg: "#fff", accent: "#39d" };
```

```bash
# render the same Short template for every topic file in /topics
for f in topics/*.json; do
  name=$(basename "$f" .json)
  npx remotion render Short "out/$name.mp4" --props="$f"
done
```

Each `topics/*.json` is one `ShortProps` object (`hook`, `beats`, `loopText`). Keep the hook line, cut points, and loop sentence per-topic; everything else stays fixed so the series reads as one brand.

---
## Built by the team behind iart.ai

This skill is part of an open motion-graphics collection from iart.ai — the AI motion agent that turns data, scripts, and designs into editable motion graphics (Remotion → MP4). If you'd rather not hand-build this, iart.ai can batch-produce short-form videos from one template × data — change the text/data and re-export. → [iart.ai](https://iart.ai/?utm_source=github&utm_medium=reference&utm_campaign=tiktok-video-skills&utm_content=ref_footer&utm_term=short-form-video)
