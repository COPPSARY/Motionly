import { slide, staggerEntrance } from "../src/composition/presets";
import type { CompositionDefinition } from "../src/composition/types";

function requiredElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing composition element: ${selector}`);
  return element;
}

export const productCard: CompositionDefinition = {
  id: "product-card",
  title: "Product card",
  description: "A compact code-first composition.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 5,
  sourcePreview: "examples/product-card.ts",
  scenes: [
    {
      id: "intro",
      label: "Product reveal",
      start: 0,
      duration: 5,
      accent: "#6df6c6",
    },
  ],
  build({ root, timeline, register }) {
    root.innerHTML = `
      <style>
        .example-scene { position:absolute; inset:0; display:grid; place-items:center; background:#070910; color:#f8fafc; font-family:Inter,sans-serif; }
        .example-card { width:760px; padding:64px; border:1px solid #34415b; border-radius:36px; background:#101622; box-shadow:0 42px 120px #0009; }
        .example-card h1 { margin:0; font-size:88px; letter-spacing:-.04em; }
        .example-card p { margin:22px 0 0; color:#aab5c8; font-size:30px; }
        .example-pills { display:flex; gap:14px; margin-top:42px; }
        .example-pills span { padding:12px 18px; border-radius:999px; background:#182337; color:#6df6c6; font-weight:700; }
      </style>
      <section class="example-scene scene" data-scene="intro">
        <article class="example-card">
          <h1>Motionly</h1>
          <p>Motion graphics, like code.</p>
          <div class="example-pills"><span>TypeScript</span><span>GSAP</span><span>HTML/SVG</span></div>
        </article>
      </section>`;

    const scene = requiredElement(root, ".example-scene");
    const card = register(
      "product-card",
      requiredElement(root, ".example-card"),
    );
    const pills = Array.from(
      root.querySelectorAll<HTMLElement>(".example-pills span"),
    );

    timeline.set(scene, { autoAlpha: 1 }, 0);
    slide(timeline, card, {
      direction: "up",
      distance: 72,
      duration: 0.72,
      at: 0.2,
    });
    staggerEntrance(timeline, pills, {
      distance: 28,
      duration: 0.52,
      stagger: 0.07,
      at: 0.62,
    });
  },
};
