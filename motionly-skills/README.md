# Motionly Skills

Focused agent skills for creating polished, editable Motionly animations. Install the library with:

```bash
npx skills add https://github.com/COPPSARY/motionly-skills
```

Agents should discover skills from [`llms.txt`](llms.txt) and load only the topics needed for the current task. Start with `motion-dsl`, then add subject skills such as `svg`, `timeline`, or `rendering`.

## Skills

| Skill | Use it for |
| --- | --- |
| `motion-dsl` | Valid `.motion` syntax, parser repair, serialization |
| `svg` | Native SVG/vector artwork and local cinematic motion |
| `animation` | Choreography, presets, keyframes, stagger |
| `easing` | Curves, durations, holds, exit timing |
| `camera` | Global camera versus local object focus |
| `composition` | Hierarchy, spacing, color, scene design |
| `typography` | Titles, captions, kinetic and narration-synced type |
| `transitions` | Wipes, crossfades, scene continuity |
| `timeline` | Tracks, clips, trims, sequencing, audio |
| `assets` | Images, SVG, GIF, video, MOV, Lottie, codecs |
| `rendering` | Preview/export validation and limitations |
| `templates` | Product launches, logo reveals, diagrams, social stats |

Every skill produces editable Motionly source and treats the current parser and renderer as authoritative.
