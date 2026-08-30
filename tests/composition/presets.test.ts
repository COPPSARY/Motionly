import { describe, expect, it } from "vitest";
import gsap from "gsap";
import * as presets from "../../src/composition/presets";

describe("GSAP-first motion presets", () => {
  it("ships a focused professional preset surface", () => {
    expect(Object.keys(presets).sort()).toEqual([
      "blurReveal",
      "cameraPull",
      "cameraPush",
      "maskWipe",
      "morph",
      "reveal",
      "rotateReveal",
      "scalePop",
      "sceneHandoff",
      "slide",
      "splitText",
      "spring",
      "staggerEntrance",
      "staggerExit",
      "textReveal",
    ]);
  });

  it("composes overlapping motion into a caller-owned timeline", () => {
    const timeline = gsap.timeline({ paused: true });
    const card = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = "Motion graphics";
    presets.slide(timeline, card, { at: 0, direction: "up" });
    presets.textReveal(timeline, title, { at: 0.18, unit: "words" });
    expect(timeline.getChildren().length).toBeGreaterThanOrEqual(2);
    expect(title.querySelectorAll("span")).toHaveLength(3);
  });

  it("supports masks, camera moves, morphs, and stagger without hidden state", () => {
    const timeline = gsap.timeline({ paused: true });
    const camera = document.createElement("div");
    const cards = [
      document.createElement("div"),
      document.createElement("div"),
    ];
    presets.maskWipe(timeline, camera, { at: 0 });
    presets.cameraPush(timeline, camera, { at: 0.3, scale: 1.25, x: -80 });
    presets.morph(timeline, camera, { borderRadius: 32 }, { at: 0.6 });
    presets.staggerEntrance(timeline, cards, { at: 0.5, stagger: 0.08 });
    timeline.seek(1.5);
    expect(camera.style.transform).toContain("translate");
    expect(cards.every((card) => card.style.opacity === "1")).toBe(true);
  });

  it("composes directional scene handoffs without a hard visibility cut", () => {
    const timeline = gsap.timeline({ paused: true });
    const outgoing = document.createElement("section");
    const incoming = document.createElement("section");
    document.body.append(outgoing, incoming);
    gsap.set(outgoing, { autoAlpha: 1 });
    gsap.set(incoming, { autoAlpha: 0 });

    presets.sceneHandoff(timeline, outgoing, incoming, {
      at: 0.4,
      direction: "left",
    });
    timeline.seek(0.8);

    expect(incoming.style.visibility).toBe("inherit");
    expect(incoming.style.clipPath).not.toBe("inset(0px 0px 0px 100%)");
    timeline.seek(1.3);
    expect(outgoing.style.visibility).toBe("hidden");
    expect(incoming.style.visibility).toBe("inherit");
  });
});
