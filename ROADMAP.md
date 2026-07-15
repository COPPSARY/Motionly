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

- [x] Add images and SVGs from the UI (drag-and-drop from Assets panel)
- [x] Add video clips from the UI (drag-and-drop from Assets panel)
- [x] Add and persist audio tracks in the project (audio blocks in .motion)
- [x] Show media thumbnails on timeline clips
- [x] Keep imported media references portable and explicit in `.motion` (clip blocks)
- [ ] Show audio waveforms on timeline clips
- [ ] Drag clips to change their start time
- [ ] Trim image, video, and audio duration from either edge
- [ ] Set video in/out points and audio offsets
- [ ] Add basic mute, volume, fit, fill, and crop controls for clips

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

- [x] Let users connect OpenAI, Anthropic, OpenRouter, Google Gemini, Hugging Face, or a custom compatible endpoint with their own key and model choice
- [x] Keep provider credentials in browser storage and send requests directly to the provider
- [x] Generate a `.motion` draft from a prompt, current project, conversation, and local asset list
- [x] Open generated output as a normal editable project instead of a black-box video
- [x] Validate generated `.motion` before replacing the current project
- [x] Keep AI optional; Motionly does not require its own hosted agent
- [x] Document the in-app assistant and `.agents/skills/write-motionly` workflow
- [ ] Add optional asset uploads directly from the chat composer

## Later, Not Near-Term

- Node graphs
- Plugin systems or marketplaces
- Advanced compositing pipelines
- Large preset marketplaces
- Multi-user real-time collaboration
- Training or hosting a proprietary Motionly model

Last updated: 2026-07-15
