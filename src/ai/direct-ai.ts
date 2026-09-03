import type { SceneDefinition } from "../composition/types";

export interface DirectAiResult {
  title?: string;
  duration?: number;
  scenes?: readonly SceneDefinition[];
  compositionHtml: string;
  timelineJs: string;
  reply: string;
}

export async function generateWithDirectAi(
  userPrompt: string,
  currentFiles: { compositionHtml?: string; timelineJs?: string },
  onProgress?: (status: string) => void,
): Promise<DirectAiResult> {
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
