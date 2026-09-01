import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import logoUrl from "./logo.svg?url";
import uiScreenshotUrl from "./ui-screenshot.png?url";
import { buildPromoTimeline } from "./timeline.js";
import {
  MOTIONLY_PROMO_DURATION,
  MOTIONLY_PROMO_RETIME_FACTOR,
} from "./timing";

const authoredScenes: readonly SceneDefinition[] = [
  {
    id: "problem",
    label: "The startup video dilemma",
    start: 0,
    duration: 16.25,
    accent: "#ff705e",
    tracks: [
      {
        id: "problem-morph-frame",
        label: "Editorial card background",
        kind: "Background",
        start: 0.04,
        end: 10.2,
      },
      {
        id: "editorial-beat-1-text",
        label: "Startups need launch videos",
        kind: "Text",
        start: 0.04,
        end: 1.75,
      },
      {
        id: "editorial-beat-2-text",
        label: "Making them is too hard",
        kind: "Text",
        start: 1.75,
        end: 3.15,
      },
      {
        id: "editorial-beat-3-text",
        label: "Agencies are too expensive",
        kind: "Text",
        start: 3.0,
        end: 4.22,
      },
      {
        id: "coin-price-digits",
        label: "Agency quote ($1,000+)",
        kind: "Text",
        start: 5.2,
        end: 6.6,
      },
      {
        id: "coin-price-kicker",
        label: "Agency quote kicker",
        kind: "Text",
        start: 5.2,
        end: 6.6,
      },
      {
        id: "coin-inner-details",
        label: "Agency quote coin capsule",
        kind: "Element",
        start: 4.25,
        end: 6.6,
      },
      {
        id: "editorial-beat-4-text",
        label: "AI tools are a mystery box",
        kind: "Text",
        start: 7.75,
        end: 9.02,
      },
      {
        id: "editorial-beat-5a-text",
        label: "You can't edit anything",
        kind: "Text",
        start: 10.45,
        end: 11.9,
      },
      {
        id: "editorial-beat-5b-text",
        label: "You need to reprompt",
        kind: "Text",
        start: 11.8,
        end: 13.25,
      },
      {
        id: "editorial-beat-6-text",
        label: "Wasting hours & burning credits",
        kind: "Text",
        start: 13.15,
        end: 14.45,
      },
    ],
  },
  {
    id: "intro",
    label: "Introducing Motionly",
    start: 16.25,
    duration: 7.75,
    accent: "#38ef7d",
    tracks: [
      {
        id: "intro-word-prefix",
        label: "Introducing",
        kind: "Text",
        start: 0.2,
        end: 4.48,
      },
      {
        id: "intro-brand-name",
        label: "Motionly",
        kind: "Text",
        start: 1.85,
        end: 7.75,
      },
      {
        id: "intro-rest-statement",
        label: "On-demand launch videos",
        kind: "Text",
        start: 5.4,
        end: 7.75,
      },
      {
        id: "intro-logo-box",
        label: "Motionly logo",
        kind: "SVG",
        start: 0.2,
        end: 4.48,
      },
      {
        id: "ambient-waves",
        label: "Background waves",
        kind: "SVG",
        start: 0.0,
        end: 7.75,
      },
    ],
  },
  {
    id: "solutions",
    label: "On-demand launch videos",
    start: 24.0,
    duration: 6.95,
    accent: "#5ce0d0",
    tracks: [
      {
        id: "witty-bg-curtain",
        label: "Mint scene background",
        kind: "Background",
        start: 1.75,
        end: 6.95,
      },
      {
        id: "editorial-sol-2-text",
        label: "Prompt like AI, edit every layer",
        kind: "Text",
        start: 0.0,
        end: 1.98,
      },
      {
        id: "editorial-seriously-text",
        label: "Seriously.",
        kind: "Text",
        start: 1.85,
        end: 3.45,
      },
      {
        id: "editorial-ui-promise-text",
        label: "We have a UI to edit everything",
        kind: "Text",
        start: 3.35,
        end: 5.18,
      },
      {
        id: "editorial-or-text",
        label: "Or...",
        kind: "Text",
        start: 5.0,
        end: 6.17,
      },
      {
        id: "editorial-keep-prompting-text",
        label: "...keep prompting.",
        kind: "Text",
        start: 6.1,
        end: 6.95,
      },
    ],
  },
  {
    id: "product",
    label: "Prompt to editable workspace",
    start: 30.95,
    duration: 4.65,
    accent: "#7657ff",
    tracks: [
      {
        id: "face-prompt",
        label: "Command prompt pill",
        kind: "Element",
        start: 0.25,
        end: 2.12,
      },
      {
        id: "build-question",
        label: "Product launch ad prompt",
        kind: "Text",
        start: 0.45,
        end: 1.35,
      },
      {
        id: "generate-button",
        label: "Generate button",
        kind: "Element",
        start: 1.35,
        end: 1.55,
      },
      {
        id: "product-screenshot",
        label: "Interactive workspace preview",
        kind: "Element",
        start: 2.13,
        end: 4.65,
      },
      {
        id: "morph-shell",
        label: "Workspace morph frame",
        kind: "Element",
        start: 0.0,
        end: 4.35,
      },
    ],
  },
  {
    id: "cta",
    label: "Type generate edit",
    start: 35.3,
    duration: 3.7,
    accent: "#caff45",
    tracks: [
      {
        id: "face-brand-token",
        label: "Motionly brand token",
        kind: "SVG",
        start: 0.3,
        end: 3.7,
      },
      {
        id: "final-headline",
        label: "Video Generated by Motionly",
        kind: "Text",
        start: 0.25,
        end: 3.7,
      },
      {
        id: "final-cta",
        label: "Visit motionly.site",
        kind: "Element",
        start: 0.85,
        end: 3.7,
      },
    ],
  },
];

const scenes: readonly SceneDefinition[] = authoredScenes.map((scene) => ({
  ...scene,
  start: scene.start * MOTIONLY_PROMO_RETIME_FACTOR,
  duration: scene.duration * MOTIONLY_PROMO_RETIME_FACTOR,
  tracks: scene.tracks?.map((track) => ({
    ...track,
    start: track.start * MOTIONLY_PROMO_RETIME_FACTOR,
    end: track.end * MOTIONLY_PROMO_RETIME_FACTOR,
  })),
}));

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
  fps: 60,
  duration: MOTIONLY_PROMO_DURATION,
  scenes,
  sourcePreview: compositionHtml,
  build(context) {
    mountHtmlComposition(context);
    buildPromoTimeline(context);
  },
});
