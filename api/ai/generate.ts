import { handleAiGenerateRequest } from "../../src/ai/gemini-server";

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    statusCode?: number;
    setHeader?: (name: string, value: string) => void;
    end?: (data?: string) => void;
  },
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader?.("Content-Type", "application/json");
    res.end?.(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  await handleAiGenerateRequest(req, res);
}
