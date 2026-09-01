import { describe, expect, it } from "vitest";
import type { SceneDefinition } from "../../src/composition/types";
import {
  deriveSceneTracks,
  formatTimelineSeconds,
} from "../../src/ui/timeline-data";

describe("timeline editor data", () => {
  it("formats floating-point timing without precision noise", () => {
    expect(formatTimelineSeconds(4.65 * 1.5)).toBe("6.98s");
    expect(formatTimelineSeconds(11.625)).toBe("11.63s");
    expect(formatTimelineSeconds(5)).toBe("5s");
  });

  it("only exposes authored tracks backed by registered editable elements", () => {
    const scene: SceneDefinition = {
      id: "intro",
      label: "Intro",
      start: 0,
      duration: 3,
      accent: "#fff",
      tracks: [
        { id: "real-layer", label: "Real", kind: "Text", start: 0, end: 2 },
        {
          id: "missing-layer",
          label: "Missing",
          kind: "Text",
          start: 1,
          end: 3,
        },
      ],
    };
    const registered = new Map([
      ["real-layer", document.createElement("span")],
    ]);

    expect(
      deriveSceneTracks(scene, registered).map((track) => track.id),
    ).toEqual(["real-layer"]);
  });
});
