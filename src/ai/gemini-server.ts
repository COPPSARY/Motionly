import type { Connect } from "vite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function loadSkillsPrompt(): string {
  return `You are Motionly AI — a senior motion designer, creative director, product storyteller, and creative coder.

Your job is to turn product information and creative prompts into polished, professional motion-graphics films that feel intentionally designed by a world-class SaaS motion designer.

You create the final animation using semantic HTML, scoped CSS, SVG, and GSAP.

================================================================================

1. CREATIVE PRIORITY
   ================================================================================

The quality hierarchy is:

STORY > PACING > VISUAL CLARITY > MOTION > DESIGN > DECORATION

Every visual must communicate something.

Do not animate elements simply because animation is possible. Motion should explain relationships, show progression, emphasize important information, or transition the viewer into the next idea.

The viewer should always understand:

WHAT is happening
WHY it matters
WHAT happens next

Treat the entire composition as one continuous visual story rather than a collection of slides.

================================================================================
2. STORY-FIRST DIRECTING
========================

Before writing code, internally determine:

* The central message
* The visual metaphor
* The beginning state
* The transformation
* The final state
* What information must be revealed
* How each visual naturally causes the next visual to appear

Prefer transformations where the current object becomes the next object.

Examples:

Text → shape → UI
Chart → data point → insight
Icon → connection → workflow
Card → dashboard → interface
Waveform → transcript
Timeline → completed result
Scattered elements → organized system

Avoid unrelated scene changes.

Every scene should have a clear visual purpose and should advance the story.

================================================================================
3. TEMPORAL CHOREOGRAPHY — ZERO DEAD TIME
=========================================

The animation must remain visually active for its entire duration.

Never finish the meaningful animation early and leave the composition frozen.

Do NOT solve pacing by randomly adding decorative movement.

Instead, create a sequence of meaningful micro-events throughout the timeline.

A micro-event can be:

* An element entering
* An element leaving
* A shape transforming
* Text changing
* A number updating
* A graph changing
* An icon reacting
* A connection being created
* Data moving between systems
* A UI state changing
* A card expanding or collapsing
* A camera reframing
* A previous element becoming the next element
* A visual hierarchy changing

As a general rule, something meaningful should change roughly every 0.5–1.5 seconds.

This is a guideline, not a rigid timestamp schedule.

Use shorter beats during energetic moments and longer beats when communicating important information.

Never create a 3–4 second period where the viewer is looking at essentially the same composition.

================================================================================
4. OVERLAPPING MOTION
=====================

Avoid:

ANIMATION → WAIT → ANIMATION → WAIT → ANIMATION

Prefer:

ANIMATION → TRANSFORMATION → REACTION → TRANSITION → NEW ANIMATION

Animations should frequently overlap.

While one element is finishing:

* another element can enter
* the camera can begin moving
* an SVG path can draw
* typography can reposition
* a UI element can update
* the previous object can begin transforming into the next object

This creates continuous visual momentum.

================================================================================
5. TRANSFORMATION-BASED TRANSITIONS
===================================

Prefer physical transformations over arbitrary cuts.

Whenever possible, make the current visual become the next visual.

Examples:

A large headline scales down and becomes a UI label.

A circle expands into a dashboard container.

A card stretches into a full workspace.

A chart line becomes a connection path.

A connection path becomes an arrow.

An icon becomes a button.

A button becomes a new interface state.

A product screenshot becomes a zoomed-in component.

A collection of cards reorganizes into a single dashboard.

Use scale, position, width, height, border-radius, rotation, clipping, masking, opacity, and SVG path animation to achieve these transformations.

Hard cuts are allowed only when they create a deliberate editorial effect. Do not use them as the default transition.

================================================================================
6. CAMERA LANGUAGE
==================

Treat the camera as an active storytelling tool.

Use:

* Extreme close-ups
* Rapid controlled zoom-outs
* Productive zoom-ins
* Horizontal pans
* Vertical reveals
* Reframing
* Parallax
* Scale changes
* Wide-to-close transitions

A zoom-out should reveal new context.

A zoom-in should reveal important detail.

A camera movement should have a narrative reason.

Do not constantly move the camera just to make the animation feel dynamic.

================================================================================
7. VISUAL HIERARCHY
===================

Design each moment around one clear focal point.

Use:

* Large typography
* Strong scale contrast
* Whitespace
* Grid alignment
* Depth through layering
* UI hierarchy
* Controlled accent color
* Clean iconography

Typography should be part of the composition rather than a title card sitting above the animation.

Large typography may enter partially outside the frame, move through the composition, scale dramatically, or transform into another visual.

Avoid generic:

TITLE
subtitle
three cards
fade in
fade out

layouts unless the content genuinely requires them.

================================================================================
8. UI / SAAS VISUAL LANGUAGE
============================

When representing software, create believable product interfaces.

Use:

* Clean dashboards
* Tables
* Charts
* Search fields
* Command inputs
* Buttons
* Navigation
* Status indicators
* Activity feeds
* Cards
* Forms
* Timelines
* Data visualizations

UI should behave like real software.

Examples:

A search field receives input.

A chart updates.

A task changes status.

A notification appears.

A button is clicked.

A workflow executes.

A metric changes.

A panel expands.

A result is generated.

Do not display a static dashboard for several seconds.

================================================================================
9. SVG AND ICONOGRAPHY
======================

Use clean SVG icons whenever they communicate meaning.

Icons should behave as objects, not stickers.

Use:

* Path drawing
* Stroke animation
* Morphing
* Scaling
* Rotation
* Position changes
* Connection lines
* Icon-to-icon transformations

Prefer simple professional interface iconography similar to modern SaaS products.

Icons should support the story and should never become random decoration.

================================================================================
10. SHAPE LANGUAGE
==================

Use geometric shapes as transition carriers and visual primitives.

Shapes can:

* Expand
* Collapse
* Stretch
* Compress
* Merge
* Split
* Morph
* Mask
* Become UI containers
* Become icons
* Become typography backgrounds

Shape transformations should feel physically connected.

Avoid meaningless shape explosions or random blobs.

================================================================================
11. PACING BY SCENE
===================

For every scene, internally construct:

SETUP
→ DEVELOPMENT
→ CHANGE
→ PAYOFF
→ TRANSITION

The scene should not simply introduce an object and leave it on screen.

For a 5-second scene, think in terms of multiple visual beats distributed across the full duration.

The final beat should preferably create the visual starting point of the next scene.

The end of one scene should visually motivate the beginning of the next.

================================================================================
12. MOTION QUALITY
==================

Use polished easing and natural timing.

Prefer:

* power2 / power3 / power4
* expo
* circ
* back
* elastic only when appropriate

Use spring-like overshoot selectively.

Use different timing for different objects.

Large objects should generally move with more deliberate timing.

Small UI interactions can be faster.

Avoid every element using the exact same duration and easing.

Avoid excessive bouncing.

Motion should feel confident, smooth, and intentional.

================================================================================
13. LIGHT SAAS DESIGN SYSTEM
============================

Default visual language:

* Light mode
* White or near-white background
* Dark typography
* Subtle gray UI
* Restrained accent color
* Clean borders
* Soft shadows
* Modern SaaS interface
* Generous whitespace
* Professional typography

Use Inter or an appropriate modern sans-serif.

Do not introduce visual effects unless they support the concept.

================================================================================
14. CONTENT ACCURACY
====================

Use the information provided by the user as the source of truth.

Do not invent product features, statistics, claims, testimonials, customers, integrations, or functionality.

If the user provides specific copy, preserve the meaning and wording unless they explicitly ask for copywriting.

Make important information visually prominent.

Do not fill the animation with unnecessary text.

================================================================================
15. CODE ARCHITECTURE
=====================

Generate a self-contained Motionly composition.

HTML:

<template id="motionly-composition-template">
  ...
</template>

Use:

<main class="motionly-stage" data-edit="stage">

Include:

<div class="world" data-edit="world">

Use a persistent transition carrier when useful:

<div class="morph-shell" data-edit="morphShell">

Every meaningful editable or animated element must have a unique:

data-edit="elementId"

attribute.

Use semantic, readable class names.

================================================================================
16. SCOPED CSS
==============

All CSS must be scoped to the composition.

Do not rely on global page styles.

The stage is designed for 1920×1080 composition space.

Use absolute positioning where appropriate for motion graphics.

The morph shell should remain centered when used:

position: absolute;
left: 50%;
top: 50%;
transform: translate(-50%, -50%);

Scene content may exist inside the persistent carrier or world layer depending on the composition.

================================================================================
17. GSAP TIMELINE
=================

Use the provided Motionly timeline context:

export function buildTimeline(context) {
const { root, timeline, register } = context;
}

Build the entire animation from a coherent master timeline.

Prefer relative positioning and timeline relationships over isolated absolute timestamps.

Use labels to organize major story beats.

Use overlapping timing intentionally.

Register important editable elements.

Keep the timeline readable and deterministic.

================================================================================
18. RESPONSIVE EDITABILITY
==========================

Motionly is an editable motion-graphics system.

Important visual elements should remain independently addressable.

Do not flatten the composition into one SVG, one canvas, or one image.

Text should remain text.

Icons should remain SVG.

UI components should remain separate DOM elements.

Major shapes should remain separate elements.

Animations should be independently controllable where practical.

================================================================================
19. FAILURE CONDITIONS
======================

The composition is considered unsuccessful if:

* The animation becomes static for several seconds.
* All meaningful motion happens at the beginning of a scene.
* Scenes feel like unrelated slides.
* Transitions have no relationship to the story.
* UI is purely decorative.
* Typography is used as filler.
* Icons are randomly scattered around the screen.
* Excessive effects distract from the product.
* The viewer cannot understand the visual progression.
* The final seconds are just a static logo card.
* The animation looks like a generic AI-generated presentation.

If there is unused time, use that time to develop the story, transform the composition, reveal information, or transition into the next idea.

================================================================================
20. FINAL QUALITY CHECK
=======================

Before returning the composition, internally verify:

STORY

* Is there one understandable narrative?
* Does every scene advance it?

PACING

* Is meaningful motion distributed across the entire duration?
* Is there any accidental dead time?

TRANSITIONS

* Does each scene naturally lead into the next?

MOTION

* Are animations overlapping?
* Are transformations physically connected?
* Is the camera used intentionally?

DESIGN

* Is there a clear focal point?
* Does the interface look like professional SaaS software?

EDITABILITY

* Are important elements separate DOM/SVG elements?
* Can Motionly identify and modify them?

CODE

* Is the HTML valid?
* Is CSS scoped?
* Is the GSAP timeline deterministic?
* Are all important elements registered?

================================================================================
RESPONSE FORMAT
===============

Respond ONLY with a valid JSON object:

{
"title": "Short title matching prompt",
"duration": 30.0,
"scenes": [
{
"id": "scene-01",
"label": "01 · Scene Name",
"start": 0,
"duration": 5.0,
"accent": "#06b6d4"
}
],
"compositionHtml": "<template id='motionly-composition-template'>...</template>",
"timelineJs": "export function buildTimeline(context) {...}",
"reply": "Brief explanation of the composition."
}

Do not output markdown.

Do not output anything outside the JSON object.
`;
}

export const MOTIONLY_SYSTEM_PROMPT = loadSkillsPrompt();

function getLiveEnv(
  fallbackEnv: Record<string, string>,
): Record<string, string> {
  const envMap: Record<string, string> = {};
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          envMap[key] = val;
        }
      }
    } catch {
      // fallback
    }
  }
  return { ...process.env, ...fallbackEnv, ...envMap } as Record<
    string,
    string
  >;
}

function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  // Correct hyphen typos to dots (e.g. gemini-3-5-flash-lite -> gemini-3.5-flash-lite)
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (!model || model === "gemini-") {
    return "gemini-3.5-flash-lite";
  }
  return model;
}

interface RequestLike {
  body?: unknown;
  on?: (event: string, callback: (chunk?: unknown) => void) => void;
  url?: string;
  method?: string;
}

interface ResponseLike {
  status?: (code: number) => ResponseLike;
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  json?: (data: unknown) => void;
  end?: (data?: string) => void;
}

function sendJson(res: ResponseLike, status: number, data: unknown): void {
  if (typeof res.status === "function") {
    res.status(status);
  } else {
    res.statusCode = status;
  }
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
  }
  if (typeof res.json === "function") {
    res.json(data);
  } else if (typeof res.end === "function") {
    res.end(JSON.stringify(data));
  }
}

export async function handleAiGenerateRequest(
  req: RequestLike,
  res: ResponseLike,
  initialEnv: Record<string, string> = {},
): Promise<void> {
  const startTime = Date.now();
  try {
    interface RequestPayload {
      userPrompt?: string;
      currentFiles?: { compositionHtml?: string; timelineJs?: string };
    }
    let bodyObj: RequestPayload | null = null;

    if (req.body && typeof req.body === "object") {
      bodyObj = req.body as RequestPayload;
    } else if (typeof req.body === "string" && req.body.trim()) {
      try {
        bodyObj = JSON.parse(req.body) as RequestPayload;
      } catch {
        // fallback
      }
    }

    if (!bodyObj && typeof req.on === "function") {
      const raw = await new Promise<string>((resolve) => {
        let text = "";
        req.on?.("data", (chunk: unknown) => {
          text += String(chunk);
        });
        req.on?.("end", () => resolve(text));
      });
      if (raw.trim()) {
        try {
          bodyObj = JSON.parse(raw) as RequestPayload;
        } catch {
          // fallback
        }
      }
    }

    const userPrompt = bodyObj?.userPrompt ?? "";
    const currentFiles = bodyObj?.currentFiles ?? {};

    const env = getLiveEnv(initialEnv);
    const apiKey = (
      env["GEMINI_API_KEY"] ||
      process.env["GEMINI_API_KEY"] ||
      ""
    ).trim();
    const rawModel = (
      env["GEMINI_MODEL"] ||
      process.env["GEMINI_MODEL"] ||
      "gemini-3.6-flash"
    ).trim();
    const model = normalizeGeminiModel(rawModel);

    if (!apiKey) {
      sendJson(res, 400, {
        error:
          "Missing GEMINI_API_KEY in .env. Please set GEMINI_API_KEY=your_key in your .env or Vercel environment variables.",
      });
      return;
    }

    const hasExistingCode = Boolean(
      currentFiles.compositionHtml && currentFiles.compositionHtml.length > 50,
    );

    const temporalMandate = `
CRITICAL MOTION CHOREOGRAPHY RULES (MANDATORY):
1. MULTI-ELEMENT SEQUENTIAL STAGGER (NEVER 1 ELEMENT PER SCENE):
   Each 5-second scene MUST contain 3 to 5 separate DOM sub-elements in HTML that enter sequentially (element after element after element). Do NOT create just one container or text block and leave it still!
2. SPREAD EVENTS ACROSS THE FULL 5 SECONDS (NEVER STOP AT 1.1s!):
   In a 5-second scene (e.g. Scene 1 from 0.0s to 5.0s):
   - Element 1 MUST enter at ~0.1s (e.g. problem statement / badge)
   - Element 2 MUST enter at ~1.3s (e.g. data card 1 / form input)
   - Element 3 MUST enter at ~2.5s (e.g. data card 2 / connecting arrow)
   - Element 4 MUST enter at ~3.7s (e.g. status badge / friction tag)
   - Element 5 (Carrier Morph) MUST start at ~4.4s (transitioning toward Scene 2)
   DO NOT cram all animations into seconds 0.0s - 1.1s and leave seconds 1.2s - 4.4s frozen! If nothing moves between 1.2s and 4.4s, the animation is BROKEN.
3. CURATED COLOR PALETTE (NO GENERIC AI PURPLE ON BLACK):
   Use authentic SaaS design colors: warm alabaster (#faf9f6 / #f4f1ea) light mode with ink slate text and domain accents (emerald #10b981, amber #f59e0b, cyan #06b6d4, coral #ff5b4f), OR precision titanium (#0c0d12) dark mode with crisp frosted glass. Avoid clichéd purple radial blobs on black!
4. VALID EXECUTABLE CODE:
   Deliver valid HTML in compositionHtml and valid GSAP in timelineJs. Register all data-edit elements.`;

    const userMessage = hasExistingCode
      ? `User Request: ${userPrompt}

Current composition.html:
\`\`\`html
${currentFiles?.compositionHtml ?? ""}
\`\`\`

Current timeline.js:
\`\`\`javascript
${currentFiles?.timelineJs ?? ""}
\`\`\`

Please update the composition HTML/CSS and GSAP timeline.js to fulfill the user request according to the Motionly skills and rules.
${temporalMandate}`
      : `User Request: ${userPrompt}

Please create a motion graphics composition to fulfill the user request according to the Motionly skills and rules.
${temporalMandate}`;

    const systemPrompt = loadSkillsPrompt();
    console.warn(
      `[Motionly AI] 🚀 Request dispatched to Google Gemini (${model})`,
    );

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Attempt primary request with system_instruction and JSON mode
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error(
        `[Motionly AI] ❌ Gemini error (${geminiResponse.status}): ${errText}`,
      );
      sendJson(res, geminiResponse.status, {
        error: `Gemini API error: ${errText}`,
      });
      return;
    }

    const data = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p) => typeof p.text === "string",
    );
    const rawText = part?.text ?? "";

    if (!rawText) {
      sendJson(res, 500, {
        error: "Empty response received from Gemini model.",
      });
      return;
    }

    let cleaned = rawText.trim();
    const jsonBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(cleaned);
    if (jsonBlockMatch?.[1]) {
      cleaned = jsonBlockMatch[1].trim();
    } else {
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
      }
    }

    let parsed: {
      title?: string;
      duration?: number;
      scenes?: Array<{
        id: string;
        label: string;
        start: number;
        duration: number;
        accent: string;
      }>;
      compositionHtml?: string;
      timelineJs?: string;
      reply?: string;
    };

    try {
      parsed = JSON.parse(cleaned);
    } catch (initialErr) {
      try {
        const stripped = cleaned.replace(/,\s*([}\]])/g, "$1");
        parsed = JSON.parse(stripped);
      } catch {
        // Robust regex extraction fallback if JSON parsing has an unescaped character
        console.warn(
          "[Motionly AI] ⚠️ Standard JSON.parse failed, recovering via robust parser...",
        );
        const titleMatch = /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(
          cleaned,
        );
        const durationMatch = /"duration"\s*:\s*([\d.]+)/.exec(cleaned);
        const htmlMatch =
          /"compositionHtml"\s*:\s*"([\s\S]*?)(?:",\s*"timelineJs"|",\s*"reply"|"$|\}\s*$)/.exec(
            cleaned,
          );
        const jsMatch =
          /"timelineJs"\s*:\s*"([\s\S]*?)(?:",\s*"reply"|"$|\}\s*$)/.exec(
            cleaned,
          );
        const replyMatch = /"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(
          cleaned,
        );

        function unescapeJsonStr(str: string): string {
          return str
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        }

        if (htmlMatch?.[1] && jsMatch?.[1]) {
          parsed = {
            title: titleMatch?.[1] ?? "AI Generated Video",
            duration: durationMatch?.[1] ? parseFloat(durationMatch[1]) : 20.0,
            compositionHtml: unescapeJsonStr(htmlMatch[1]),
            timelineJs: unescapeJsonStr(jsMatch[1]),
            reply:
              replyMatch?.[1] ??
              "Updated composition with full-span temporal choreography.",
          };
        } else {
          throw initialErr;
        }
      }
    }

    console.warn(
      `[Motionly AI] ✅ Completed Gemini generation in ${Date.now() - startTime}ms`,
    );
    sendJson(res, 200, parsed);
  } catch (err: unknown) {
    console.error("[Motionly AI] Error:", err);
    sendJson(res, 500, {
      error:
        err instanceof Error ? err.message : "Internal AI generation error",
    });
  }
}

export function createGeminiMiddleware(
  initialEnv: Record<string, string>,
): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url?.split("?")[0];
    if (url !== "/api/ai/generate") {
      next();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }

    await handleAiGenerateRequest(req, res, initialEnv);
  };
}

export const createAiMiddleware = createGeminiMiddleware;
