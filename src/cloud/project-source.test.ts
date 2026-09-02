import { describe, expect, it } from "vitest";
import {
  combineCompositionSource,
  splitCompositionSource,
} from "./project-source";

describe("project source bundles", () => {
  it("extracts scoped styles into the canonical four-file bundle", () => {
    const files = splitCompositionSource(
      '<template id="demo"><style>.scene { color: red; }</style><main class="scene">Hi</main></template>',
      "export function buildTimeline() {}",
      'import compositionHtml from "./composition.html?raw";\nexport const composition = { sourcePreview: compositionHtml };',
    );

    expect(files["composition.html"]).not.toContain("<style>");
    expect(files["styles.css"]).toBe(".scene { color: red; }");
    expect(files["timeline.js"]).toContain("buildTimeline");
    expect(files["index.ts"]).toContain("composition");
    expect(files["index.ts"]).toContain(
      'import compositionStyles from "./styles.css?raw"',
    );
    expect(files["index.ts"]).toContain("compositionSource");
  });

  it("combines HTML and CSS for a browser preview without changing the stored files", () => {
    const files = splitCompositionSource(
      '<template id="demo"><style>.scene { color: red; }</style><main class="scene">Hi</main></template>',
      "export function buildTimeline() {}",
      "export const composition = {};",
    );

    expect(combineCompositionSource(files)).toContain(
      "<style>\n.scene { color: red; }\n</style>",
    );
    expect(files["composition.html"]).not.toContain("<style>");
  });
});
