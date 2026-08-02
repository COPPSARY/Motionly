# Motionly Production Checklist

## Before Writing

- identify the message, audience, CTA, duration, aspect ratio, FPS, and audio rule;
- preserve supplied copy and asset paths;
- inventory every asset's dimensions, ratio, format, and duration;
- decide which asset is the subject and which are support;
- decide whether the film is scene-based, beat-based, or both;
- choose a layout/component/showcase before any hand coordinates.

## During Authoring

- use one focal subject per shot;
- keep display typography large and intentional;
- use real screenshots/video 1:1 instead of redrawing the product UI;
- use `identity` for recurring logos, cards, dashboards, or media;
- use `clear` only when content must genuinely close;
- give every enter and exit a complete route;
- leave a readable hold after text or UI settles;
- use one dominant transition direction and vary motion by asset role;
- never add decorative labels just to fill empty space;
- never use the same zoom/pan treatment on every media asset;
- never stack opacity fades, wipes, blur, and zoom to disguise missing continuity.

## Boundary Review

Capture one frame before, at, and after every scene/beat boundary. Check for:

- stale outgoing elements;
- double exposure from an object that is already hidden or cleared;
- blank frame or uncovered background;
- cropped headline or media;
- incoming subject arriving before the outgoing subject leaves;
- identity handoff that restarts instead of transforming;
- transition direction that conflicts with the preceding motion.

## Media Review

Prove the first, middle, and final decoded frame of every video/GIF/Lottie/SVG.
For exact UI showcases, use the imported screenshot or video with a crop/focus
path. Do not reconstruct a close-up using separate approximate UI pieces.

## Validation

```bash
npm run inspect:motion -- project.motion --strict
npm run type-check
npx vitest run tests/language tests/motion-system tests/semantic
git diff --check
```

The inspector is a structural gate, not visual approval. Visual approval means
scrubbing representative frames in the browser and checking that the actual
media, text hierarchy, exits, transitions, and final hold read correctly.
