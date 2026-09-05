# Word-Timed Captions — End-to-End Build

A complete, runnable path from audio/transcript to animated burn-in captions plus a sidecar SRT/VTT. Code targets Remotion for burn-in and plain JS for the web; the data shapes are framework-agnostic.

## 1. The one data shape

Everything normalizes to a flat array of word tokens. Get to this shape and the renderer never cares about the source.

```ts
export type Token = { text: string; startMs: number; endMs: number };
export type Page  = { startMs: number; endMs: number; tokens: Token[] };
```

Remotion's `@remotion/captions` uses a compatible `Caption` type:

```ts
type Caption = { text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null };
```

## 2. Transcribe to word-level timing (Whisper)

Word timestamps are non-negotiable for karaoke. Whisper produces them natively.

```bash
npx @remotion/install-whisper-cpp   # one-time: installs whisper.cpp + a model
```

```ts
import { transcribe, toCaptions } from "@remotion/install-whisper-cpp";

const { transcription } = await transcribe({
  inputPath: "voiceover.wav",      // 16kHz mono WAV is ideal for whisper.cpp
  model: "medium.en",              // medium.en ≈ 2x faster than large, accurate on clean voice
  tokenLevelTimestamps: true,      // <-- the key flag: per-word, not per-line
  whisperPath: "./whisper.cpp",
});
const { captions } = toCaptions({ transcription }); // → Caption[]
```

Tips:
- Feed clean voice audio (denoise/normalize first). Background music wrecks word boundaries.
- `large` is most accurate but 2–3x real-time on a laptop. Use `medium.en` unless accuracy is critical.
- Cloud alternatives (AssemblyAI, Deepgram, OpenAI Whisper API) also return word timing — map their `words[]` into `Token` the same way.

Map any token shape into `Token`:

```ts
const toTokens = (caps: Caption[]): Token[] =>
  caps.map(c => ({ text: c.text.trim(), startMs: c.startMs, endMs: c.endMs }));
```

## 3. Parse an existing SRT into tokens

When handed an SRT, parse cues; if cues are sentence-level, re-transcribe for word timing rather than interpolating.

```ts
const toMs = (t: string) => {
  const [h, m, rest] = t.trim().split(":");
  const [s, ms] = rest.split(",");
  return ((+h * 60 + +m) * 60 + +s) * 1000 + +ms;
};

export function parseSrt(src: string): Token[] {
  return src.trim().split(/\n\s*\n/).map(block => {
    const lines = block.split("\n");
    const time = lines.find(l => l.includes("-->"))!;
    const [a, b] = time.split("-->");
    const text = lines.slice(lines.indexOf(time) + 1).join(" ").trim();
    return { text, startMs: toMs(a), endMs: toMs(b) };
  });
}
```

## 4. Page the tokens (1–4 words at a time)

Either use Remotion's helper or group manually. Manual grouping by gap + max-words keeps full control:

```ts
export function paginate(tokens: Token[], maxWords = 3, maxGapMs = 1200): Page[] {
  const pages: Page[] = [];
  let cur: Token[] = [];
  for (const t of tokens) {
    const span = cur.length ? t.endMs - cur[0].startMs : 0;
    if (cur.length >= maxWords || span > maxGapMs) {
      if (cur.length) pages.push(pageOf(cur)); cur = [];
    }
    cur.push(t);
  }
  if (cur.length) pages.push(pageOf(cur));
  return pages;
}
const pageOf = (ts: Token[]): Page => ({ startMs: ts[0].startMs, endMs: ts.at(-1)!.endMs, tokens: ts });
```

Remotion equivalent:

```ts
import { createTikTokStyleCaptions } from "@remotion/captions";
const { pages } = createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 1200 });
// 200–500ms → word-by-word; 1000–1500ms → short readable phrases
```

## 5. Remotion component: word-timed with active highlight

```tsx
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig,
         spring, interpolate, staticFile } from "remotion";

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: "Montserrat, Inter, sans-serif",
  fontWeight: 800,
  fontSize: 72,                         // ~8% of 1920px height
  color: "#fff",
  textAlign: "center",
  textTransform: "uppercase",
  WebkitTextStroke: "5px #000",         // heavy outline survives any background
  paintOrder: "stroke fill",            // stroke behind fill, not clipping glyphs
  textShadow: "0 4px 16px rgba(0,0,0,.55)",
  lineHeight: 1.1,
  padding: "0 80px",                    // keep inside center 80% width
};

const Word: React.FC<{ token: Token; active: boolean }> = ({ token, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (token.startMs / 1000) * fps;
  const p = spring({ frame: frame - enter, fps, config: { damping: 12, mass: 0.6 } });
  return (
    <span style={{
      display: "inline-block",
      transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`,
      opacity: interpolate(p, [0, 1], [0, 1]),
      color: active ? "#FFE45E" : undefined,
      transition: "color 80ms linear",
    }}>{token.text}&nbsp;</span>
  );
};

export const Captions: React.FC<{ pages: Page[]; audio: string }> = ({ pages, audio }) => {
  const { fps } = useVideoConfig();
  const f = (ms: number) => Math.round((ms / 1000) * fps);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Audio src={staticFile(audio)} />        {/* same audio the transcript came from */}
      {pages.map((pg, i) => (
        <Sequence key={i} from={f(pg.startMs)} durationInFrames={Math.max(1, f(pg.endMs - pg.startMs))}>
          <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "62%" }}>
            <div style={CAPTION_STYLE}>
              {pg.tokens.map((t, j) => {
                const now = (frame / fps) * 1000;
                return <Word key={j} token={t} active={now >= t.startMs && now < t.endMs} />;
              })}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

Because the `<Audio>` and the timestamps share one timebase, voice and captions stay locked with no manual nudging. Re-record the VO → re-transcribe → done.

## 6. Web/CSS path (live DOM player)

```js
function renderTrack(tokens, mountEl) {
  tokens.forEach(t => {
    const el = document.createElement("span");
    el.className = "word";
    el.textContent = t.text + " ";
    el.style.animationDelay = `${t.startMs}ms`;   // each word pops on its own start
    mountEl.append(el);
  });
}
// drive .active off the media element's currentTime
audio.addEventListener("timeupdate", () => {
  const ms = audio.currentTime * 1000;
  [...track.children].forEach((el, i) =>
    el.classList.toggle("active", ms >= tokens[i].startMs && ms < tokens[i].endMs));
});
```

```css
.cap   { font: 800 72px/1.1 Montserrat, sans-serif; text-transform: uppercase;
         color:#fff; -webkit-text-stroke:5px #000; paint-order:stroke fill;
         text-shadow:0 4px 16px rgba(0,0,0,.55); text-align:center; }
.word  { display:inline-block; opacity:0; animation: pop .26s cubic-bezier(.34,1.56,.64,1) forwards; }
.word.active { color:#FFE45E; }
@keyframes pop { from { opacity:0; transform:translateY(.18em) scale(.7) } to { opacity:1; transform:none } }
```

## 7. Emit a sidecar SRT / VTT from the same tokens

Burn-in alone does not satisfy ADA/WCAG and many platforms ignore uploaded tracks — so ship both. Group tokens into readable cues and serialize:

```ts
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const stamp = (ms: number, sep: string) => {
  const h = Math.floor(ms / 3.6e6), m = Math.floor(ms % 3.6e6 / 6e4),
        s = Math.floor(ms % 6e4 / 1000), x = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(x, 3)}`;
};

export const toSrt = (pages: Page[]) => pages.map((p, i) =>
  `${i + 1}\n${stamp(p.startMs, ",")} --> ${stamp(p.endMs, ",")}\n${p.tokens.map(t => t.text).join(" ")}`
).join("\n\n") + "\n";

export const toVtt = (pages: Page[]) => "WEBVTT\n\n" + pages.map(p =>
  `${stamp(p.startMs, ".")} --> ${stamp(p.endMs, ".")}\n${p.tokens.map(t => t.text).join(" ")}`
).join("\n\n") + "\n";
```

Use SRT for the broadest platform support; VTT when styling/positioning cues or serving on the web.

## 8. Per-platform safe areas (1080×1920, 9:16)

| Platform | Bottom keep-clear | Top keep-clear | Side keep-clear | Notes |
|---|---|---|---|---|
| TikTok | ~340px | ~120px | ~110px right rail | Captions, audio title, action buttons crowd the bottom-right |
| Instagram Reels | ~280px | ~130px | ~60px | Username/CTA bar at bottom |
| YouTube Shorts | ~240px | ~100px | ~120px right rail | Title + channel at bottom-left |
| Facebook Reels | ~300px | ~130px | ~80px | Similar to Reels |

Safe rule across all: place caption baseline at ~62–70% of frame height, keep text within the center 80% width, and never let it enter the bottom ~15%.

## 9. Readable-type spec sheet

| Property | Recommended | Floor |
|---|---|---|
| Weight | 800 (ExtraBold) | 700 |
| Size @1080p | 56–80px | 45px |
| Stroke | 4–6px solid #000 | 2px |
| Shadow | `0 4px 16px rgba(0,0,0,.55)` | soft 1px |
| Active accent | one color (e.g. #FFE45E) or filled box | — |
| Lines on screen | 1–2 | 2 max |
| Words per page | 1–4 | 5 max |

Set `paint-order: stroke fill` so a thick stroke sits behind the glyph instead of eating it. Test on a bright frame and a busy frame; if it survives both, it ships.

## 10. Render

```bash
npx remotion render src/index.ts Captions out/captions.mp4 \
  --props='{"pages": ..., "audio": "voiceover.wav"}'
```

A 10-minute video with animated captions can take 30–60 min to render locally; render long-form in segments, or render on Remotion Lambda for parallel speed.

---
## Built by the team behind iart.ai

This skill is part of an open motion-graphics collection from iart.ai — the AI motion agent that turns data, scripts, and designs into editable motion graphics (Remotion → MP4). If you'd rather not hand-build this, iart.ai can auto-time captions to a narration track and one-click burn them in from a template — change the text/audio and re-export. → [iart.ai](https://iart.ai/?utm_source=github&utm_medium=reference&utm_campaign=tiktok-video-skills&utm_content=ref_footer&utm_term=caption-animation)
