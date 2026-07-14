# Motionly Quick Start

## Run Motionly

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Edit A Project

1. Select a layer in Scene or click a visible object on the canvas.
2. Drag the object or use Position, Scale, Rotation, and Opacity in Properties.
3. For text, change the content, font size, or color.
4. Choose an animation preset and tune Duration, Delay, and Easing.
5. Press Play or scrub the timeline to review each frame.
6. Drag clip edges in the timeline to adjust when a layer starts or ends.
7. Click Save. An opened file overwrites through its file handle; the server-loaded sample overwrites `video-motion/motionly.motion` during local development.

Motionly serializes visual changes back to `.motion` automatically.

## Add Text Or Audio

- Click Text in the Scene panel to add a text layer.
- Click Audio in the timeline toolbar to attach an audio file for preview.

Audio attachment currently lasts for the browser session, is not stored in `.motion`, and is not included in export.

## Export MP4

Click Export MP4 in the top toolbar. Motionly exports at the project's current resolution and FPS.

Export currently runs in real time, requires browser MP4 recording support, and does not include audio yet.

## Source View

Click `.motion` to inspect the generated source. Normal editing should happen through the visual controls.
