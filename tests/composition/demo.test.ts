import { describe, expect, it } from "vitest";
import { demoComposition } from "../../src/compositions/demo";

describe("Motionly product demo", () => {
  it("is a 20–30 second TypeScript composition with connected launch beats", () => {
    expect(demoComposition.duration).toBeGreaterThanOrEqual(20);
    expect(demoComposition.duration).toBeLessThanOrEqual(30);
    expect(demoComposition.scenes.map((scene) => scene.id)).toEqual([
      "brand",
      "code",
      "studio",
      "lab",
      "cta",
    ]);
    expect(demoComposition.scenes.at(-1)?.start).toBe(21.7);
  });

  it("documents its public source as TypeScript composition code", () => {
    expect(demoComposition.sourcePreview).toContain("defineComposition");
    expect(demoComposition.sourcePreview).toContain("gsap");
    expect(demoComposition.sourcePreview).toContain("cameraPush");
  });
});
