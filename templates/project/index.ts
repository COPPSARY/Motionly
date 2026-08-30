import { defineComposition } from "../../src/composition/types";
import compositionHtml from "./composition.html?raw";
import { buildTimeline } from "./timeline.js";

export const composition = defineComposition({
  id: "starter",
  title: "Connected product story",
  description: "HTML/CSS composition with a caller-owned GSAP timeline.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 6,
  sourcePreview: compositionHtml,
  scenes: [
    {
      id: "hero",
      label: "Promise",
      start: 0,
      duration: 3.1,
      accent: "#d8ff55",
    },
    {
      id: "proof",
      label: "Proof",
      start: 2.5,
      duration: 3.5,
      accent: "#8b6cff",
    },
  ],
  build(context) {
    const documentNode = new DOMParser().parseFromString(
      compositionHtml,
      "text/html",
    );
    const template = documentNode.querySelector("#starter-template");
    if (!(template instanceof HTMLTemplateElement))
      throw new Error("Starter template was not found.");
    context.root.replaceChildren(template.content.cloneNode(true));
    buildTimeline(context);
  },
});
