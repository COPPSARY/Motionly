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
 * 2. Otherwise auto-generates tracks from registered `data-edit` elements for that scene,
 *    introspecting GSAP tween timings for accurate start/end clips.
 */
export function deriveSceneTracks(
  scene: SceneDefinition,
  registeredElements?: Map<string, HTMLElement>,
  timeline?: gsap.core.Timeline,
): readonly SceneTrack[] {
  if (scene.tracks && scene.tracks.length > 0) {
    const validTracks = registeredElements
      ? scene.tracks.filter((track) => registeredElements.has(track.id))
      : scene.tracks;
    if (validTracks.length > 0) return validTracks;
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

  const tweens = timeline
    ? (timeline.getChildren(true, true, false) as gsap.core.Tween[])
    : [];

  const generatedTracks: SceneTrack[] = [];
  registeredElements.forEach((element, id) => {
    let trackStart = 0;
    let trackEnd = scene.duration;

    if (tweens.length > 0) {
      const matching = tweens.filter((tw) => {
        try {
          const targets = tw.targets?.() ?? [];
          return (
            targets.includes(element) ||
            targets.some(
              (t) =>
                t === element || (t instanceof Node && element.contains(t)),
            )
          );
        } catch {
          return false;
        }
      });

      if (matching.length > 0) {
        const minStart = Math.min(...matching.map((tw) => tw.startTime()));
        const maxEnd = Math.max(...matching.map((tw) => tw.endTime()));
        trackStart = Math.max(0, Math.round(minStart * 100) / 100);
        trackEnd = Math.max(trackStart + 0.3, Math.round(maxEnd * 100) / 100);
      }
    }

    generatedTracks.push({
      id,
      label: humanizeLabel(id),
      kind: detectElementKind(element),
      start: trackStart,
      end: trackEnd,
    });
  });

  return generatedTracks.length > 0
    ? generatedTracks
    : [
        {
          id: `${scene.id}-main`,
          label: scene.label,
          kind: "Element",
          start: 0,
          end: scene.duration,
        },
      ];
}
