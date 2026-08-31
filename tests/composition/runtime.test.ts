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

describe("code-first composition runtime", { timeout: 15_000 }, () => {
  it("builds the product film directly from HTML and GSAP", () => {
    const runtime = createRuntime();
    expect(runtime.timeline.duration()).toBeCloseTo(34, 3);
    expect(runtime.root.querySelector(".intro-scene")).not.toBeNull();
    expect(runtime.root.querySelector(".product-stage")).not.toBeNull();
    expect(runtime.elements.has("final-cta")).toBe(true);
  });

  it("seeks deterministically across scenes and frame boundaries", () => {
    const runtime = createRuntime();
    runtime.seek(3.75);
    expect(runtime.snapshot.sceneId).toBe("problem");
    expect(runtime.time).toBeCloseTo(3.75, 3);
    runtime.seek(25.1);
    expect(runtime.snapshot.sceneId).toBe("lab");
    runtime.seek(100);
    expect(runtime.time).toBe(34);
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
    runtime.seek(27.2);
    runtime.seek(5.1);
    runtime.seek(23.7);
    runtime.seek(22.4);

    const artboard = runtime.elements.get("artboard");
    const headline = runtime.elements.get("artboard-headline");
    expect(artboard?.style.visibility).not.toBe("hidden");
    expect(headline?.style.visibility).not.toBe("hidden");

    runtime.play();
    expect(runtime.snapshot.playing).toBe(true);
    expect(runtime.time).toBeCloseTo(22.4, 2);
  });

  it("preserves animated split-text spans when the editor changes copy", () => {
    const runtime = createRuntime();
    const line = runtime.elements.get("final-line-one");
    expect(line?.dataset["motionlySplitUnit"]).toBe("words");
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

    const animatedToken = title?.firstElementChild as HTMLElement | null;
    expect(title?.style.translate).toBe("24px 0px");
    expect(title?.style.scale).toBe("1.04");
    expect(animatedToken?.style.transform).not.toBe("");
    expect(title?.style.color).toBe("rgb(255, 112, 94)");
    expect(title?.style.backgroundColor).toBe("rgb(23, 25, 28)");
    expect(title?.style.fontSize).toBe("118px");
    expect(title?.style.borderRadius).toBe("8px");
    expect(title?.style.visibility).not.toBe("hidden");
  });
});
