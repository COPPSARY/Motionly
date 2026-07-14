# Motionly Roadmap

Motionly's priority is a simple, reliable visual editor for `.motion`. Roadmap items are ordered by user value and dependency, not by novelty.

## Now: Stabilize The Core Editor

- [x] Centered canvas preview with correct aspect ratio
- [x] Play, pause, reset, scrubber, timecode, and frame display
- [x] Fit, zoom, and fullscreen preview
- [x] Scene list and direct canvas selection
- [x] Drag-to-move and corner scaling
- [x] Visual transform, opacity, text, color, timing, and easing controls
- [x] Add text and delete selected layers
- [x] Resizable multi-layer timeline with clip ranges and trim handles
- [x] Audio attachment, preview synchronization, and timeline row
- [x] Open, edit, serialize, and save `.motion` projects
- [x] Browser-supported MP4 export with progress
- [ ] Improve preview and export frame pacing on longer projects
- [ ] Make selection, trimming, saving, and export errors clearer
- [ ] Add focused editor workflow and MP4 output tests
- [ ] Continue accessibility, responsive layout, and interaction polish

## Next: Canvas And Export Controls

- [ ] Visual canvas settings for resolution, duration, and FPS
- [ ] Aspect-ratio presets for 16:9, 9:16, 1:1, and 4:5
- [ ] Custom canvas width and height with aspect-ratio locking
- [ ] Export resolution presets for 720p, 1080p, 1440p, and 4K
- [ ] Export FPS choices such as 24, 30, and 60 FPS
- [ ] Deterministic MP4 frame capture with reliable duration and audio sync
- [ ] Include attached audio in MP4 export
- [ ] WebM export
- [ ] GIF export for short lightweight animations
- [ ] PNG frame and image-sequence export
- [ ] Still-frame PNG export

## Next: Media In The Timeline

- [ ] Add images and SVGs from the UI
- [ ] Add video clips from the UI
- [ ] Add and persist audio tracks in the project
- [ ] Show media thumbnails and audio waveforms on timeline clips
- [ ] Drag clips to change their start time
- [ ] Trim image, video, and audio duration from either edge
- [ ] Set video in/out points and audio offsets
- [ ] Add basic mute, volume, fit, fill, and crop controls
- [ ] Keep imported media references portable and explicit in `.motion`

## Animation And Editing Quality

- [ ] Improve existing preset timing, easing, exits, and interruption behavior
- [ ] Add a small curated set of text, logo, media, and scene transitions
- [ ] Add visual entrance and exit controls without exposing preset syntax
- [ ] Add reusable transition controls between scenes
- [ ] Improve snapping, alignment guides, keyboard movement, and rotation handles
- [ ] Improve timeline zoom, clip movement, key timing, and multi-selection
- [ ] Add undo and redo before expanding advanced editing
- [ ] Keep presets purposeful; do not build a huge library of minor variations

## Hosted App And Sandbox

- [ ] Deploy a hosted Motionly editor that works without local setup
- [ ] Provide a safe browser sandbox with sample projects and temporary uploads
- [ ] Support shareable read-only previews
- [ ] Add project persistence only after storage, privacy, and deletion rules are clear
- [ ] Keep local/self-hosted use fully supported

## Optional AI-Assisted Drafting

This comes after visual editing, media, and export are dependable.

- [ ] Let users connect an external AI provider or existing agent through a user-supplied API key
- [ ] Keep provider credentials local or session-only by default
- [ ] Generate a first `.motion` draft from a prompt, script, or asset list
- [ ] Open generated output as a normal editable project instead of a black-box video
- [ ] Validate generated `.motion` and show proposed changes before replacing the current project
- [ ] Keep AI optional; Motionly should not require its own hosted agent
- [ ] Document the existing `.agents/skills/write-motionly` workflow for local agent tools

## Later, Not Near-Term

- Node graphs
- Plugin systems or marketplaces
- Advanced compositing pipelines
- Large preset marketplaces
- Multi-user real-time collaboration
- Training or hosting a proprietary Motionly model

Last updated: 2026-07-14
