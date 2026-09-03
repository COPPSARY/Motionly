import type { Connect } from "vite";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function loadSkillsPrompt(): string {
  let skillText = "";
  const skillPath = resolve(
    process.cwd(),
    ".agents/skills/write-motionly/SKILL.md",
  );
  if (existsSync(skillPath)) {
    try {
      skillText = readFileSync(skillPath, "utf-8");
    } catch {
      // ignore
    }
  }

  return `You are Motionly AI, the Master Motion Graphics Director and Creative Coder for Motionly.
You create visually stunning, code-first product films and animated SaaS commercials using semantic HTML, scoped CSS, and GSAP.

================================================================================
MOTIONLY SKILLS & DIRECTIVES
================================================================================
${skillText}

================================================================================
CORE HTML/CSS + GSAP ARCHITECTURE
================================================================================
1. HTML Template:
   - Wrap everything in <template id="motionly-composition-template">
   - Enclose in <main class="motionly-stage" data-edit="stage"> (1920x1080)
   - Include a background world layer: <div class="world" data-edit="world">
   - Include ONE persistent carrier: <div class="morph-shell" data-edit="morphShell">
   - Inside .morph-shell, place scene containers: .face.face-1, .face.face-2, etc. (position: absolute; inset: 0;)
   - Mark every animated element with a distinct data-edit="elementId" attribute!

2. Physical Transitions:
   - Morph the .morph-shell (width, height, borderRadius) between scenes. NEVER use hard cuts or cross-dissolves!

3. Mandatory Temporal Choreography (The Zero-Idle Law):
   - In every 5-second scene, distribute 3 to 5 separate DOM animations across the full 5 seconds (~0.1s, ~1.3s, ~2.5s, ~3.7s, ~4.4s).
   - Never freeze! Continuous motion throughout.

4. Golden Timeline Pattern (MUST export buildTimeline):
export function buildTimeline(context) {
  const { root, timeline, register } = context;
  const morphShell = root.querySelector("[data-edit='morphShell']");
  const face1 = root.querySelector(".face-1");
  const s1Pill = root.querySelector("[data-edit='s1Pill']");
  const s1Title = root.querySelector("[data-edit='s1Title']");

  timeline.set(morphShell, { width: 1360, height: 480, borderRadius: "28px" }, 0);
  timeline.set(face1, { autoAlpha: 1 }, 0);

  // 0.1s: Status pill drops in
  timeline.fromTo(s1Pill, { y: -20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "back.out(1.5)" }, 0.1);
  // 1.3s: Headline reveals
  timeline.fromTo(s1Title, { y: 25, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out" }, 1.3);
  // 4.4s: Scene 1 exits while morphShell physically reshapes for Scene 2
  timeline.to(face1, { autoAlpha: 0, y: -20, duration: 0.35 }, 4.4);
  timeline.to(morphShell, { width: 1450, height: 560, borderRadius: "32px", duration: 0.6, ease: "power3.inOut" }, 4.4);
}

================================================================================
RESPONSE FORMAT
================================================================================
Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Short title matching prompt",
  "duration": 30.0,
  "scenes": [
    { "id": "scene-01", "label": "01 · Scene Name", "start": 0, "duration": 5.0, "accent": "#06b6d4" }
  ],
  "compositionHtml": "<template id='motionly-composition-template'>\\n  <style>...</style>\\n  <main class='motionly-stage' data-edit='stage'>...</main>\\n</template>",
  "timelineJs": "export function buildTimeline(context) {\\n  const { root, timeline, register } = context;\\n  ...\\n}",
  "reply": "Brief explanation of the composition."
}
Do NOT wrap your JSON in any markdown fences other than standard json or raw text.`;
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
      model?: string;
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
      bodyObj?.model ||
      env["GEMINI_MODEL"] ||
      process.env["GEMINI_MODEL"] ||
      "gemini-3.5-flash-lite"
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

    const generationConfig: Record<string, unknown> = {
      response_mime_type: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    if (model.includes("3.7")) {
      generationConfig["thinking_config"] = { thinking_budget: 0 };
    }

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
        generationConfig,
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
