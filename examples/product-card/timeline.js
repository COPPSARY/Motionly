import { slide, staggerEntrance } from "../../src/composition/presets";

function required(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing composition element: ${selector}`);
  return element;
}

export function buildProductCardTimeline({ root, timeline, register }) {
  root.querySelectorAll("[data-edit]").forEach((element) => {
    register(element.dataset.edit, element);
  });

  const scene = required(root, ".example-scene");
  const card = required(root, ".example-card");
  const pills = root.querySelectorAll(".example-pills span");

  timeline.set(scene, { autoAlpha: 1 }, 0);
  slide(timeline, card, {
    direction: "up",
    distance: 72,
    duration: 0.72,
    at: 0.2,
  });
  staggerEntrance(timeline, pills, {
    distance: 28,
    duration: 0.52,
    stagger: 0.07,
    at: 0.62,
  });
  timeline.to(card, { scale: 1.04, duration: 1.1, ease: "power3.inOut" }, 1.4);
}
