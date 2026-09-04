import { describe, expect, it } from "vitest";
import { MOTIONLY_SYSTEM_PROMPT } from "../../src/ai/prompt";
import { MOTIONLY_SYSTEM_PROMPT as serverPrompt } from "../../src/ai/gemini-server";
import { createDynamicComposition } from "../../src/composition/dynamic-compiler";
import { CompositionRuntime } from "../../src/composition/runtime";

describe("Motionly AI Prompt and Choreography Rules", () => {
  it("enforces single focal subject and rejects card/chips clutter", () => {
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "FOCUS ON EXACTLY ONE THING PER BEAT",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      'NEVER create "title + subtitle + card" compositions',
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "REAL GSAP MOTION & BUILT-IN MOTIONLY PRESETS",
    );
    expect(MOTIONLY_SYSTEM_PROMPT).toContain(
      "SHAPE MORPHS & DYNAMIC COLOR THEME CHANGES",
    );

    // Must not mandate multi-element cards or chips clutter
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain("Status pill drops in");
    expect(MOTIONLY_SYSTEM_PROMPT).not.toContain(
      "MULTI-ELEMENT SEQUENTIAL STAGGER",
    );
  });

  it("unifies the system prompt across gemini-server and prompt.ts", () => {
    expect(serverPrompt).toBe(MOTIONLY_SYSTEM_PROMPT);
  });

  it("supports executing compositions using wordSlideRotate, morph, and cameraPush presets", () => {
    const html = `
      <template id="motionly-composition-template">
        <main class="motionly-stage" data-edit="stage">
          <div class="world" data-edit="world"></div>
          <h1 class="statement" data-edit="statement">Motionly rethinks product motion.</h1>
          <div class="carrier" data-edit="carrier"></div>
        </main>
      </template>
    `;

    const js = `
      export function buildTimeline(context) {
        const { root, timeline } = context;
        const stage = root.querySelector(".motionly-stage");
        const statement = root.querySelector("[data-edit='statement']");
        const carrier = root.querySelector("[data-edit='carrier']");

        timeline.set(carrier, { width: 300, height: 80, borderRadius: "16px", autoAlpha: 0 }, 0);
        wordSlideRotate(timeline, statement, { at: 0.2, distance: 40 });
        cameraPush(timeline, stage, { scale: 1.05, duration: 4.0 }, 0);
        morph(timeline, carrier, { width: 600, height: 300, borderRadius: "24px", autoAlpha: 1 }, { at: 4.2 });
      }
    `;

    const dynamicComp = createDynamicComposition(html, js, { duration: 6.0 });
    const root = document.createElement("div");
    document.body.append(root);

    const runtime = new CompositionRuntime(dynamicComp, root);
    expect(runtime.timeline.duration()).toBeGreaterThanOrEqual(4.2);
    expect(runtime.elements.has("statement")).toBe(true);
    expect(runtime.elements.has("carrier")).toBe(true);

    runtime.destroy();
    root.remove();
  });
});
