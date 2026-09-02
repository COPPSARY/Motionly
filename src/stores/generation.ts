import { writable } from "svelte/store";
import {
  createEditGeneration,
  createNewProjectGeneration,
  subscribeToGenerationEvents,
  type Generation,
  type GenerationEvent,
} from "../api/generations";

export interface GenerationState {
  isActive: boolean;
  status: string;
  stage: string;
  progress: number;
  message: string;
  error?: string;
  generationId?: string;
}

type CompletionHandler = (
  generation: Generation,
  event: GenerationEvent,
) => void | Promise<void>;

const initialState: GenerationState = {
  isActive: false,
  status: "IDLE",
  stage: "IDLE",
  progress: 0,
  message: "",
};

export const generationStore = writable<GenerationState>(initialState);

export async function startNewGeneration(
  workspaceId: string,
  prompt: string,
  assetIds: string[] = [],
  onComplete?: CompletionHandler,
): Promise<void> {
  try {
    generationStore.set({
      ...initialState,
      isActive: true,
      status: "QUEUED",
      message: "Got it — I’m working on that now.",
    });
    const generation = await createNewProjectGeneration(
      workspaceId,
      prompt,
      assetIds,
    );
    watchGeneration(generation, onComplete);
  } catch (error: unknown) {
    failToStart(error, "Failed to start generation");
  }
}

export async function startEditGeneration(
  projectId: string,
  prompt: string,
  baseSourceHash: string,
  baseRevision: number,
  assetIds: string[] = [],
  onComplete?: CompletionHandler,
): Promise<void> {
  try {
    generationStore.set({
      ...initialState,
      isActive: true,
      status: "QUEUED",
      message: "Got it — I’m updating the open project now.",
    });
    const generation = await createEditGeneration(
      projectId,
      prompt,
      baseSourceHash,
      baseRevision,
      assetIds,
    );
    watchGeneration(generation, onComplete);
  } catch (error: unknown) {
    failToStart(error, "Failed to start generation");
  }
}

function watchGeneration(
  generation: Generation,
  onComplete?: CompletionHandler,
): void {
  generationStore.update((state) => ({
    ...state,
    generationId: generation.id,
  }));
  subscribeToGenerationEvents(
    generation.id,
    (event) =>
      generationStore.update((state) => ({
        ...state,
        status: event.status,
        stage: event.stage,
        progress: event.progress,
        message: event.message ?? state.message,
      })),
    (event) => {
      if (event.status === "AWAITING_APPLY") {
        generationStore.update((state) => ({
          ...state,
          isActive: false,
          status: event.status,
          stage: event.stage,
          progress: 100,
          message:
            event.message ??
            "The project changed while generation was running. Reload before applying.",
        }));
        return;
      }
      generationStore.update((state) => ({
        ...state,
        isActive: false,
        status: "COMPLETED",
        stage: "COMPLETED",
        progress: 100,
        message:
          event.message ??
          "Done — I updated the project and saved your changes.",
      }));
      void onComplete?.(generation, event);
    },
    (event) =>
      generationStore.update((state) => ({
        ...state,
        isActive: false,
        status: event.status,
        stage: event.stage,
        error:
          event.message ??
          (event.status === "CANCELLED"
            ? "Generation cancelled"
            : "Generation failed"),
      })),
    () =>
      generationStore.update((state) => ({
        ...state,
        isActive: false,
        status: "FAILED",
        error: "Generation progress connection was lost",
      })),
  );
}

function failToStart(error: unknown, fallback: string): void {
  generationStore.set({
    ...initialState,
    isActive: false,
    error: error instanceof Error ? error.message : fallback,
  });
}
