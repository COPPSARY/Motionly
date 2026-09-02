import { fetchApi, API_URL } from "./client";

export type GenerationStatus =
  | "QUEUED"
  | "PREPARING"
  | "GENERATING"
  | "VALIDATING"
  | "RENDERING"
  | "REVIEWING"
  | "REPAIRING"
  | "PUBLISHING"
  | "CANCELLING"
  | "COMPLETED"
  | "AWAITING_APPLY"
  | "CANCELLED"
  | "FAILED";

export interface Generation {
  id: string;
  workspaceId: string;
  projectId: string;
  threadId: string;
  intent: "CREATE" | "EDIT";
  status: GenerationStatus;
  stage: string;
  progress: number;
  baseSourceHash: string;
  baseRevision: number;
  outputSourceHash: string | null;
  provider: string;
  model: string;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: null | {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface GenerationEvent {
  generationId: string;
  sequence: number;
  type: string;
  status: GenerationStatus;
  stage: string;
  progress: number;
  message?: string;
  data?: Record<string, unknown>;
}

async function unwrapGeneration(response: Response): Promise<Generation> {
  return ((await response.json()) as { data: Generation }).data;
}

export async function createNewProjectGeneration(
  workspaceId: string,
  prompt: string,
  assetIds: string[] = [],
): Promise<Generation> {
  const response = await fetchApi(`/v1/workspaces/${workspaceId}/generations`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      prompt,
      project: {
        name: "AI Generated",
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 10,
      },
      presetId: "motionly-product-promo",
      assetIds,
    }),
  });
  return unwrapGeneration(response);
}

export async function createEditGeneration(
  projectId: string,
  prompt: string,
  baseSourceHash: string,
  baseRevision: number,
  assetIds: string[] = [],
): Promise<Generation> {
  const response = await fetchApi(`/v1/projects/${projectId}/generations`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      prompt,
      baseSourceHash,
      baseRevision,
      assetIds,
    }),
  });
  return unwrapGeneration(response);
}

export function subscribeToGenerationEvents(
  generationId: string,
  onProgress: (event: GenerationEvent) => void,
  onCompleted: (event: GenerationEvent) => void,
  onFailed: (event: GenerationEvent) => void,
  onConnectionError: () => void,
): () => void {
  const source = new EventSource(
    `${API_URL}/v1/generations/${generationId}/events`,
    { withCredentials: true },
  );

  source.addEventListener("progress", (e) => {
    try {
      const data = JSON.parse(e.data);
      onProgress(data as GenerationEvent);
    } catch (err) {
      console.error("Failed to parse progress event", err);
    }
  });

  source.addEventListener("completed", (e) => {
    try {
      const data = JSON.parse(e.data);
      onCompleted(data as GenerationEvent);
      source.close();
    } catch (err) {
      console.error("Failed to parse completed event", err);
    }
  });

  for (const eventName of ["failed", "cancelled"] as const) {
    source.addEventListener(eventName, (event) => {
      try {
        onFailed(JSON.parse(event.data) as GenerationEvent);
      } finally {
        source.close();
      }
    });
  }

  source.onerror = () => {
    onConnectionError();
    source.close();
  };

  return () => source.close();
}
