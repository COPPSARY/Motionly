import { afterEach, describe, expect, it } from "vitest";
import { CompositionRuntime } from "../../src/composition/runtime";
import { demoComposition } from "../../src/compositions/demo";

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
  it("builds the product film directly from TypeScript and GSAP", () => {
    const runtime = createRuntime();
    expect(runtime.timeline.duration()).toBeCloseTo(27, 3);
    expect(runtime.root.querySelector(".brand-scene")).not.toBeNull();
    expect(runtime.root.querySelector(".studio-window")).not.toBeNull();
    expect(runtime.elements.has("final-cta")).toBe(true);
  });

  it("seeks deterministically across scenes and frame boundaries", () => {
    const runtime = createRuntime();
    runtime.seek(4.43);
    expect(runtime.snapshot.sceneId).toBe("code");
    expect(runtime.time).toBeCloseTo(4.4333, 3);
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
    expect(cta?.style.opacity).toBe("0.8");
    runtime.restart();
    expect(runtime.snapshot.playing).toBe(true);
  });
});
