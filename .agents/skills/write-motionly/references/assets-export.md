# Assets and export parity

## Use inspectable product assets

Prefer supplied screenshots or recordings, real product HTML/CSS, faithful reconstruction from references, then intentional abstraction when no product exists. Avoid generic dashboards. Frame media so the relevant product state is readable.

## Keep assets origin-clean

Canvas and `VideoFrame` export require origin-clean sources.

- Bundle local images through the asset pipeline.
- Inline fetched images as data URLs before SVG/`foreignObject` rasterization.
- Require valid CORS headers for remote media.
- Prefer SVG data URLs over Blob URLs for SVG with `foreignObject` when Chrome taints Blob-backed canvases.
- Cache embedded conversions during frame export.
- Wait for fonts and image decoding.

For tainted-source errors, inspect every image, CSS background, SVG `<image>`, video, canvas, and ancestor. A visible asset may still be unsafe to encode.

## Preserve preview/export parity

- Mount the same DOM and seek the same GSAP timeline.
- Use timeline time, never wall-clock callbacks.
- Avoid independent CSS transitions after seeking.
- Seek frames as `frameIndex / fps`.
- Restore original time and playback state.
- Use exact encoder timestamps and frame durations.

Changing 24 to 60 fps increases smoothness and render cost, not duration. Use an H.264 profile supported at the requested resolution and rate.

## Prevent end-state artifacts

- Hide retired screenshots with `display: none`.
- Clear `filter` and `backdrop-filter` when a shell becomes a logo.
- Replace window shadows with an intentional token shadow.
- Reset obsolete nested transforms.
- Ensure transparent faces are not composited behind the logo.
- Inspect final exported frames, not only preview.

## Repository GIFs

Derive a small GIF from the master MP4 using a palette-based two-pass conversion, moderate display width, and reduced showcase fps. GIF is documentation media, not the production export. Keep the MP4 master unless repository policy requires removal.
