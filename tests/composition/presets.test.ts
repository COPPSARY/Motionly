import { describe, expect, it } from "vitest";
import gsap from "gsap";
import * as presets from "../../src/composition/presets";

describe("GSAP-first motion presets", () => {
  it("ships a focused professional preset surface", () => {
    expect(Object.keys(presets).sort()).toEqual([
      "ambientWaves",
      "blurReveal",
      "cameraPull",
      "cameraPush",
      "cameraZoomPan",
      "charSpringBounce",
      "continuousTextGradient",
      "giantKineticCrop",
      "gradientSweep",
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
      "wordSlideRotate",
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
    const firstCard = document.createElement("div");
    const secondCard = document.createElement("div");
    const cards = [firstCard, secondCard];

    presets.cameraPush(timeline, camera, { scale: 1.15, at: 0 });
    presets.maskWipe(timeline, firstCard, { direction: "right", at: 0.2 });
    presets.morph(
      timeline,
      secondCard,
      { borderRadius: 24, scale: 1.05 },
      { at: 0.4 },
    );
    presets.staggerEntrance(timeline, cards, { at: 0.6, stagger: 0.1 });

    expect(timeline.getChildren().length).toBeGreaterThanOrEqual(4);
  });
});
