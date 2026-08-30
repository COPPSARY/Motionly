import { afterEach, describe, expect, it } from "vitest";
import { CompositionRuntime } from "../../src/composition/runtime";
import { motionlyPromoPreset as demoComposition } from "../../src/compositions/presets";

const runtimes: CompositionRuntime[] = [];

afterEach(() => {
  runtimes.splice(0).forEach((runtime) => runtime.destroy());
  document.body.replaceChildren();
});

function createRuntime(): CompositionRuntime {
  const root = document.createElement("div");
  document.body.append(root);
  const runtime = new CompositionRuntime(demoComposition, root);
  runtimes.push(runtime);
  return runtime;
}

describe("code-first composition runtime", () => {
  it("builds the product film directly from HTML and GSAP", () => {
    const runtime = createRuntime();
    expect(runtime.timeline.duration()).toBeCloseTo(27, 3);
    expect(runtime.root.querySelector(".intro-scene")).not.toBeNull();
    expect(runtime.root.querySelector(".product-stage")).not.toBeNull();
    expect(runtime.elements.has("final-cta")).toBe(true);
  });

  it("seeks deterministically across scenes and frame boundaries", () => {
    const runtime = createRuntime();
    runtime.seek(6.43);
    expect(runtime.snapshot.sceneId).toBe("code");
    expect(runtime.time).toBeCloseTo(6.4333, 3);
    runtime.seek(16.21);
    expect(runtime.snapshot.sceneId).toBe("lab");
    runtime.seek(100);
    expect(runtime.time).toBe(27);
  });

  it("supports play, pause, restart, and visual overrides without a conversion layer", () => {
    const runtime = createRuntime();
    runtime.play();
    expect(runtime.snapshot.playing).toBe(true);
    runtime.pause();
    expect(runtime.snapshot.playing).toBe(false);
    runtime.setOverride("final-cta", { x: 20, opacity: 0.8, text: "Ship it" });
    const cta = runtime.elements.get("final-cta");
    expect(cta?.textContent).toBe("Ship it");
    expect(cta?.style.translate).toBe("20px 0px");
    expect(cta?.style.opacity).toBe("0.8");
    runtime.restart();
    expect(runtime.snapshot.playing).toBe(true);
  });

  it("resumes a complete frame after forward and reverse timeline scrubs", () => {
    const runtime = createRuntime();
    runtime.seek(18.4);
    runtime.seek(5.2);
    runtime.seek(15.9);
    runtime.seek(11.8);

    const artboard = runtime.elements.get("artboard");
    const headline = runtime.elements.get("artboard-headline");
    expect(artboard?.style.visibility).not.toBe("hidden");
    expect(headline?.style.visibility).not.toBe("hidden");

    runtime.play();
    expect(runtime.snapshot.playing).toBe(true);
    expect(runtime.time).toBeCloseTo(11.8, 2);
  });

  it("preserves animated split-text spans when the editor changes copy", () => {
    const runtime = createRuntime();
    const line = runtime.elements.get("final-line-one");
    expect(line?.dataset["motionlySplitUnit"]).toBe("chars");
    const animatedPieces = line?.children.length ?? 0;
    expect(animatedPieces).toBeGreaterThan(0);

    runtime.setOverride("final-line-one", { text: "SHIP IT" });

    expect(line?.textContent).toBe("SHIP IT");
    expect(line?.children.length).toBe(animatedPieces);
  });

  it("composes editor appearance overrides without erasing GSAP motion", () => {
    const runtime = createRuntime();
    const title = runtime.elements.get("manifesto-design");

    runtime.setOverride("manifesto-design", {
      x: 24,
      scale: 1.04,
      color: "#ff705e",
      backgroundColor: "#17191c",
      fontSize: 118,
      borderRadius: 8,
    });
    runtime.seek(1);

    expect(title?.style.translate).toBe("24px 0px");
    expect(title?.style.scale).toBe("1.04");
    expect(title?.style.transform).not.toBe("");
    expect(title?.style.color).toBe("rgb(255, 112, 94)");
    expect(title?.style.backgroundColor).toBe("rgb(23, 25, 28)");
    expect(title?.style.fontSize).toBe("118px");
    expect(title?.style.borderRadius).toBe("8px");
    expect(title?.style.visibility).not.toBe("hidden");
  });
});
