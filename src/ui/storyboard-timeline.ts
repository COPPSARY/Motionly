import type { ScenePlan } from '../motion-system/scenes';
import type { ProgramNode } from '../types/parser';
import type { Element } from '../types/scene';

export interface StoryboardTimelineWindow {
  origin: number;
  duration: number;
  end: number;
}

/**
 * The scene graph contains generated component parts and text fragments. The
 * editor layer list should contain only objects that have an authored AST node;
 * names are deliberately not interpreted because `__` is valid source syntax.
 */
export function authoredEditorElements(
  program: ProgramNode | null,
  elements: readonly Element[]
): Element[] {
  if (!program) return [];
  const authoredNames = new Set(
    program.body.flatMap((node) => (node.type === 'Element' ? [node.name] : []))
  );
  return elements.filter((element) => authoredNames.has(element.id));
}

/** Select the storyboard roots, or the authored members of one open scene. */
export function elementsForStoryboardTimeline(
  elements: readonly Element[],
  storyboard: readonly ScenePlan[],
  activeSceneName: string
): Element[] {
  if (!storyboard.length) return [...elements];
  const active = storyboard.find((plan) => plan.name === activeSceneName);
  const visibleIds = new Set(
    active ? active.members.map((member) => member.id) : storyboard.map((plan) => plan.name)
  );
  return elements.filter((element) => visibleIds.has(element.id));
}

export function storyboardTimelineWindow(
  storyboard: readonly ScenePlan[],
  activeSceneName: string,
  projectDuration: number
): StoryboardTimelineWindow {
  const active = storyboard.find((plan) => plan.name === activeSceneName);
  return active
    ? { origin: active.start, duration: active.duration, end: active.end }
    : { origin: 0, duration: projectDuration, end: projectDuration };
}

export function localizeTimelineRange(
  range: { start: number; end: number },
  window: StoryboardTimelineWindow
): { start: number; end: number } {
  const start = clamp(range.start - window.origin, 0, window.duration);
  const end = clamp(range.end - window.origin, start, window.duration);
  return { start, end };
}

export function timelineTimeFromProject(
  projectTime: number,
  window: StoryboardTimelineWindow
): number {
  return clamp(projectTime - window.origin, 0, window.duration);
}

export function projectTimeFromTimeline(
  timelineTime: number,
  window: StoryboardTimelineWindow
): number {
  // Do not clamp the far edge here: global timelines deliberately grow while a
  // user drags beyond the current project end. Scene callers clamp at their UI
  // boundary where extending a scene is not supported.
  return window.origin + Math.max(0, timelineTime);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
