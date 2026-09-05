import {
  defineComposition,
  type CompositionContext,
  type SceneDefinition,
} from "../../../composition/types";
import compositionHtml from "./composition.html?raw";
import * as timelineModule from "./timeline.js";

export const AI_NOTES_PRESET_DURATION = 16.0;

const scenes: readonly SceneDefinition[] = [
  {
    id: "scene-01-thought-hook",
    label: "01 · Context Evaporates",
    start: 0,
    duration: 3.8,
    accent: "#6366f1",
    tracks: [
      {
        id: "hookThought1",
        label: "Editorial: Meetings end. Context evaporates.",
        kind: "Text",
        start: 0.1,
        end: 2.0,
      },
      {
        id: "hookThought2",
        label: "Editorial: What if your notes wrote themselves?",
        kind: "Text",
        start: 1.8,
        end: 3.8,
      },
    ],
  },
  {
    id: "scene-02-live-recording",
    label: "02 · Live Audio & Speaker Capture",
    start: 3.8,
    duration: 4.4,
    accent: "#f43f5e",
    tracks: [
      {
        id: "appWindow",
        label: "Native macOS Scribe Stage",
        kind: "Element",
        start: 3.3,
        end: 13.5,
      },
      {
        id: "waveformCard",
        label: "Multi-Channel Audio Waveform",
        kind: "Element",
        start: 3.8,
        end: 8.4,
      },
      {
        id: "transcriptBubble",
        label: "Live Speaker Transcript",
        kind: "Element",
        start: 4.1,
        end: 8.4,
      },
      {
        id: "synthesizeBtn",
        label: "Synthesize Action Items CTA",
        kind: "Element",
        start: 3.8,
        end: 8.4,
      },
      {
        id: "scribeCursor",
        label: "Canonical Oversized Cursor (Tip-Targeted Tap)",
        kind: "Element",
        start: 6.0,
        end: 8.2,
      },
    ],
  },
  {
    id: "scene-03-ai-synthesis",
    label: "03 · Real-Time Structured Synthesis",
    start: 8.2,
    duration: 4.6,
    accent: "#10b981",
    tracks: [
      {
        id: "decisionsCard",
        label: "Approved Decisions Log",
        kind: "Element",
        start: 8.6,
        end: 13.5,
      },
      {
        id: "actionsCard",
        label: "Assigned Action Items & Owners",
        kind: "Element",
        start: 8.6,
        end: 13.5,
      },
      {
        id: "statHeroCard",
        label: "98% Context Accuracy Counter",
        kind: "Element",
        start: 8.8,
        end: 13.5,
      },
      {
        id: "sentimentCard",
        label: "Meeting Sentiment & Focus Bar",
        kind: "Element",
        start: 8.8,
        end: 13.5,
      },
    ],
  },
  {
    id: "scene-04-payoff",
    label: "04 · Ambient Focus Payoff",
    start: 12.8,
    duration: 3.2,
    accent: "#a855f7",
    tracks: [
      {
        id: "payoffThought",
        label:
          "Payoff: Focus on the conversation. Scribe captures the decisions.",
        kind: "Text",
        start: 12.8,
        end: 16.0,
      },
    ],
  },
];

function mountHtml(root: HTMLElement): void {
  const container = document.createElement("div");
  container.innerHTML = compositionHtml;
  const template = (container.querySelector("#ai-notes-preset-template") ||
    container.querySelector("template")) as HTMLTemplateElement | null;

  if (!template) {
    throw new Error("Missing #ai-notes-preset-template in composition.html");
  }

  root.replaceChildren(template.content.cloneNode(true));
}

export const aiNotesPreset = defineComposition({
  id: "ai-notes-preset",
  title: "Scribe AI · Ambient Meeting Intelligence",
  description:
    "Flagship SaaS product motion graphic for an AI note-taking assistant. Features giant-to-settle kinetic hooks, cutTheCurve partial travel seams, live 48kHz audio waveform stream, speaker identification, canonical oversized cursor tip-targeted tap, audio-to-markdown shape morph, stepSurgeCounter 98% accuracy surge, and inverseZoomThrough payoff.",
  duration: AI_NOTES_PRESET_DURATION,
  fps: 60,
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  sourcePreview: compositionHtml,
  scenes,
  build(context: CompositionContext) {
    mountHtml(context.root);
    if (typeof timelineModule.buildAiNotesTimeline === "function") {
      timelineModule.buildAiNotesTimeline(context);
    }
  },
});
