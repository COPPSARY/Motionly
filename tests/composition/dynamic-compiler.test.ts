import { afterEach, describe, expect, it } from "vitest";
import {
  createDynamicComposition,
  sanitizeTimelineScript,
} from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("dynamic-compiler", () => {
  let runtime: CompositionRuntime | null = null;
  let root: HTMLDivElement | null = null;

  afterEach(() => {
    runtime?.destroy();
    root?.remove();
    runtime = null;
    root = null;
  });

  it("sanitizes ES module import and export statements", () => {
    const rawJs = `
      import gsap from "gsap";
      import { wordSlideRotate } from "../../../composition/presets";

      export function buildTimeline(context) {
        context.timeline.to(context.root, { duration: 1 });
      }
    `;

    const sanitized = sanitizeTimelineScript(rawJs);
    expect(sanitized).not.toContain("import gsap");
    expect(sanitized).not.toContain("export function");
    expect(sanitized).toContain("function buildTimeline(context)");
  });

  it("creates a runnable CompositionDefinition from raw strings", () => {
    const html = `
      <template id="dynamic-template">
        <div class="test-container" data-edit="hero-box">
          <h1 data-edit="hero-title">Dynamic Title</h1>
        </div>
      </template>
    `;

    const js = `
      export function buildTimeline(context) {
        const title = context.root.querySelector("[data-edit='hero-title']");
        context.timeline.to(title, { duration: 2, scale: 1.5 });
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, {
      duration: 10.0,
      title: "Test Dynamic Comp",
    });

    expect(dynamicComp.duration).toBe(10.0);
    expect(dynamicComp.title).toBe("Test Dynamic Comp");

    root = document.createElement("div");
    document.body.append(root);

    runtime = new CompositionRuntime(dynamicComp, root);

    expect(runtime.timeline.duration()).toBeGreaterThanOrEqual(2);
    expect(runtime.elements.has("hero-title")).toBe(true);
  });

  it("successfully invokes presets like scalePop when imports are stripped", () => {
    const html = `
      <template id="dynamic-template">
        <div data-edit="box">Hello</div>
      </template>
    `;

    const js = `
      import { scalePop } from "../../../composition/presets";
      export function buildTimeline(context) {
        const box = context.root.querySelector("[data-edit='box']");
        scalePop(context.timeline, box);
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, { duration: 5.0 });
    root = document.createElement("div");
    document.body.append(root);

    runtime = new CompositionRuntime(dynamicComp, root);
    expect(runtime.timeline.duration()).toBeGreaterThan(0);
    expect(runtime.elements.has("box")).toBe(true);
  });
});
