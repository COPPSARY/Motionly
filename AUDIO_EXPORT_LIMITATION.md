# Timeline Clips - Audio Export Limitation

## Current Status

Timeline clips are fully functional for visual media (images, videos):
- ✅ Drag and drop from Assets panel
- ✅ Persist in .motion files
- ✅ Render in preview at correct times
- ✅ Can be moved and deleted

## Audio Export Limitation

**Audio clips are NOT included in MP4 export yet.**

### Why This Is Complex

The browser's `MediaRecorder` API used for MP4 export:
1. May not support mixing multiple audio tracks
2. Only handles single audio stream input
3. Does not provide low-level audio mixing controls

### What's Needed for Audio Clip Export

To properly export audio clips, we would need:

1. **WebAudio API Integration**
   - Create `AudioContext`
   - Load all audio clips as `AudioBuffer`
   - Schedule clips at correct times with volume/mute
   - Mix to single master track

2. **Synchronization**
   - Sync WebAudio playback with canvas rendering
   - Capture mixed audio during export
   - Feed to MediaRecorder alongside video stream

3. **Alternative: Post-Processing**
   - Export video without audio
   - Generate audio mix separately
   - Combine using ffmpeg.wasm or server-side processing

### Current Workaround

For now, audio clips:
- **DO** persist in .motion files (can save/load projects)
- **DO** render on timeline
- **DON'T** play during preview (only the scene audio plays)
- **DON'T** export to MP4

Users can:
1. Use timeline clips for visual media
2. Use the single `audio` line in .motion for background music
3. Mix audio externally if needed

### Future Implementation

Recommended approach:
1. Start with simple case: single audio clip export
2. Use WebAudio API to schedule and mix clips
3. Capture mixed output with MediaStreamAudioDestinationNode
4. Feed to MediaRecorder
5. Test with multiple clips, volume, mute

Estimated complexity: **Medium-High**
Estimated time: 4-8 hours for full implementation

### References

- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
- [MediaStreamAudioDestinationNode](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamAudioDestinationNode)
