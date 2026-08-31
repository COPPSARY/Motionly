import { describe, expect, it } from "vitest";
import { motionlyPromoPreset as demoComposition } from "../../src/compositions/presets";

describe("Motionly product demo", () => {
  it("is a complete founder story with connected launch beats", () => {
    expect(demoComposition.duration).toBe(31);
    expect(demoComposition.fps).toBe(24);
    expect(demoComposition.scenes.map((scene) => scene.id)).toEqual([
      "brand",
      "problem",
      "build",
      "code",
      "studio",
      "lab",
      "cta",
    ]);
    expect(
      demoComposition.scenes.find((scene) => scene.id === "problem")?.duration,
    ).toBeLessThanOrEqual(2);
    expect(demoComposition.scenes.at(-1)?.start).toBe(26.5);
  });

  it("exposes editable HTML as its public composition source", () => {
    expect(demoComposition.sourcePreview).toContain("<template");
    expect(demoComposition.sourcePreview).toContain('data-edit="manifesto"');
    expect(demoComposition.sourcePreview).toContain("./timeline.js");
  });
});
