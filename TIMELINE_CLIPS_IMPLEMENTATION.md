# Timeline Clips Implementation Plan

## Overview
Add drag-and-drop media/audio clips to timeline with full .motion persistence.

## .motion Format Extension

### New Syntax
```motion
# Import assets as usual
import "/assets/video.mp4" as myVideo
import "/assets/audio.mp3" as bgMusic

# Define clips on timeline
clip myVideo {
  track 1
  start 2.5s
  duration 5s
  trimIn 0s
  trimOut 5s
}

clip bgMusic {
  track audio1
  start 0s
  duration 10s
  volume 0.8
  mute false
}
```

### Clip Properties
- `track`: Track number (1, 2, 3...) or name (audio1, audio2...)
- `start`: Start time on timeline
- `duration`: Visible duration (after trim)
- `trimIn`: Trim from start of source media
- `trimOut`: Trim from end of source media
- `volume`: Audio volume (0.0-1.0, default 1.0)
- `mute`: Boolean for audio mute state

## Implementation Phases

### Phase 1: Format & Parser (Tasks 1-5)
1. Add ClipNode to AST types
2. Update parser to recognize `clip` blocks
3. Update serializer to write clips
4. Add clips array to Scene type
5. Update scene graph builder

### Phase 2: UI Drag & Drop (Tasks 6-8)
1. Make asset cards draggable
2. Add timeline drop zones
3. Create clip on drop, update AST
4. Visual feedback (ghost, snap indicators)

### Phase 3: Timeline Rendering (Task 9)
1. Render clip blocks on timeline
2. Show thumbnails for video/image
3. Show waveforms or labels for audio
4. Track organization (visual vs audio)

### Phase 4: Interactions (Task 10)
1. Drag clip to reposition
2. Edge drag for trim
3. Delete clip (button/key)
4. Snap to other clips/grid

### Phase 5: Preview & Export (Tasks 11-12)
1. Render clips in canvas preview
2. Layer compositing in correct order
3. Audio mixing (note complexity)
4. Include in MP4 export

## Simplifications for MVP

**For initial implementation:**
- Clips reference assets by name (must be imported)
- User responsible for keeping source files available
- Simple volume control, no EQ/effects
- Basic audio mixing (single track initially)
- No clip effects/transitions (keep separate from element animations)

**Note to user:**
"Timeline clips reference assets by filename. Keep original files in the same location to reload this project."

## File Structure Changes

### Types
- `src/types/parser.ts` - Add ClipNode
- `src/types/scene.ts` - Add Clip, update Scene

### Language
- `src/language/parser.ts` - Parse clip blocks
- `src/language/serializer.ts` - Serialize clips

### Scene
- `src/scene/scene-graph.ts` - Build clips from AST

### UI
- `src/ui/components/MotionEditor.svelte` - Drag/drop, timeline clips

### Render
- `src/render/canvas-renderer.ts` - Render clips in preview
- `src/export/exporter.ts` - Include clips in export

## Timeline Architecture

### Track System
```
Track 0: Background clips
Track 1: Primary video/images
Track 2: Overlay video/images
Track 3: Text/graphics (existing elements)
Audio 1: Primary audio
Audio 2: Background music
Audio 3: SFX
```

Visual tracks stack bottom-to-top (0 = back, higher = front).
Audio tracks mix additively.

### Clip Data Structure
```typescript
interface Clip {
  id: string;           // Generated unique ID
  assetName: string;    // Reference to imported asset
  track: number | string;
  start: number;        // Timeline start (seconds)
  duration: number;     // Visible duration
  trimIn: number;       // Trim from source start
  trimOut: number;      // Trim from source end
  volume?: number;      // Audio only
  mute?: boolean;       // Audio only
}
```

### Rendering Order
1. Evaluate timeline time
2. Find active clips at current time
3. Sort by track (lowest first)
4. Render each clip's frame at (currentTime - clip.start + clip.trimIn)
5. Layer visual clips via canvas compositing
6. Mix audio clips additively

## Current Limitations

**Audio Export:**
- MP4 MediaRecorder may not support audio mixing
- May need WebAudio API → AudioBuffer → encode
- Flag clearly if audio mixing in export needs more work

**Asset Management:**
- No asset bundling/embedding yet
- User must keep original files accessible
- Paths stored as-is (relative recommended)

**Performance:**
- Large video clips may impact preview
- Consider requesting VideoFrame API for efficiency
- Audio waveform generation can be expensive

## Testing Strategy

1. Create clip in .motion manually, verify parsing
2. Serialize clip back, verify format matches
3. Drag asset, verify clip created
4. Save/reload, verify clips persist
5. Preview with clips, verify timing
6. Export with clips, verify inclusion

## Next Steps

Start with Phase 1: Get .motion format and parser working with clip syntax.
Then build UI on top of working persistence layer.
