# Motionly User Guide

Motionly lets you open, edit, preview, save, and export `.motion` animations visually.

## Basic Workflow

1. Open a `.motion` project or use the project loaded by the development server.
2. Select a layer from Scene, the canvas, or the timeline.
3. Change its visual properties and animation timing.
4. Preview with Play/Pause or scrub to an exact frame.
5. Save the updated `.motion` project.
6. Export MP4 when the animation is ready.

## Top Toolbar

- Open loads a `.motion` file.
- Save overwrites an opened file when the browser provides a file handle. New or fallback uploads use Save As.
- Export MP4 renders the current project and downloads an MP4.
- The GitHub Star control opens the repository and displays its current star count.

## Preview

The center preview preserves the canvas aspect ratio defined by the project.

- Play/Pause controls playback.
- Reset returns to the first frame.
- The time and frame readout shows the current position.
- Fit centers the full canvas in the available space.
- Zoom controls change the editor view without changing the project.
- Fullscreen gives the preview more room.

Click empty preview space to clear selection. Click a visible image, SVG, or text object to select it. Drag selected objects to move them and use corner handles to scale them.

## Properties

Available controls depend on the selected layer:

- Position X/Y
- Scale and asset width
- Rotation
- Opacity
- Background color for scene overlays
- Text content, font size, and color
- Animation preset
- Duration, delay, and easing

Motionly updates the `.motion` source after each visual edit.

## Timeline

The timeline shows a row and visible clip range for each layer.

- Scrub the ruler to seek.
- Click a row or clip to select its layer.
- Drag the timeline divider to make the timeline taller or shorter.
- Drag a clip's left or right trim handle to adjust its visible range.
- Delete removes the selected layer.
- The playhead marks the current frame across every row.

## Audio

Click Audio in the timeline toolbar to attach an audio file. Playback follows the audio clock and the timeline shows an audio row.

Audio is currently session-based and is not included in MP4 export. Persistent audio references, export audio, waveform editing, offsets, volume, and multi-track audio are roadmap work.

## Animation Presets

The visual editor currently exposes a small entrance set:

- Fade in
- Rise in
- Scale in
- Blur reveal
- Soft drift

Use `power3.out` as the default for restrained motion. Additional presets and scene transitions will be added only when they provide a distinct, reusable motion pattern.

## MP4 Export

Motionly exports video at the canvas resolution and FPS from the current `.motion` project. Attached audio is not included yet.

The current exporter uses browser MP4 recording and renders in real time. Keep the editor tab active during export. Resolution, FPS, aspect-ratio choices, and other export formats are planned.

## `.motion` Source

The `.motion` file remains the saved source of truth. Use the source toggle for inspection or repair, not as the normal editing workflow.
