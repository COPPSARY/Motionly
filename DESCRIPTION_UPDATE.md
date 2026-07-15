# Description Alignment Update

## Summary
Updated README.md and docs/introduction.mdx to match the onboarding description from `src/ui/Onboarding.svelte`.

## Changes Made

### 1. README.md Header Tagline
**Before:**
```
A lightweight visual editor and renderer for polished motion graphics.
Create the scene. Tune the motion. Export the result.
```

**After:**
```
AI generates an editable project instead of a finished video.
What AI makes is a starting point you can actually direct.
```

### 2. README.md Overview Section
**Before:**
- Longer, more technical explanation
- Included quote callout
- More developer-focused language

**After:**
```
Motionly is an AI-native motion graphics editor. AI generates an editable 
project instead of a finished video, then you refine it visually—drag, scale, 
tune timing, scrub, and export.

Underneath, every project is a plain, readable `.motion` file. What AI makes 
is a starting point you can actually direct.
```

### 3. docs/introduction.mdx
**Before:**
- Description: "Motionly is an AI-native editor that turns generated motion graphics into projects you can direct and refine."
- Body: Longer explanation with comparison to other tools

**After:**
- Description: "Motionly is an AI-native motion graphics editor. AI generates an editable project instead of a finished video, then you refine it visually."
- Body: Matches onboarding verbatim
- Updated feature list to include timeline clips and new UI

## Source of Truth
All descriptions now match `src/ui/Onboarding.svelte` step 1:
```
Motionly is an AI-native motion graphics editor. AI generates an editable 
project instead of a finished video, then you refine it visually—drag, scale, 
tune timing, scrub, and export.

Underneath, every project is a plain, readable .motion file. What AI makes 
is a starting point you can actually direct.
```

## Consistency
✅ Onboarding (Onboarding.svelte)
✅ README.md header
✅ README.md Overview
✅ docs/introduction.mdx

All now use the same clear, concise messaging focused on:
1. AI-native approach
2. Editable projects, not finished videos
3. `.motion` as the plain, readable format
4. AI as a starting point you direct

## Build Status
✅ Build successful (npm run build)
✅ No errors
✅ 376.33 kB JS, 43.96 kB CSS
