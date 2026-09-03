import { describe, expect, it } from "vitest";
import { flowdeskPreset } from "../../src/compositions/presets";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Flowdesk SaaS Commercial Preset", () => {
  it("defines 5 truthful scenes and accurate 32.0s duration", () => {
    expect(flowdeskPreset.duration).toBe(32.0);
    expect(flowdeskPreset.fps).toBe(60);
    expect(flowdeskPreset.scenes.length).toBe(5);
    expect(flowdeskPreset.scenes.map((s) => s.id)).toEqual([
      "scene-01-hook",
      "scene-02-friction",
      "scene-03-workspace",
      "scene-04-copilot",
      "scene-05-outro",
    ]);
  });

  it("mounts deterministically and registers active elements", () => {
    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(flowdeskPreset, root);

    expect(runtime.elements.has("beat1")).toBe(true);
    expect(runtime.elements.has("dp1")).toBe(true);
    expect(runtime.elements.has("frictionTitleWrap")).toBe(true);
    expect(runtime.elements.has("card1")).toBe(true);
    expect(runtime.elements.has("workspaceWindow")).toBe(true);
    expect(runtime.elements.has("rowBilling")).toBe(true);
    expect(runtime.elements.has("copilotDrawer")).toBe(true);
    expect(runtime.elements.has("approveBtn")).toBe(true);
    expect(runtime.elements.has("logoLockup")).toBe(true);

    // Seek across scene boundaries without error
    runtime.seek(3.0);
    runtime.seek(8.0);
    runtime.seek(15.0);
    runtime.seek(22.0);
    runtime.seek(29.0);

    runtime.destroy();
    root.remove();
  });
});
