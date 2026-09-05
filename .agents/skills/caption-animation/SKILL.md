---
name: caption-animation
description: This skill should be used when the user asks to "add animated captions", "make TikTok captions", "karaoke captions", "word-by-word subtitles", "auto subtitles", "highlight the active word", "burn in captions to a video", "sync captions to a voiceover/narration", or "turn an SRT/transcript into animated text". Covers word-level timing from Whisper, per-word pop/scale-in, active-word highlight, 9:16 safe-area placement, readable type, and burn-in vs sidecar SRT/VTT.
version: 0.1.0
---

# Caption Animation

Turn a transcript or voiceover into word-timed, scroll-stopping captions: each word pops in on the syllable, the active word highlights, and the text stays glued to the narration. Build the kind of captions that drive watch-time on TikTok, Reels, and Shorts — readable, on-beat, and inside the safe area.

## When to use

- Word-by-word or karaoke captions on short-form vertical video (9:16).
- Burning open captions onto a voiceover/narration track from a transcript.
- Turning a Whisper/SRT transcript into animated text in Remotion or on the web.
- Restyling auto-generated subtitles into a branded, "Hormozi-style" reveal.

## The pipeline

| Stage | Job | Tool |
|---|---|---|
| Transcribe | Audio → word-level timestamps | Whisper (`@remotion/install-whisper-cpp`), AssemblyAI |
| Normalize | → `{ text, startMs, endMs }[]` tokens | `@remotion/captions` `Caption` type |
| Page | Group words into 1–4 word "pages" | `createTikTokStyleCaptions()` |
| Animate | Per-word pop + active-word highlight | Remotion `spring()` / CSS |
| Place | Safe-area, readable type | layout rules below |
| Export | Burn-in (MP4) and/or sidecar SRT/VTT | Remotion render / file emit |

## Two non-negotiable rules

1. **Word-level timing, not line-level.** Karaoke reads as magic only when each word lands on the syllable. Always transcribe to word timestamps; never fake them by splitting a line evenly over its duration — drift is instantly visible.
2. **Readability beats style.** Captions are read on a phone, in sunlight, muted. Bold sans-serif, heavy stroke or shadow, high contrast first; decoration second. A caption nobody can read is decoration, not a caption.

## Word timing from a transcript

Whisper emits word-level timestamps directly. Normalize every source into one flat token shape so the renderer never cares where the words came from:

```ts
// Caption token — the one shape everything downstream consumes
type Token = { text: string; startMs: number; endMs: number };

// Parse an SRT cue block "00:00:01,200 --> 00:00:01,640" into ms
const toMs = (t: string) => {
  const [h, m, rest] = t.split(":");
  const [s, ms] = rest.split(",");
  return ((+h * 60 + +m) * 60 + +s) * 1000 + +ms;
};
```

If only sentence-level cues exist, re-transcribe for word timing — do not interpolate. Whisper's `medium.en` is ~2x faster than `large` and accurate enough for clean voice audio.

## Per-word pop-in (Remotion)

Drive each word's scale and opacity off a spring anchored to its own `startMs`. The micro-overshoot is what makes it feel "alive".

```tsx
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const Word: React.FC<{ token: Token; active: boolean }> = ({ token, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (token.startMs / 1000) * fps;            // word's own entrance frame
  const p = spring({ frame: frame - enter, fps, config: { damping: 12, mass: 0.6 } });
  const scale = interpolate(p, [0, 1], [0.6, 1]);        // pop from 60% → 100% (overshoots)
  return (
    <span style={{
      display: "inline-block",
      transform: `scale(${scale})`,
      opacity: interpolate(p, [0, 1], [0, 1]),
      color: active ? "#FFE45E" : "#FFFFFF",             // active-word highlight
      transition: "color 80ms linear",
    }}>{token.text}&nbsp;</span>
  );
};
```

Compute `active` by testing `frame` against each token's `[startMs, endMs]`. Keep the highlight a single accent color or a filled "box" behind the live word — never animate every word's color at once.

## Pages, not walls of text

Show 1–4 words at a time. Use Remotion's `createTikTokStyleCaptions()` (or group manually) and tune `combineTokensWithinMilliseconds`: ~200–500ms for true word-by-word, ~1000–1500ms for short readable phrases.

```ts
import { createTikTokStyleCaptions } from "@remotion/captions";
const { pages } = createTikTokStyleCaptions({
  captions, combineTokensWithinMilliseconds: 1200,       // ~2–3 words per page
});
```

## Web/CSS pop (no Remotion)

For a DOM/live player, give each word its own `animation-delay` equal to `startMs`:

```css
.word { display:inline-block; opacity:0; animation: pop .26s cubic-bezier(.34,1.56,.64,1) forwards; }
@keyframes pop { from { opacity:0; transform:translateY(.18em) scale(.7) } to { opacity:1; transform:none } }
.word.active { color:#FFE45E; }
```
```js
words.forEach(w => { const el = mk(w.text); el.style.animationDelay = `${w.startMs}ms`; track.append(el); });
```

## Readable type and safe-area placement (9:16, 1080×1920)

| Property | Value | Why |
|---|---|---|
| Font | Bold/ExtraBold sans (Montserrat, Inter, Helvetica) | Reads on small, busy screens |
| Size | 56–80px (≈8% of frame height), min 45px | Legible muted on a phone |
| Stroke | 2–6px solid black outline | Survives any background |
| Shadow | Soft drop shadow as backup to stroke | Separation on bright frames |
| Case | Uppercase or sentence; high contrast fill | Punch + scannability |
| Vertical pos | Center band, ~62–70% down | Above the UI, below the action |
| Bottom safe | Keep clear of bottom ~280px / 15% | Avoids caption/CTA/audio UI |
| Side safe | Keep within center 80% width | Avoids right-rail icons |

Place captions in the center band — not pinned to the very bottom, where the platform UI (username, audio, buttons) lives. Pad text to a max of ~2 lines.

## Sync to a voiceover / narration

The transcript already carries the timing of the exact audio. Lay that same audio under the composition and keep timestamps in the audio's timebase — captions and voice stay locked with zero manual nudging. If the VO is re-recorded, re-transcribe; never hand-shift offsets.

## Burn-in vs sidecar SRT/VTT

| | Burn-in (open) | Sidecar SRT/VTT (closed) |
|---|---|---|
| Where | Pixels in the MP4 | Separate `.srt`/`.vtt` file |
| Social (TikTok/Reels) | Required — guaranteed, styleable | Often ignored by the platform |
| Accessibility (ADA/WCAG) | Does not satisfy alone | Required (toggleable) |
| Best practice | Burn animated captions for social | Also ship a sidecar for the web/SEO |

Emit both: burn the animated captions for social, and write a plain SRT/VTT from the same tokens for accessible/SEO playback.

## Output checklist

- Word-level timestamps (real, from transcription) — no even-split fakery.
- Per-word pop with micro-overshoot; one accent color for the active word.
- 1–4 words per page; never a wall of text.
- Bold sans, 56–80px, 2–6px stroke + shadow, high contrast.
- Center band, clear of bottom ~280px and side rails.
- Audio laid under composition; timestamps in the audio timebase.
- Ship burn-in for social and a sidecar SRT/VTT for accessibility.

## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

Captions ship as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`) — all word motion frame-driven off `useCurrentFrame()`, never `Date.now()` / `Math.random()` / timers. Deliverable = `out/*.mp4` (burned-in) + the project + the sidecar SRT/VTT. 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** Word timing is the thing that breaks; check it at exact frames before you spend an encode.

```bash
# Stills at start / a sampled active-word frame / end — WITH SHIPPED PROPS (real tokens + audio)
npx remotion still Captions out/f-start.png --frame=0   --props='{"captionsSrc":"vo.json"}'
npx remotion still Captions out/f-mid.png   --frame=90  --props='{"captionsSrc":"vo.json"}'
npx remotion still Captions out/f-end.png   --frame=N   --props='{"captionsSrc":"vo.json"}'  # N = durationInFrames-1

# Inspect each PNG:
#  - the word highlighted at frame 90 is the word whose [startMs,endMs] contains 90/fps (no drift)
#  - burn-in legible: bold sans, stroke+shadow holds, no clipping
#  - 9:16 safe area: caption sits in the center band, clear of top ~12% and bottom ~20-35% (captions/CTA/audio UI) and the right action rail

npx remotion render Captions out/captions.mp4 --props='{"captionsSrc":"vo.json"}'   # encode once stills are right
npx remotion render Captions out/demo.gif --codec=gif                                # README proof clip
```

Use `npx remotion compositions` to read `durationInFrames`/`fps` and pick the active-word + end frames.

**Before you finish:**
1. Stills render cleanly at frame 0, a mid active-word frame, and last — no missing font/audio.
2. The correct word is highlighted at the sampled frame (frame/fps lands inside its token); no even-split fakery.
3. Burn-in is legible (stroke+shadow) and the caption is fully inside the 9:16 safe area at every checked frame.
4. Frame-driven only — no `Date.now()` / `Math.random()` / timers.
5. Shipped props (real tokens, not just `defaultProps`) render correctly; MP4 + sidecar SRT/VTT emitted, GIF optional.

## Reference files

- `references/word-timed-captions.md` — end-to-end build: Whisper transcription and the `Caption` type, a full SRT parser, Remotion word-timed component with active-highlight, manual paging, an SRT/VTT emitter, per-platform safe-area maps, and a readable-type spec sheet.
