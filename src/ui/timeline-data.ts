import type {
  SceneDefinition,
  SceneTrack,
  SceneTrackKind,
} from "../composition/types";

export type { SceneTrack, SceneTrackKind };

function humanizeLabel(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function formatTimelineSeconds(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `${rounded
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1")}s`;
}

function detectElementKind(element?: HTMLElement): SceneTrackKind {
  if (!element) return "Element";
  if (
    element instanceof SVGElement ||
    element.tagName.toLowerCase() === "svg"
  ) {
    return "SVG";
  }
  const tag = element.tagName.toLowerCase();
  if (
    tag === "h1" ||
    tag === "h2" ||
    tag === "h3" ||
    tag === "h4" ||
    tag === "h5" ||
    tag === "h6" ||
    tag === "p" ||
    tag === "span" ||
    element.dataset["motionlySplitUnit"] !== undefined
  ) {
    return "Text";
  }
  return "Element";
}

/**
 * Dynamically derives timeline scene tracks for any composition or preset.
 * 1. Returns authored `scene.tracks` if provided by the composition definition.
 * 2. Otherwise auto-generates tracks from registered `data-edit` elements for that scene.
 */
export function deriveSceneTracks(
  scene: SceneDefinition,
  registeredElements?: Map<string, HTMLElement>,
): readonly SceneTrack[] {
  if (scene.tracks && scene.tracks.length > 0) {
    return registeredElements
      ? scene.tracks.filter((track) => registeredElements.has(track.id))
      : scene.tracks;
  }

  if (!registeredElements || registeredElements.size === 0) {
    return [
      {
        id: `${scene.id}-main`,
        label: scene.label,
        kind: "Element",
        start: 0,
        end: scene.duration,
      },
    ];
  }

  const generatedTracks: SceneTrack[] = [];
  registeredElements.forEach((element, id) => {
    // If element ID matches or belongs to this scene, or is relevant
    const belongsToScene =
      id.includes(scene.id) ||
      (scene.id === "problem" && id.includes("beat")) ||
      (scene.id === "intro" && (id.includes("intro") || id.includes("hero"))) ||
      (scene.id === "solutions" && id.includes("sol")) ||
      (scene.id === "product" &&
        (id.includes("prompt") ||
          id.includes("screenshot") ||
          id.includes("morph") ||
          id.includes("generate"))) ||
      (scene.id === "cta" && (id.includes("final") || id.includes("brand")));

    if (belongsToScene) {
      generatedTracks.push({
        id,
        label: humanizeLabel(id),
        kind: detectElementKind(element),
        start: 0.1,
        end: scene.duration,
      });
    }
  });

  if (generatedTracks.length === 0) {
    // Fallback: take all registered elements if none matched scene keywords
    registeredElements.forEach((element, id) => {
      generatedTracks.push({
        id,
        label: humanizeLabel(id),
        kind: detectElementKind(element),
        start: 0,
        end: scene.duration,
      });
    });
  }

  return generatedTracks;
}
