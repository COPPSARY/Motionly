<div align="center">
  <h1>
    <img src="public/logo.svg" alt="Motionly Logo" width="48" height="48" valign="middle">
    <span valign="middle">Motionly</span>
  </h1>

  <p>
    <strong>Code-first motion graphics editor</strong><br>
    Create professional HTML/SVG animations with TypeScript and GSAP, then refine them visually.
  </p>

<p align="center">
  <img src="https://img.shields.io/badge/Supported_by-ff4b4b?style=for-the-badge" alt="Supported by" valign="middle">
  <a href="https://www.kiritts.com/">
    <img src="https://www.kiritts.com/logo.svg" alt="KiriTTS Logo" width="28" height="28" valign="middle">
    <font size="5" valign="middle"><b>KiriTTS</b></font>
  </a>
</p>
</div>

<p align="center">
  <a href="https://www.npmjs.com/package/@coppsary/motionly">
    <img src="https://img.shields.io/npm/dm/%40coppsary%2Fmotionly?style=flat&logo=npm&logoColor=white" alt="npm Downloads">
  </a>
  <a href="docs/introduction.md"><img src="https://img.shields.io/badge/Docs-Motionly-7C3AED?style=flat" alt="Documentation"></a>
  <a href="https://github.com/COPPSARY/Motionly"><img src="https://img.shields.io/github/stars/COPPSARY/Motionly?style=flat" alt="GitHub Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=flat" alt="License"></a>
</p>

<p align="center">
  <a href="#showcase">Showcase</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#development">Development</a> &middot;
  <a href="docs/introduction.md">Docs</a>
</p>

---

## Showcase

<table align="center">
<tr>
<th>Animation Preview</th>
</tr>
<tr>
<td align="center">
<img src=".github/assets/showcase-2.gif" alt="Motionly Animation">
</td>
</tr>
</table>

| Visual Editor |
| :---: |
| ![Motionly Editor](.github/assets/screenshot.jpg) |

---

## Features

Motionly combines normal TypeScript authoring with a visual editor, direct HTML/SVG rendering, and professional GSAP timelines.

- Build compositions from semantic HTML and inline SVG
- Choreograph scenes with GSAP timelines, overlap, stagger, masks, text reveals, and camera movement
- Preview, play, pause, restart, and deterministically scrub the same timeline used for export
- Select elements and adjust position, scale, rotation, opacity, and text in the visual editor
- Navigate scenes from the storyboard and inspect their timing on the editor timeline
- Reuse a focused library of composable animation presets without introducing a custom animation language
- Render images and SVG assets directly in the composition DOM
- Export frames from the exact composition shown in the preview

TypeScript compositions are the only project source. Motionly does not convert projects into a second format: preview and export mount the composition directly through the same runtime.

## Architecture

```text
TypeScript Composition
        ↓
Scenes / Components
        ↓
GSAP Timeline
        ↓
HTML / SVG
        ↓
Preview / Export
```

Every project implements one `CompositionDefinition`. Its `build()` function receives the composition root, a caller-owned GSAP timeline, and a registration helper for editor-selectable elements.

```ts
import { textReveal } from './src/composition/presets';
import { defineComposition } from './src/composition/types';

export const composition = defineComposition({
  id: 'product-film',
  title: 'Product Film',
  description: 'A code-first Motionly composition.',
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 8,
  sourcePreview: 'src/compositions/product-film.ts',
  scenes: [
    { id: 'intro', label: 'Intro', start: 0, duration: 8, accent: '#d8ff55' },
  ],
  build({ root, timeline, register }) {
    const title = document.createElement('h1');
    title.textContent = 'Motion graphics, like code.';
    root.append(title);
    register('title', title);

    textReveal(timeline, title, {
      unit: 'words',
      duration: 0.7,
      at: 0.2,
    });
  },
});
```

Reusable motion helpers live in [`src/composition/presets.ts`](src/composition/presets.ts). A complete connected starter composition is available in [`templates/project/composition.ts`](templates/project/composition.ts).

## Quick Start

Requires Node.js `20.19.0` or newer.

```bash
git clone https://github.com/COPPSARY/Motionly.git
cd Motionly
npm install
npm run dev
```

Open the local Vite URL, then use the existing editor to:

1. Play, pause, or restart the composition.
2. Drag the timeline scrubber to seek deterministically.
3. Open scenes from the storyboard.
4. Select an editable object in the preview.
5. Adjust its visual properties in the inspector.
6. Export the current rendered frame.

Start with [`templates/project/composition.ts`](templates/project/composition.ts), or inspect the 27-second product film in [`src/compositions/demo.ts`](src/compositions/demo.ts).

See the [introduction](docs/introduction.md), [architecture guide](docs/architecture.md), [editor guide](docs/editor.md), and [animation presets](docs/animation-presets.md) for the current workflow.

## Development

```bash
git clone https://github.com/COPPSARY/Motionly.git
cd Motionly
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run type-check
npm run test:run
npm run build
npm run qa:editor
```

See [Contributing](CONTRIBUTING.md), the [Roadmap](ROADMAP.md), and the [documentation](docs/introduction.md) for project details.

## License

Licensed under the [Apache License 2.0](LICENSE).

---

<div align="center">
  <p><em>Effortless Animation</em></p>
  <p>
    <a href="https://github.com/COPPSARY">GitHub</a> &middot;
    <a href="https://web.facebook.com/profile.php?id=61567582710788">Facebook</a>
  </p>
</div>
