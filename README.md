# Motionly

Motionly is a code-first motion graphics tool for creating, previewing, and exporting professional animations.

Compositions are TypeScript modules that create semantic HTML/SVG and choreograph it with caller-owned GSAP timelines. The editor mounts the composition directly, so playback, seeking, scene navigation, visual overrides, and export all observe the same runtime state.

## Architecture

```text
TypeScript composition
        ↓
Scenes and components
        ↓
GSAP timeline
        ↓
HTML / SVG
        ↓
Preview and export
```

## Start

```bash
npm install
npm run dev
```

Use the Presets panel to load the product film, Play/Pause/Restart in the timeline, drag the scrubber, select an element on the canvas, and adjust its visual properties. The TypeScript tab links the visible composition to `src/compositions/demo.ts`.

## Composition contract

```ts
export const productFilm: CompositionDefinition = {
  id: 'product-film',
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 27,
  scenes,
  build({ root, timeline, register }) {
    const title = register('title', document.createElement('h1'));
    root.append(title);
    textReveal(timeline, title, { unit: 'chars', at: 0.2 });
  },
};
```

Motion helpers live in `src/composition/presets.ts`. They add tweens to the timeline passed by the composition and remain deterministic under seek.

## Commands

- `npm run type-check`
- `npm run test:run`
- `npm run build`
- `npm run qa:editor`
