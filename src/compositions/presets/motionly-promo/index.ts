import {
  defineComposition,
  type CompositionContext,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import { buildPromoTimeline } from "./timeline.js";

const scenes = [
  {
    id: "brand",
    label: "Web-native manifesto",
    start: 0,
    duration: 6.4,
    accent: "#d8ff55",
  },
  {
    id: "code",
    label: "Code becomes motion",
    start: 6.4,
    duration: 5,
    accent: "#8b6cff",
  },
  {
    id: "studio",
    label: "Everything stays editable",
    start: 11.4,
    duration: 4.6,
    accent: "#ff705e",
  },
  {
    id: "lab",
    label: "Composition system",
    start: 16,
    duration: 5.2,
    accent: "#5eead4",
  },
  {
    id: "cta",
    label: "Make it move",
    start: 21.2,
    duration: 5.8,
    accent: "#d8ff55",
  },
] as const;

function mountHtmlComposition(context: CompositionContext): void {
  const documentNode = new DOMParser().parseFromString(
    compositionHtml,
    "text/html",
  );
  const template = documentNode.querySelector<HTMLTemplateElement>(
    "#motionly-promo-template",
  );
  if (!template) throw new Error("Motionly promo template was not found.");
  context.root.replaceChildren(template.content.cloneNode(true));
}

export const motionlyPromoPreset = defineComposition({
  id: "motionly-product-promo",
  title: "Motionly — Make it move",
  description:
    "A 27-second HTML/CSS product film animated by a seekable GSAP timeline.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 27,
  scenes,
  sourcePreview: compositionHtml,
  build(context) {
    mountHtmlComposition(context);
    buildPromoTimeline(context);
  },
});
