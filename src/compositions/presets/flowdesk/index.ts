import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import * as timelineModule from "./timeline.js";

export const FLOWDESK_PRESET_DURATION = 32.0;

const scenes: readonly SceneDefinition[] = [
  {
    id: "scene-01-hook",
    label: "01 · The Inbox Problem",
    start: 0,
    duration: 5.5,
    accent: "#4f46e5",
    tracks: [
      {
        id: "beat1",
        label: "Headline: Your support inbox shouldn’t run your business",
        kind: "Text",
        start: 0.1,
        end: 5.5,
      },
      { id: "dp1", label: "Drum: Email →", kind: "Text", start: 1.2, end: 5.5 },
      {
        id: "dp2",
        label: "Drum: Live Chat →",
        kind: "Text",
        start: 2.0,
        end: 5.5,
      },
      {
        id: "dp3",
        label: "Drum: Billing Inquiries →",
        kind: "Text",
        start: 2.8,
        end: 5.5,
      },
      { id: "dp4", label: "Drum: Chaos.", kind: "Text", start: 3.6, end: 5.5 },
    ],
  },
  {
    id: "scene-02-friction",
    label: "02 · The Friction of Growth",
    start: 5.5,
    duration: 6.5,
    accent: "#ef4444",
    tracks: [
      {
        id: "frictionTitleWrap",
        label: "Stop sorting. Start solving.",
        kind: "Text",
        start: 5.6,
        end: 12.0,
      },
      {
        id: "card1",
        label: "Urgent Billing: Double Charge ($299)",
        kind: "Element",
        start: 6.2,
        end: 12.0,
      },
      {
        id: "card2",
        label: "Order Issue: Where is my order?",
        kind: "Element",
        start: 7.0,
        end: 12.0,
      },
      {
        id: "card3",
        label: "Retention: Subscription Cancellation",
        kind: "Element",
        start: 7.8,
        end: 12.0,
      },
    ],
  },
  {
    id: "scene-03-workspace",
    label: "03 · Intelligent Triage",
    start: 12.0,
    duration: 6.8,
    accent: "#3b82f6",
    tracks: [
      {
        id: "workspaceWindow",
        label: "Mac Desktop Application Window",
        kind: "Element",
        start: 12.0,
        end: 26.0,
      },
      {
        id: "rowBilling",
        label: "Auto-Triage Urgent Ticket",
        kind: "Element",
        start: 12.6,
        end: 18.8,
      },
      {
        id: "rowOrders",
        label: "Auto-Routed Orders Ticket",
        kind: "Element",
        start: 12.75,
        end: 18.8,
      },
      {
        id: "rowCancel",
        label: "Queued Retention Ticket",
        kind: "Element",
        start: 12.9,
        end: 18.8,
      },
      {
        id: "cursorHand",
        label: "Styled Pointer Cursor",
        kind: "Element",
        start: 15.0,
        end: 26.0,
      },
    ],
  },
  {
    id: "scene-04-copilot",
    label: "04 · AI Copilot & Resolution",
    start: 18.8,
    duration: 7.6,
    accent: "#10b981",
    tracks: [
      {
        id: "copilotDrawer",
        label: "Flowdesk AI Copilot Drawer",
        kind: "Element",
        start: 18.8,
        end: 26.0,
      },
      {
        id: "stepSurgeFill",
        label: "Nonlinear Step-Surge Progress Bar",
        kind: "Element",
        start: 19.3,
        end: 26.0,
      },
      {
        id: "replyText",
        label: "Streaming Typewriter AI Response",
        kind: "Text",
        start: 20.4,
        end: 26.0,
      },
      {
        id: "approveBtn",
        label: "Approve & Refund Action Pill",
        kind: "Element",
        start: 22.8,
        end: 26.0,
      },
    ],
  },
  {
    id: "scene-05-outro",
    label: "05 · Outro & CTA",
    start: 26.4,
    duration: 5.6,
    accent: "#0f172a",
    tracks: [
      {
        id: "logoLockup",
        label: "Flowdesk Brand Lockup",
        kind: "Element",
        start: 26.5,
        end: 32.0,
      },
      {
        id: "outroTagline",
        label: "Tagline: AI handles the busywork.",
        kind: "Text",
        start: 27.2,
        end: 32.0,
      },
      {
        id: "ctaPill",
        label: "Try Flowdesk → flowdesk.ai",
        kind: "Element",
        start: 27.8,
        end: 32.0,
      },
    ],
  },
];

function mountHtml(root: HTMLElement): void {
  const container = document.createElement("div");
  container.innerHTML = compositionHtml;
  const template = (container.querySelector("#flowdesk-preset-template") ||
    container.querySelector("template")) as HTMLTemplateElement | null;

  if (!template) {
    throw new Error("Missing #flowdesk-preset-template in composition.html");
  }

  root.replaceChildren(template.content.cloneNode(true));
}

export const flowdeskPreset = defineComposition({
  id: "flowdesk-preset",
  title: "Flowdesk · AI Customer Support for Startups",
  description:
    "Production-grade 60s commercial film for Flowdesk. Features free canvas kinetic typography, 2.5D isometric message cascades, authentic Mac SaaS window chrome, step-surge AI drafting, and continuous living motion.",
  duration: FLOWDESK_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    if (typeof timelineModule.buildFlowdeskTimeline === "function") {
      timelineModule.buildFlowdeskTimeline(context);
    }
  },
});
