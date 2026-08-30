import { defineComposition } from "../../src/composition/types";
import compositionHtml from "./composition.html?raw";
import { buildProductCardTimeline } from "./timeline.js";

export const productCard = defineComposition({
  id: "product-card",
  title: "Product card",
  description: "A compact HTML/CSS and GSAP composition.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 5,
  sourcePreview: compositionHtml,
  scenes: [
    {
      id: "intro",
      label: "Product reveal",
      start: 0,
      duration: 5,
      accent: "#6df6c6",
    },
  ],
  build(context) {
    const documentNode = new DOMParser().parseFromString(
      compositionHtml,
      "text/html",
    );
    const template = documentNode.querySelector("#product-card-template");
    if (!(template instanceof HTMLTemplateElement))
      throw new Error("Product card template was not found.");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildProductCardTimeline(context);
  },
});
