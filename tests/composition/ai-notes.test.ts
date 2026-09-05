import { describe, expect, it } from "vitest";
import { aiNotesPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("AI Notes Preset (Scribe AI)", () => {
  it("defines truthful scenes and accurate 16.0s duration", () => {
    expect(aiNotesPreset.duration).toBe(16.0);
    expect(aiNotesPreset.fps).toBe(60);
    expect(aiNotesPreset.scenes.length).toBe(4);
    expect(aiNotesPreset.scenes.map((s) => s.id)).toEqual([
      "scene-01-thought-hook",
      "scene-02-live-recording",
      "scene-03-ai-synthesis",
      "scene-04-payoff",
    ]);
  });

  it("mounts deterministically and registers active elements", () => {
    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(aiNotesPreset, root);

    // Scene 1: Hook
    expect(runtime.elements.has("hookThought1")).toBe(true);
    expect(runtime.elements.has("hookThought2")).toBe(true);

    // Scene 2: Live Recording & Cursor
    expect(runtime.elements.has("appWindow")).toBe(true);
    expect(runtime.elements.has("waveformCard")).toBe(true);
    expect(runtime.elements.has("transcriptBubble")).toBe(true);
    expect(runtime.elements.has("synthesizeBtn")).toBe(true);
    expect(runtime.elements.has("scribeCursor")).toBe(true);

    // Scene 3: Synthesized Decisions & Stats
    expect(runtime.elements.has("decisionsCard")).toBe(true);
    expect(runtime.elements.has("actionsCard")).toBe(true);
    expect(runtime.elements.has("statHeroCard")).toBe(true);
    expect(runtime.elements.has("accuracyCounter")).toBe(true);
    expect(runtime.elements.has("sentimentCard")).toBe(true);

    // Scene 4: Payoff
    expect(runtime.elements.has("payoffThought")).toBe(true);

    // Seek across scene boundaries without error
    runtime.seek(1.0);
    runtime.seek(4.5);
    runtime.seek(7.3);
    runtime.seek(9.5);
    runtime.seek(13.2);
    runtime.seek(15.8);
    runtime.seek(18.0);

    runtime.destroy();
    root.remove();
  });
});
