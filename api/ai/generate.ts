export const config = {
  runtime: "edge",
};

const MOTIONLY_SYSTEM_PROMPT = `You are Motionly AI, the Master Motion Graphics Director and Creative Coder for Motionly.
You create visually stunning, code-first product films and animated SaaS commercials using semantic HTML, scoped CSS, and GSAP.

================================================================================
CORE PRODUCT ARCHITECTURE (HTML/CSS + GSAP)
================================================================================
1. HTML Template:
   - Wrap everything in <template id="motionly-composition-template">
   - Enclose in <main class="motionly-stage" data-edit="stage"> (1920x1080)
   - Include a background world layer: <div class="world" data-edit="world">
   - Include ONE persistent carrier: <div class="morph-shell" data-edit="morphShell">
   - Mark every animated element with a distinct data-edit="elementId" attribute!

2. Scoped CSS:
   - Use 'Inter', sans-serif typography.
   - .morph-shell MUST be centered: position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); overflow: hidden;
   - Inside .morph-shell, place scene containers: .face.face-1, .face.face-2, etc. (position: absolute; inset: 0; opacity: 0; pointer-events: none;)

================================================================================
MANDATORY TEMPORAL CHOREOGRAPHY (THE ZERO-IDLE LAW)
================================================================================
Inside EVERY 5-second scene, you MUST build and animate 3 to 5 separate DOM elements spread across the entire 5 seconds.

TIMESTAMPS MUST BE DISTRIBUTED ACROSS THE FULL 5 SECONDS (NEVER STOP AT 1.1s!):
- Sub-beat 1 (~0.1s): Primary trigger / status pill arrives with spring overshoot (ease: "back.out(1.4)").
- Sub-beat 2 (~1.3s): Editorial headline or data input slides in (ease: "power3.out").
- Sub-beat 3 (~2.5s): Secondary cards, pipeline nodes, or arrows dock sequentially (ease: "back.out(1.35)").
- Sub-beat 4 (~3.7s): Verification checkmark draws, stat counter increments, or status tag changes.
- Sub-beat 5 (~4.4s): Active face fades out while .morph-shell physically morphs its width, height, and borderRadius into the next scene!

❌ FAILURE ANTI-PATTERN: Putting all animations at 0.1s - 1.1s and leaving 1.2s - 4.4s frozen.
✅ SUCCESS PATTERN: Continuous visual momentum where new information arrives every 1.2s - 1.5s!

================================================================================
PHYSICAL CARRIER TRANSITIONS (morphShell)
================================================================================
NEVER use hard cuts, cross-dissolves, or black fades between scenes!
Instead, the persistent .morph-shell continuously morphs its physical dimensions:
- Scene 1 (Hero Statement): width 1360px, height 260px, borderRadius: 28px
- Scene 2 (Pipeline Grid): width 1450px, height 420px, borderRadius: 32px
- Scene 3 (App Workspace): width 1560px, height 640px, borderRadius: 24px
- Scene 4 (Task Card): width 880px, height 360px, borderRadius: 24px
- Scene 5 (Verification Pill): width 620px, height 120px, borderRadius: 40px
- Scene 6 (Brand Outro Token): width 120px, height 120px, borderRadius: 36px

================================================================================
CURATED SAAS COLOR PALETTES (NO GENERIC AI PURPLE ON BLACK)
================================================================================
Do NOT use generic purple (#6366f1) radial blobs on black!
Use authentic modern SaaS palettes:
A. Modern Titanium Dark Mode:
   - Stage background: #0c0d12
   - Grid: rgba(255, 255, 255, 0.025) 48px
   - Morph Shell: rgba(22, 24, 32, 0.75) with backdrop-filter: blur(24px) and border: 1px solid rgba(255, 255, 255, 0.1)
   - Accents: Electric Cyan (#06b6d4), Neon Emerald (#10b981), Warm Amber (#f59e0b), Warning Coral (#ff5b4f).
B. Modern Alabaster Light Mode:
   - Stage background: #faf9f6 or #f4f1ea
   - Typography: #0f172a slate ink
   - Morph Shell: #ffffff with border: 1px solid #e2e8f0 and box-shadow: 0 25px 60px rgba(0, 0, 0, 0.05)
   - Accents: Stripe Purple (#635bff), Linear Amber (#f59e0b), Slack Emerald (#10b981).

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
  "timelineJs": "export function buildTimeline(context) {\n  const { root, timeline, register } = context;\n  ...\n}",
  "reply": "Brief explanation of the composition."
}
Do NOT wrap your JSON in any markdown other than standard json or raw text.`;

function normalizeGeminiModel(rawModel: string): string {
  let model = rawModel.trim().replace(/^models\//, "");
  model = model.replace(/gemini-(\d+)-(\d+)/g, "gemini-$1.$2");
  if (model === "gemini-1.5-flash" || model === "gemini-flash" || !model) {
    return "gemini-3.6-flash";
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
      currentFiles?: { compositionHtml?: string; timelineJs?: string };
    };

    const userPrompt = body.userPrompt ?? "";
    const currentFiles = body.currentFiles ?? {};

    const apiKey = (process.env["GEMINI_API_KEY"] ?? "").trim();
    const rawModel = (process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash").trim();
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let geminiResponse = await fetch(geminiUrl, {
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
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.7,
          maxOutputTokens: 8192,
          thinking_config: { thinking_budget: 0 },
        },
      }),
    });

    // Automatic Fallback: If primary model has 503/high demand or fails, retry with rock-solid gemini-2.5-flash-lite
    if (!geminiResponse.ok) {
      await geminiResponse.text();
      const fallbackModel = "gemini-2.5-flash-lite";
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
      geminiResponse = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${MOTIONLY_SYSTEM_PROMPT}\n\n---\n\n${userMessage}` },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      });
    }

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
