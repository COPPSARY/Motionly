import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import logoUrl from "./logo.svg?url";
import uiScreenshotUrl from "./ui-screenshot.png?url";
import { buildPromoTimeline } from "./timeline.js";

const scenes: readonly SceneDefinition[] = [
  {
    id: "problem",
    label: "The startup video dilemma",
    start: 0,
    duration: 6.6,
    accent: "#ff705e",
    tracks: [
      {
        id: "editorial-beat-1",
        label: "Startups need launch videos",
        kind: "Text",
        start: 0.08,
        end: 1.6,
      },
      {
        id: "editorial-beat-2",
        label: "Making them is too hard",
        kind: "Text",
        start: 1.65,
        end: 3.15,
      },
      {
        id: "editorial-beat-3",
        label: "Agencies are too expensive",
        kind: "Text",
        start: 3.0,
        end: 3.9,
      },
      {
        id: "editorial-beat-4",
        label: "AI tools are a mystery box",
        kind: "Text",
        start: 6.3,
        end: 7.2,
      },
      {
        id: "editorial-beat-5",
        label: "You can't edit, need to reprompt",
        kind: "Text",
        start: 9.3,
        end: 10.5,
      },
      {
        id: "editorial-beat-6",
        label: "Wasting hours & burning credits",
        kind: "Text",
        start: 10.75,
        end: 11.8,
      },
    ],
  },
  {
    id: "intro",
    label: "Introducing Motionly",
    start: 12.0,
    duration: 6.2,
    accent: "#38ef7d",
    tracks: [
      {
        id: "intro-hero-beat",
        label: "Introducing Motionly",
        kind: "Text",
        start: 0.0,
        end: 4.2,
      },
      {
        id: "intro-brand-name",
        label: "Motionly brand zoom",
        kind: "Text",
        start: 4.2,
        end: 6.2,
      },
      {
        id: "ambient-waves",
        label: "Fluid wave canvas",
        kind: "SVG",
        start: 0.0,
        end: 6.2,
      },
    ],
  },
  {
    id: "solutions",
    label: "On-demand launch videos",
    start: 16.8,
    duration: 11.4,
    accent: "#5ce0d0",
    tracks: [
      {
        id: "intro-rest-statement",
        label: "Delivers on-demand videos",
        kind: "Text",
        start: 0.8,
        end: 2.8,
      },
      {
        id: "editorial-sol-2",
        label: "Prompt like AI, edit every layer",
        kind: "Text",
        start: 3.1,
        end: 5.1,
      },
      {
        id: "editorial-seriously",
        label: "Seriously.",
        kind: "Text",
        start: 5.3,
        end: 6.7,
      },
      {
        id: "editorial-ui-promise",
        label: "We have a UI to edit everything",
        kind: "Text",
        start: 7.0,
        end: 8.7,
      },
      {
        id: "editorial-or",
        label: "Or...",
        kind: "Text",
        start: 9.0,
        end: 10.0,
      },
      {
        id: "editorial-keep-prompting",
        label: "...keep prompting.",
        kind: "Text",
        start: 10.2,
        end: 11.4,
      },
    ],
  },
  {
    id: "product",
    label: "Prompt to editable workspace",
    start: 28.3,
    duration: 4.7,
    accent: "#7657ff",
    tracks: [
      {
        id: "face-prompt",
        label: "Command prompt pill",
        kind: "Element",
        start: 0.0,
        end: 1.8,
      },
      {
        id: "build-question",
        label: "Product launch ad prompt",
        kind: "Text",
        start: 0.4,
        end: 1.8,
      },
      {
        id: "generate-button",
        label: "Generate button",
        kind: "Element",
        start: 1.3,
        end: 1.8,
      },
      {
        id: "product-screenshot",
        label: "Interactive workspace preview",
        kind: "Element",
        start: 1.8,
        end: 4.7,
      },
      {
        id: "morph-shell",
        label: "Workspace morph frame",
        kind: "Element",
        start: 0.0,
        end: 4.7,
      },
    ],
  },
  {
    id: "cta",
    label: "Type generate edit",
    start: 33.0,
    duration: 3.0,
    accent: "#caff45",
    tracks: [
      {
        id: "face-brand-token",
        label: "Motionly brand token",
        kind: "SVG",
        start: 0.0,
        end: 3.0,
      },
      {
        id: "final-headline",
        label: "Make your product move",
        kind: "Text",
        start: 0.05,
        end: 3.0,
      },
      {
        id: "final-cta",
        label: "Get started button",
        kind: "Element",
        start: 0.3,
        end: 3.0,
      },
    ],
  },
];

function mountHtmlComposition(context: CompositionContext): void {
  const html = compositionHtml
    .replaceAll("__MOTIONLY_LOGO__", logoUrl)
    .replaceAll("__MOTIONLY_UI__", uiScreenshotUrl);
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const template = documentNode.querySelector<HTMLTemplateElement>(
    "#motionly-promo-template",
  );
  if (!template) throw new Error("Motionly promo template was not found.");
  context.root.replaceChildren(template.content.cloneNode(true));
}

export const motionlyPromoPreset = defineComposition({
  id: "motionly-product-promo",
  title: "Motionly - Make your product move",
  description:
    "A kinetic SaaS product film with word-by-word editorial typography, witty founder storytelling, and clean prompt-to-workspace morphing.",
  width: 1920,
  height: 1080,
  fps: 24,
  duration: 39,
  scenes,
  sourcePreview: compositionHtml,
  build(context) {
    mountHtmlComposition(context);
    buildPromoTimeline(context);
  },
});
