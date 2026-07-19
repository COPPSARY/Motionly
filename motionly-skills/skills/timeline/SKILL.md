---
name: timeline
description: Organize, sequence, trim, and retime Motionly timelines. Use for tracks, clips, start/duration, trimIn/trimOut, overlaps, layer order, narration synchronization, audio placement, keyframe timing, clip transitions, and timeline troubleshooting.
---

# Timeline

Treat visual tracks as simple persisted layers. Horizontal movement changes time; vertical movement selects a layer. Overlaps are allowed and never ripple neighboring clips automatically. Audio stays on the bottom audio track.

## Build A Timing Map

For each shot record purpose, focal subject, entrance, readable hold, exit, and transition. Derive exact media and audio duration from the files when available.

```text
0.0–2.8  Promise: title enters, holds, exits
2.6–6.4  Product proof: video clip + one callout
6.2–8.0  Brand close: logo resolve + CTA
```

Small overlaps are deliberate transition handles; unexplained overlaps are bugs.

## Tracks And Clips

```motion
track product {
  label "Product"
  role main
  content video
  order 0
}

track callouts {
  label "Callouts"
  role overlay
  content mixed
  order 1
}

clip demo {
  track product
  start 2.6s
  duration 3.8s
  trimIn 1.2s
  trimOut 0s
}
```

## Retime Safely

- Move a whole layer when its keyframes should move with it.
- Trim visibility without silently rescaling animation keyframes.
- Change `duration` when pacing changes; verify percentage keyframes after the edit.
- Keep narration-aligned entrances on their spoken phrase.
- Preserve audio `start` through save/reload and export.
- Import the same video under two aliases if simultaneous clips need different source times.

After changes, scrub cut boundaries, transitions, clip starts/ends, and the final frame. Confirm track assignments and timing survive parse/serialize/parse.
