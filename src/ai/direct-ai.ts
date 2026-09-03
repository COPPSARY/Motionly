import type { SceneDefinition } from "../composition/types";
import { MOTIONLY_SYSTEM_PROMPT } from "./prompt";

export interface DirectAiResult {
  title?: string;
  duration?: number;
  scenes?: readonly SceneDefinition[];
  compositionHtml: string;
  timelineJs: string;
  reply: string;
}

export function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (!model || model === "gemini-") {
    model = "gemini-3.5-flash-lite";
  }
  return model;
}

export function getClientGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const customKey = localStorage.getItem("motionly_gemini_api_key");
    if (customKey && customKey.trim()) return customKey.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  const viteKey = env["VITE_GEMINI_API_KEY"] ?? "";
  return viteKey.trim();
}

export function getClientGeminiModel(): string {
  if (typeof window !== "undefined") {
    const customModel = localStorage.getItem("motionly_gemini_model");
    if (customModel && customModel.trim()) return customModel.trim();
  }
  const env = import.meta.env as Record<string, string | undefined>;
  const viteModel = env["VITE_GEMINI_MODEL"] ?? "";
  return viteModel.trim() || "gemini-3.5-flash-lite";
}

function parseAiResponseText(rawText: string): DirectAiResult {
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

  let parsed: Partial<DirectAiResult>;
  try {
    parsed = JSON.parse(cleaned) as Partial<DirectAiResult>;
  } catch {
    try {
      const stripped = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(stripped) as Partial<DirectAiResult>;
    } catch {
      // Fallback regex extraction
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
          reply: replyMatch?.[1] ?? "Updated composition with Motionly AI.",
        };
      } else {
        throw new Error("Failed to parse AI response into valid JSON.");
      }
    }
  }

  if (!parsed.compositionHtml || !parsed.timelineJs) {
    throw new Error(
      "AI response was missing compositionHtml or timelineJs code.",
    );
  }

  return {
    title: parsed.title,
    duration: parsed.duration,
    scenes: parsed.scenes,
    compositionHtml: parsed.compositionHtml,
    timelineJs: parsed.timelineJs,
    reply: parsed.reply ?? "I updated your composition.",
  };
}

export async function generateWithDirectAi(
  userPrompt: string,
  currentFiles: { compositionHtml?: string; timelineJs?: string },
  onProgress?: (status: string) => void,
): Promise<DirectAiResult> {
  const clientApiKey = getClientGeminiApiKey();

  // If a client API key is available, call Google Gemini DIRECTLY from the browser!
  // This bypasses Vercel completely (no 60s timeout, no serverless cold starts, no 504 errors).
  if (clientApiKey) {
    const rawModel = getClientGeminiModel();
    const model = normalizeGeminiModel(rawModel);
    onProgress?.(`Contacting Google Gemini (${model}) directly...`);

    const hasExistingCode = Boolean(
      currentFiles.compositionHtml && currentFiles.compositionHtml.length > 50,
    );

    const temporalMandate = `
CRITICAL MOTION CHOREOGRAPHY RULES (MANDATORY):
1. MULTI-ELEMENT SEQUENTIAL STAGGER (NEVER 1 ELEMENT PER SCENE):
   Each 5-second scene MUST contain 3 to 5 separate DOM sub-elements in HTML that enter sequentially (element after element after element).
2. SPREAD EVENTS ACROSS THE FULL 5 SECONDS:
   - Element 1 at ~0.1s
   - Element 2 at ~1.3s
   - Element 3 at ~2.5s
   - Element 4 at ~3.7s
   - Element 5 (Carrier Morph) at ~4.4s
3. VALID EXECUTABLE CODE:
   Deliver valid HTML in compositionHtml and valid GSAP in timelineJs with buildTimeline(context).`;

    const userMessage = hasExistingCode
      ? `User Request: ${userPrompt}

Current composition.html:
\`\`\`html
${currentFiles.compositionHtml ?? ""}
\`\`\`

Current timeline.js:
\`\`\`javascript
${currentFiles.timelineJs ?? ""}
\`\`\`

Please update the composition HTML/CSS and GSAP timeline.js to fulfill the user request according to the Motionly skills and rules.
${temporalMandate}`
      : `User Request: ${userPrompt}

Please create a motion graphics composition to fulfill the user request according to the Motionly skills and rules.
${temporalMandate}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${clientApiKey}`;

    const generationConfig: Record<string, unknown> = {
      response_mime_type: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    if (model.includes("3.7")) {
      generationConfig["thinking_config"] = { thinking_budget: 0 };
    }

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: MOTIONLY_SYSTEM_PROMPT }],
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

    if (!response.ok) {
      const errText = await response.text();
      let msg = `Gemini API error (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {
        if (errText) msg = errText;
      }
      throw new Error(msg);
    }

    onProgress?.("Parsing and applying composition...");
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) {
      throw new Error("Empty response received from Gemini.");
    }

    return parseAiResponseText(rawText);
  }

  // Fallback: Use backend API route (/api/ai/generate)
  onProgress?.("Analyzing motion prompt with AI...");

  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userPrompt,
      currentFiles,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = (await response.json()) as { error?: string };
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // Fallback
    }
    throw new Error(errorMsg);
  }

  onProgress?.("Applying composition and updating live preview...");
  const data = (await response.json()) as {
    title?: string;
    duration?: number;
    scenes?: readonly SceneDefinition[];
    compositionHtml?: string;
    timelineJs?: string;
    reply?: string;
  };

  if (!data.compositionHtml || !data.timelineJs) {
    throw new Error(
      "AI response was missing compositionHtml or timelineJs code.",
    );
  }

  return {
    title: data.title,
    duration: data.duration,
    scenes: data.scenes,
    compositionHtml: data.compositionHtml,
    timelineJs: data.timelineJs,
    reply: data.reply ?? "I updated your composition.",
  };
}
