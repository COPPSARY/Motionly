---
name: short-form-video
description: This skill should be used when the user asks to "make a Reels/TikTok/YouTube Shorts video", "build a short-form video template", "write a hook for a short", "edit for retention", "add pattern interrupts", "make a video loop", "fix the first 3 seconds", "pace cuts for a vertical video", or "set up 9:16 safe areas". Covers the hook→retention→loop grammar of vertical short-form (distinct from a launch hype film).
version: 0.1.0
---

# Short-Form Video

Engineer a 9:16 video that survives the swipe. Short-form is not a small launch film — it is a retention machine: a hook that earns the first second, pattern interrupts that reset attention every few seconds, and often a loop that buys watch-time past 100%. The craft is timing, not polish.

## When to use

- Reels / TikTok / YouTube Shorts (7–60s, vertical 9:16).
- Retention editing: fixing drop-off, adding pattern interrupts, tightening pacing.
- Hooks, seamless loops, repeatable short-form templates (one design, many topics).

## Story structure (the retention contract)

Short-form storytelling is a contract with the viewer's thumb: every second must re-earn the next one. The narrative is shaped *backwards from the retention curve*, not forwards from an intro. Lock these before touching the timeline.

- **One idea per video.** A short carries exactly one payoff. A second idea splits attention and the curve sags in the middle — make it a second video instead. If you can't name the single takeaway in a sentence, you don't have a short yet.
- **Open a loop in the first ~3s, close it last.** The hook poses a question or gap (the open loop); the payoff answers it. The viewer stays because the loop is open — so never answer it early, and never bury the payoff under setup.
- **No dead air.** Every beat either advances the idea or resets attention. Cut anything that does neither. Silence, slow ramps, throat-clearing intros ("hey guys, in this video…") are where viewers swipe.
- **Why the curve, not the cut, is the unit of work.** The algorithm distributes whatever holds the per-second retention curve flat; a "good" edit that flattens the curve loses to an ugly one that keeps it up. You are editing the *curve*, and the hook gates everything after it — fix it first.

The narrative spine (the `Hook → Setup → Body → Payoff/loop` arc is budgeted in the table below):

| Move | Story job | Failure if missed |
|---|---|---|
| Hook | Open the loop; promise the payoff | Swipe in first 3s |
| Tension hold | Keep the gap open through the body | Flat middle, mid-drop |
| Payoff | Close the loop — the one idea, delivered | "Wasted my time," no share |
| Loop / CTA | Feed back to frame 0, or one clear ask | No re-watch, no action |

(`The retention arc` table below assigns seconds to each move; this section is the narrative logic and ordering behind it. `Hook grammar` lists the hook archetypes.)

## The one metric that drives everything

**Retention, not production value.** The algorithm distributes whatever holds viewers; ~87% decide to stay or swipe inside 3 seconds, and the threshold for distribution sits near **70%+ average view-through** (Shorts ~73%, TikTok ~78%, Reels ~65%). Every decision below trades against that curve. A flawless shot that bores at 0:04 loses to an ugly one that holds.

## The retention arc

| Beat | Job | Budget (of a 20s short) |
|---|---|---|
| Hook (0–1s) | One frame + one line that creates an open loop | 0–1s |
| Setup | Pay off *why watch* — promise, stakes, or the gap | 1–4s |
| Body | Deliver value in beats; one idea per beat | 4–17s |
| Payoff / loop | Close the loop — or feed it back to frame 0 | 17–20s |

Scale the *body*, never the hook. A 60s short has a longer body and more beats — the same 1-second hook.

## Hook grammar (first ~1s)

The hook is a sentence + a visual that opens a curiosity gap the brain needs closed. Pick one pattern and commit:

| Hook type | Shape | Best for |
|---|---|---|
| Open loop | "The reason your X keeps Y…" (answer delayed) | most content |
| Direct promise | "3 ways to ___ in 30 seconds" | educational / listicle |
| Pattern interrupt | snap-zoom / whip-pan / visual mismatch in frame 1 | entertainment |
| Negation | "Stop doing ___" / "You're ___ wrong" | strong opinions |

Two rules: the hook line is **on-screen as text by frame 1** (85% watch muted), and the most striking *visual* is also the first frame — never a slow ramp-in. Hold a strong opening frame; do not fade up from black.

## Pattern interrupts & cut rhythm

A pattern interrupt is any change that resets attention: a hard cut, zoom punch, b-roll insert, sound effect, caption pop, or angle change. In short-form, density is high — a *visual change every ~2–4 seconds*; videos with an interrupt roughly every 4s hold ~58% vs ~41% for a static talking head. The killer is a flat middle: TikTok throttles distribution when the watch-through curve flattens, so never stitch the body from low-energy takes.

```js
// Drive every interrupt off the FRAME, not wall-clock — renders deterministically.
import { useCurrentFrame } from "remotion";
const fps = 30;
const cuts = [0, 1.2, 3.0, 5.4, 8.0, 11.2, 14.0]; // seconds — uneven on purpose
const frame = useCurrentFrame();
const shot = cuts.findIndex((t, i) => frame < (cuts[i + 1] ?? Infinity) * fps);
```

Vary the interval — a metronome reads as boredom; uneven cuts read as momentum. A punch-in zoom is the cheapest interrupt that needs no new footage:

```jsx
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
const PunchIn = ({ at, children }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at * fps, fps, config: { damping: 12, stiffness: 200 } });
  const scale = interpolate(s, [0, 1], [1, 1.12]); // snap to 112% on the beat
  return <div style={{ transform: `scale(${scale})`, transformOrigin: "50% 45%" }}>{children}</div>;
};
```

## Captions

Most viewers watch muted, so on-screen captions are not optional — they carry the content and double as a pattern interrupt when each phrase pops in. Keep 4–7 words per line, high contrast, inside the safe area. **Do not re-implement caption animation here** — use the `caption-animation` skill for word-by-word timing, karaoke highlight, and styling; this skill only places captions on the retention timeline and inside the 9:16 safe zone.

## Loops & re-watch

A seamless loop counts each re-watch as fresh watch-time — a clean 8s loop watched 3× is 300% view-through, the strongest possible signal. Two techniques: match the **last frame to the first** (same composition, position, color) so the cut is invisible, and write a **sentence loop** — phrase the hook so the payoff feeds back into frame 0 ("…and that's why I never — " → loops to the start). Best length for re-watch is ~7–15s.

## 9:16 safe areas

Compose inside the universal safe zone so platform UI never covers text or faces.

| Zone | Pixels (1080×1920) | Avoid |
|---|---|---|
| Universal safe (all platforms) | center **900×1400** | anything critical outside it |
| Top | keep clear ~120px | profile / sound UI |
| Bottom | keep clear ~320px | captions, CTA, hashtags, audio bar |
| Right | keep clear ~120px | like / comment / share rail |

Put the hook text and key subject in the center 900×1400 box. Reserve the bottom ~320px even if it looks empty in the editor — that is where the platform paints its own captions and buttons.

## Output checklist

- Hook line is on-screen text by frame 1; strongest visual is the first frame (no fade-up).
- One open loop / promise set in the first ~4s.
- A visual pattern interrupt every ~2–4s; intervals uneven; no flat middle.
- Captions present (via `caption-animation`), 4–7 words, inside safe area.
- Loop closed — matched first/last frame or a sentence that feeds frame 0.
- Composed inside the 900×1400 center box; bottom 320px / top 120px / right 120px kept clear.
- Every animated value derived from `useCurrentFrame()` — no CSS/library timers.

## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

The short ships as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`) — every cut, punch-in, and interrupt driven by `useCurrentFrame()`, never `Date.now()` / `Math.random()` / timers. Deliverable = `out/*.mp4` + the project (re-render per topic). 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** Three frames test the three things that make or break retention: the hook, the pacing, and the loop seam.

```bash
# Stills at hook / mid-body / last frame — WITH SHIPPED PROPS (the real topic, not defaults)
npx remotion still Short out/f-hook.png --frame=10  --props='{"topic":"...","hook":"..."}'   # ~first 3s reads instantly
npx remotion still Short out/f-mid.png  --frame=N   --props='{"topic":"...","hook":"..."}'
npx remotion still Short out/f-end.png  --frame=L   --props='{"topic":"...","hook":"..."}'   # L = durationInFrames-1

# Inspect each PNG:
#  - HOOK frame (~frame 0-ish / first 3s): hook line is on-screen text and reads instantly; strongest visual already up (no fade-up)
#  - LOOP seam: compare f-hook(frame 0) vs f-end(last frame) — same composition/position/color for an invisible loop cut
#  - 9:16 safe area: hook + key subject inside the center 900x1400 box; clear of top ~12%, bottom ~20-35% (captions/CTA/audio), right action rail

npx remotion render Short out/short.mp4 --props='{"topic":"...","hook":"..."}'   # encode once stills verify
npx remotion render Short out/demo.gif --codec=gif                                # README proof clip
```

**Per topic / batch**: verify ONE topic via stills *before* rendering all of them. Use `npx remotion compositions` for `durationInFrames`/`fps` to pick the mid + last frames.

**Before you finish:**
1. Stills render cleanly at the hook, mid, and last frame — no errors.
2. The hook frame reads instantly (on-screen text + strongest visual up front, no fade-up); first vs last frame match for a clean loop seam.
3. Hook + subject + captions sit inside the 9:16 center 900×1400 safe box at every checked frame.
4. Frame-driven only — no `Date.now()` / `Math.random()` / timers; cuts uneven, no flat middle.
5. A real topic's shipped props (not `defaultProps`) render correctly; MP4 encoded, GIF optional.

## Reference files

- `references/retention-pacing.md` — a complete runnable Remotion `<Short>` composition: a frame-driven shot scheduler with uneven cuts, the PunchIn pattern interrupt, an on-screen hook, a 9:16 safe-area overlay, and a seamless first/last-frame loop. Plus a hook-pattern library, a retention-curve debugging method, per-platform safe-zone maps, and the template×topic batch-render pattern.
