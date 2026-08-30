import { describe, expect, it } from "vitest";
import { motionlyPromoPreset as demoComposition } from "../../src/compositions/presets";

describe("Motionly product demo", () => {
  it("is a 20-30 second HTML composition with connected launch beats", () => {
    expect(demoComposition.duration).toBeGreaterThanOrEqual(20);
    expect(demoComposition.duration).toBeLessThanOrEqual(30);
    expect(demoComposition.scenes.map((scene) => scene.id)).toEqual([
      "brand",
      "code",
      "studio",
      "lab",
      "cta",
    ]);
    expect(demoComposition.scenes.at(-1)?.start).toBe(21.2);
  });

  it("exposes editable HTML as its public composition source", () => {
    expect(demoComposition.sourcePreview).toContain("<template");
    expect(demoComposition.sourcePreview).toContain('data-edit="manifesto"');
    expect(demoComposition.sourcePreview).toContain("./timeline.js");
  });
});
