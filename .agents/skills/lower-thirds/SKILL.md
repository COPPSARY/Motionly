---
name: lower-thirds
description: This skill should be used when the user asks to "make an animated lower third", "add lower thirds", "create a name tag/name lower third", "build broadcast titles", "animate a title/name/role caption", "do a speaker name overlay", or "template lower thirds across a list of names". Covers enter/exit animation (slide/wipe/mask reveal), in/out timing & dwell, safe-area & broadcast conventions, name-vs-role type hierarchy, brand styling, and rendering one design across many names.
version: 0.1.0
---

# Lower Thirds

Build a clean, branded lower third — the name/role caption that lives in the bottom band of the frame — that animates in, holds long enough to read, and exits without stealing the shot. The craft is restraint: a crisp reveal, a strong type hierarchy, correct safe-area placement, and one template that drives a whole roster of speakers.

## When to use

- Speaker/interview name tags, panel rosters, talking-head captions.
- Broadcast-style titles, news straps, podcast/webinar name plates.
- Templating one design across a list of names/titles → many clips (the payoff).

## Anatomy

A lower third is two text lines plus a graphic bed, placed in the lower band:

| Element | Role | Type treatment |
|---|---|---|
| **Name** (primary) | Who | Largest, heaviest, tightest tracking |
| **Role/title** (secondary) | What/where | ~45–60% of name size, lighter weight, often a brand accent color |
| **Bar / panel / accent** | Reads against any background | Solid or 70–85% opacity; an accent rule ties to brand |

Keep it to two lines. A name line + role line is the whole job — extra lines erode the hierarchy and crowd the safe area.

## Three rules that prevent cheap-looking titles

1. **Never hard-cut a title on or off.** A bare appear/disappear reads as a mistake. Even a 12-frame fade or slide makes it feel produced.
2. **Stagger, don't slam.** Animate the bar first, then the name, then the role, each offset by 3–6 frames. Everything arriving at once feels flat; a short cascade feels designed.
3. **Hold long enough to read twice.** Roughly 3–5s on screen (read it aloud twice). Too short and it's missed; too long and it nags. Animate in/out, never mid-segment.

## Enter & exit animations

Pick one motion language and reuse it. The most reliable, premium-reading reveals:

| Reveal | Feel | How |
|---|---|---|
| **Slide + fade** | Clean, default | Translate in ~24–40px while fading; ease-out on enter |
| **Wipe bar** | Broadcast | A bar scales/sweeps in (`scaleX`/clip), text fades behind it |
| **Mask reveal** | Premium | Clip text to a moving rectangle so letters "wipe on" |

Use asymmetric easing: a snappy `ease-out` (`cubic-bezier(.22,1,.36,1)`) on enter, a quicker `ease-in` on exit. Exit faster than you entered (~⅔ the duration) so the title gets out of the way.

```css
/* Mask reveal: text wipes on left→right, no plugin needed */
.lt-name { clip-path: inset(0 100% 0 0); animation: wipe .5s cubic-bezier(.22,1,.36,1) forwards; }
@keyframes wipe { to { clip-path: inset(0 0 0 0); } }
```

## In/out timing & dwell

Think in three phases. Budget frames, not vibes (at 30fps):

| Phase | Budget | Note |
|---|---|---|
| Enter | 12–18f (0.4–0.6s) | Staggered: bar → name → role |
| Hold | 90–150f (3–5s) | The readable dwell; scale with line length |
| Exit | 8–12f (0.27–0.4s) | Faster than enter |

In code, drive every state from the current frame (or a paused timeline), not wall-clock time — a video renderer demands deterministic frames. Express enter/hold/exit as a single progress curve so the same component works live in a browser and frame-by-frame in a renderer.

## Safe area & broadcast conventions

The lower third must survive every screen and platform UI. Compose inside the **title-safe area** (inner ~90% / margin 5%) and respect platform chrome:

| Frame | Anchor | Avoid |
|---|---|---|
| 16:9 (1920×1080) | Left edge at ~5% margin; baseline ~80–85% down | Outer 5% (title-safe), action-safe outer 10% |
| 9:16 (1080×1920) | Same left margin; **lift the band up** | Bottom ~18% (captions/UI), top ~12% |
| 1:1 (1080×1080) | Lower band, center-left | Outer 5% |

Anchor to the **left** and grow rightward so names of different lengths stay pinned and never re-center awkwardly. Keep the role line within the same left margin as the name. For 9:16, do not park the title at the very bottom — platform captions and buttons sit there.

## Type hierarchy & brand styling

Hierarchy is the whole design. Make the name unmistakably dominant:

- **Size contrast** ≥ 1.6× (name vs role). If unsure, push the name bigger, not the role.
- **Weight + color**: name in bold/near-white; role in a lighter weight and a **brand accent** color (one accent, used consistently).
- **Contrast for legibility**: text rides over unknown footage. Use a solid/semi-opaque bar, a subtle scrim, or a soft text shadow so it reads over both bright and dark plates.
- **Brand lock**: pin font, accent color, bar style, and corner radius in one theme object so every title across a series matches.

## Templating one design across a list

The reason to build this in code: change the text/data, re-export — no re-animating. Make name/role/theme **props**, never hardcoded, then map a roster to instances.

```jsx
const ROSTER = [
  { name: "Ada Lovelace",  role: "Founder, Analytical Engines" },
  { name: "Grace Hopper",  role: "Rear Admiral, US Navy" },
  { name: "Alan Turing",   role: "Mathematician" },
];
// One <LowerThird> design; map the list → many instances (sequence them in a renderer)
{ROSTER.map((p, i) => <LowerThird key={p.name} {...p} theme={BRAND} startFrame={i * 150} />)}
```

In a renderer, make the roster an input prop and render once per row (`--props`) to emit one branded clip per person — same animation, same brand, only the text changes. See `references/lower-third-component.md` for the full runnable component and batch script.

## Output checklist

- Two lines only: dominant name, secondary role (≥1.6× size contrast).
- Animated in and out (no hard cut); enter staggered bar→name→role; exit faster.
- Hold 3–5s (readable twice); motion only at the ends, never mid-segment.
- Left-anchored inside title-safe; 9:16 band lifted above the bottom-18% UI zone.
- Text legible over any plate (bar/scrim/shadow); one brand accent throughout.
- Name/role/theme are props — one template renders the whole roster.

## Deliver & verify (rendered stills → MP4)

> **Packaged helper** (`scripts/`): tile your stills with `scripts/contact-sheet.sh sheet.png f-hook.png f-mid.png f-end.png`, then assert the encode with `scripts/probe-mp4.sh out.mp4 [WxH] [fps]`. See `scripts/README.md`.

The lower third ships as a Remotion composition (`<Composition>` + zod `schema` + `defaultProps`, name/role/theme as props) — enter/dwell/exit all driven by `useCurrentFrame()`, never `Date.now()` / `Math.random()` / timers. Deliverable = `out/*.mp4` + the project (re-render per roster row). 9:16 vertical (1080×1920) is the default.

**Verify loop — render stills → inspect → encode.** Sample the three phases so you catch a stagger or safe-area bug before encoding (or batching the whole roster).

```bash
# Stills at enter / dwell / exit — WITH SHIPPED PROPS (a real roster row, not defaults)
npx remotion still LowerThird out/f-enter.png --frame=10  --props='{"name":"Ada Lovelace","role":"Founder, Analytical Engines"}'
npx remotion still LowerThird out/f-dwell.png --frame=75  --props='{"name":"Ada Lovelace","role":"Founder, Analytical Engines"}'
npx remotion still LowerThird out/f-exit.png  --frame=N   --props='{"name":"Ada Lovelace","role":"Founder, Analytical Engines"}'

# Inspect each PNG — focus the DWELL frame (fully on screen):
#  - hierarchy holds: name dominant (>=1.6x role), role in brand accent; both fully revealed, not mid-wipe
#  - brand lock: font, accent color, bar/scrim correct; legible over the plate
#  - 9:16 safe area: band LIFTED above the bottom ~20-35% UI zone, clear of top ~12% and the right action rail; left-anchored inside title-safe
#  - enter/exit frames show partial reveal (animation actually runs), not a hard cut

npx remotion render LowerThird out/lower-third.mp4 --props='{"name":"Ada Lovelace","role":"Founder, Analytical Engines"}'
npx remotion render LowerThird out/demo.gif --codec=gif                # README proof clip
```

**Batch roster**: verify ONE row via stills *before* rendering all names — catch a layout/overflow bug once, not N times. Use `npx remotion compositions` for `durationInFrames`/`fps` to pick the dwell + exit frames.

**Before you finish:**
1. Stills render cleanly at enter, dwell, and exit — no missing font/brand assets.
2. At the dwell frame: name dominant over role, brand accent + bar correct, fully (not partly) revealed.
3. The band is inside the 9:16 safe area — lifted above the bottom UI zone, clear of top and right rail — at every checked frame.
4. Frame-driven only — no `Date.now()` / `Math.random()` / timers; enter/exit show motion, never a hard cut.
5. A real roster row (not `defaultProps`) renders correctly; MP4 encoded, GIF optional.

## Reference files

- `references/lower-third-component.md` — a complete runnable lower-third: a Remotion component with staggered spring enter, readable hold, and faster exit driven purely by frame; a typed theme object for brand lock; the list→many-instances sequencing pattern; a per-row batch render script; plus a dependency-free CSS/HTML version of the same design with mask-reveal and wipe-bar variants.
