import gsap from "gsap";
import {
  createDynamicComposition,
  type DynamicCompositionOptions,
} from "../composition/dynamic-compiler";
import type {
  CompositionDefinition,
  SceneDefinition,
} from "../composition/types";
import type { RegistryVariable } from "./types";

export interface ParsedHyperFramesAsset {
  id: string;
  title: string;
  html: string;
  script: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  variables: RegistryVariable[];
  scenes: SceneDefinition[];
}

/**
 * Parses a raw HyperFrames block or component HTML file into Motionly-compatible
 * composition HTML and a GSAP timeline script.
 */
export function parseHyperFramesHtml(rawHtml: string): ParsedHyperFramesAsset {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");

  // Extract variables from data-composition-variables
  let variables: RegistryVariable[] = [];
  const varsAttr =
    doc.documentElement.getAttribute("data-composition-variables") ||
    doc.body?.getAttribute("data-composition-variables");
  if (varsAttr) {
    try {
      variables = JSON.parse(varsAttr);
    } catch {
      // ignore
    }
  }

  // Extract duration, width, height, fps, id, title
  const idAttr =
    doc.documentElement.getAttribute("data-composition-id") ||
    doc
      .querySelector("[data-composition-id]")
      ?.getAttribute("data-composition-id");
  const id =
    idAttr ||
    doc.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
    "hyperframes-asset";

  const title = doc.title || idAttr || "HyperFrames Asset";

  const durationAttr =
    doc.documentElement.getAttribute("data-composition-duration") ||
    doc.querySelector("[data-duration]")?.getAttribute("data-duration");
  const duration = durationAttr ? parseFloat(durationAttr) : 10.0;

  const fpsAttr = doc.querySelector("[data-fps]")?.getAttribute("data-fps");
  const fps = fpsAttr ? parseInt(fpsAttr, 10) : 60;

  // Viewport / canvas dimensions
  let width = 1920;
  let height = 1080;
  const viewportMeta = doc.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    const content = viewportMeta.getAttribute("content") || "";
    const wMatch = /width=(\d+)/.exec(content);
    const hMatch = /height=(\d+)/.exec(content);
    if (wMatch && wMatch[1]) width = parseInt(wMatch[1], 10);
    if (hMatch && hMatch[1]) height = parseInt(hMatch[1], 10);
  }

  // Ensure gsap is available on globalThis for third-party scripts
  if (typeof globalThis !== "undefined") {
    (globalThis as unknown as { gsap?: unknown }).gsap = gsap;
  }
  if (typeof window !== "undefined") {
    (window as unknown as { gsap?: unknown }).gsap = gsap;
  }

  // Extract all inline scripts from both document and any nested templates
  const inlineScripts: string[] = [];

  const templates = Array.from(doc.querySelectorAll("template"));
  for (const tmpl of templates) {
    const tmplScripts = Array.from(
      tmpl.content
        ? tmpl.content.querySelectorAll("script")
        : tmpl.querySelectorAll("script"),
    );
    for (const s of tmplScripts) {
      if (!s.src && s.textContent) {
        inlineScripts.push(s.textContent);
      }
      s.remove();
    }
  }

  const rootScripts = Array.from(doc.querySelectorAll("script"));
  for (const s of rootScripts) {
    if (!s.src && s.textContent) {
      inlineScripts.push(s.textContent);
    }
    s.remove();
  }

  // Extract styles
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.outerHTML)
    .join("\n");

  // Extract body or template content
  const templateTag = doc.querySelector("template");
  let bodyContent = "";
  if (templateTag) {
    bodyContent = templateTag.innerHTML;
  } else if (doc.body) {
    bodyContent = doc.body.innerHTML;
  }

  // Strip any remaining <script> tags from bodyContent as an extra safeguard
  bodyContent = bodyContent.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );

  const compositionHtml = `<template id="${id}-template">\n${styles}\n${bodyContent}\n</template>`;

  const combinedRawScript = inlineScripts.join("\n\n");
  const timelineScript = `export function buildTimeline(context) {
  const { root, timeline, register } = context;

  root.querySelectorAll("[id], [data-edit]").forEach((el) => {
    const key = el.dataset.edit || el.id;
    if (key) register(key, el);
  });

  window.__timelines = window.__timelines || {};
  const prevTimelines = { ...window.__timelines };

  try {
    ${combinedRawScript}
  } catch (err) {
    console.warn("HyperFrames script execution note:", err);
  }

  for (const [key, tl] of Object.entries(window.__timelines)) {
    if (!prevTimelines[key] && tl && typeof tl.seek === "function") {
      timeline.add(tl, 0);
    }
  }
}`;

  const scenes: SceneDefinition[] = [
    {
      id: "scene-01",
      label: "Main Scene",
      start: 0,
      duration,
      accent: "#6366f1",
    },
  ];

  return {
    id,
    title,
    html: compositionHtml,
    script: timelineScript,
    duration,
    width,
    height,
    fps,
    variables,
    scenes,
  };
}

/**
 * Converts a HyperFrames HTML composition string directly into a runnable Motionly CompositionDefinition.
 */
export function adaptHyperFramesToMotionly(
  rawHtml: string,
  options: DynamicCompositionOptions = {},
): CompositionDefinition {
  const parsed = parseHyperFramesHtml(rawHtml);

  return createDynamicComposition(parsed.html, parsed.script, {
    id: options.id ?? parsed.id,
    title: options.title ?? parsed.title,
    width: options.width ?? parsed.width,
    height: options.height ?? parsed.height,
    fps: options.fps ?? parsed.fps,
    duration: options.duration ?? parsed.duration,
    scenes: options.scenes ?? parsed.scenes,
  });
}
