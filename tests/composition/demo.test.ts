import { describe, expect, it } from "vitest";
import { motionlyPromoPreset as demoComposition } from "../../src/compositions/presets";

describe("Motionly product demo", () => {
  it("is a complete founder story with connected launch beats", () => {
    expect(demoComposition.duration).toBe(39);
    expect(demoComposition.fps).toBe(24);
    expect(demoComposition.scenes.map((scene) => scene.id)).toEqual([
      "problem",
      "intro",
      "solutions",
      "product",
      "cta",
    ]);
    expect(demoComposition.scenes.at(-1)?.start).toBe(33);
  });

  it("exposes editable HTML as its public composition source", () => {
    expect(demoComposition.sourcePreview).toContain("<template");
    expect(demoComposition.sourcePreview).toContain(
      'data-edit="build-question"',
    );
    expect(demoComposition.sourcePreview).toContain("./timeline.js");
  });
});
