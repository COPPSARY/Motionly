export const maxDuration = 60;
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";

function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/\s+/g, "-");
  if (!model.startsWith("gemini-") && !model.startsWith("gemma-")) {
    model = `gemini-${model}`;
  }
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (!model || model === "gemini-") {
    return "gemini-3.5-flash-lite";
  }
  return model;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as {
      userPrompt?: string;
      model?: string;
      currentFiles?: { compositionHtml?: string; timelineJs?: string };
    };

    const userPrompt = body.userPrompt ?? "";
    const currentFiles = body.currentFiles ?? {};

    const apiKey = (process.env["GEMINI_API_KEY"] ?? "").trim();
    const rawModel = (
      body.model ||
      process.env["GEMINI_MODEL"] ||
      "gemini-3.5-flash-lite"
    ).trim();
    const model = normalizeGeminiModel(rawModel);

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing GEMINI_API_KEY in Vercel environment variables. Please add GEMINI_API_KEY in your Vercel Project Settings.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const hasExistingCode = Boolean(
      currentFiles.compositionHtml && currentFiles.compositionHtml.length > 50,
    );

    const choreographyMandate = `
CRITICAL MOTION CHOREOGRAPHY RULES:
1. FOCUS ON 1 FOCAL SUBJECT PER BEAT (ZERO SLOP):
   - Focus on ONE spoken thought or ONE focal subject per beat.
   - DO NOT create card containers packed with title + subtitle + chips! No random floating pills or badge clutter.
2. GSAP PRESETS & KINETIC TYPOGRAPHY:
   - Use built-in Motionly presets directly: wordSlideRotate, charSpringBounce, giantKineticCrop, morph, cameraPush, spring, textReveal.
   - Editorial statements enter with kinetic zoom (scale: 2.0+ settling to 1.0) or word-by-word spring overshoot bounce (back.out(1.35)).
3. SHAPE MORPHS & DYNAMIC COLOR THEMES:
   - Transition boundaries MUST use physical shape morphs (width/height/borderRadius) or match cuts. ZERO opacity fades!
   - Dynamically shift color themes across beats (e.g. Alabaster light mode to rich brand dark mode) with GSAP on stage and world. Pick striking colors suited to the prompt.
4. VALID EXECUTABLE CODE:
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
${choreographyMandate}`
      : `User Request: ${userPrompt}

Please create a motion graphics composition to fulfill the user request according to the Motionly skills and rules.
${choreographyMandate}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {
      response_mime_type: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    };

    if (model.includes("3.7")) {
      generationConfig["thinking_config"] = { thinking_budget: 0 };
    }

    const geminiResponse = await fetch(geminiUrl, {
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

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        {
          status: geminiResponse.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const data = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const part = data.candidates?.[0]?.content?.parts?.find(
      (p) => typeof p.text === "string",
    );
    const rawText = part?.text ?? "";

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: "Empty response received from Gemini model." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const stripped = cleaned.replace(/,\s*([}\]])/g, "$1");
        parsed = JSON.parse(stripped);
      } catch {
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
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response JSON." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error ? err.message : "Internal AI generation error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
