import { parseTime } from '../core/units';
import type { AnimationNode, ElementNode, ImportNode, ProgramNode } from '../types/parser';
import type { Animation, Element, Scene } from '../types/scene';

export interface ElementClipWindow {
  start: number;
  end: number;
}

interface TimelineSceneIndex {
  animationsByTarget: Map<string, Animation[]>;
  elementsById: Map<string, Element>;
  textPartsByGroup: Map<string, string[]>;
}

const timelineSceneIndexes = new WeakMap<Scene, TimelineSceneIndex>();

function timelineSceneIndex(scene: Scene): TimelineSceneIndex {
  const cached = timelineSceneIndexes.get(scene);
  if (cached) return cached;
  const index: TimelineSceneIndex = {
    animationsByTarget: new Map(),
    elementsById: new Map(scene.elements.map((element) => [element.id, element])),
    textPartsByGroup: new Map(),
  };
  for (const element of scene.elements) {
    const group = String(
      (element.properties as unknown as Record<string, unknown>)['textGroup'] ?? ''
    );
    if (!group) continue;
    const parts = index.textPartsByGroup.get(group);
    if (parts) parts.push(element.id);
    else index.textPartsByGroup.set(group, [element.id]);
  }
  for (const animation of scene.animations) {
    const animations = index.animationsByTarget.get(animation.target);
    if (animations) animations.push(animation);
    else index.animationsByTarget.set(animation.target, [animation]);
  }
  timelineSceneIndexes.set(scene, index);
  return index;
}

export function elementTimelineParentStart(scene: Scene, elementId: string): number {
  const elements = timelineSceneIndex(scene).elementsById;
  const visited = new Set<string>();
  let total = 0;
  let cursor: Element | undefined = elements.get(elementId);
  while (cursor) {
    const parentId = String(cursor.properties.parent ?? '');
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    const parent = elements.get(parentId);
    if (!parent) break;
    total += finiteNumber(parent.properties.start, 0);
    cursor = parent;
  }
  return total;
}

function elementHierarchyTimelineWindow(
  scene: Scene,
  elementId: string,
  timelineDuration: number
): ElementClipWindow {
  const elements = timelineSceneIndex(scene).elementsById;
  const chain: Element[] = [];
  const visited = new Set<string>();
  let cursor = elements.get(elementId);
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    chain.push(cursor);
    cursor = elements.get(String(cursor.properties.parent ?? ''));
  }

  let accumulatedStart = 0;
  let start = 0;
  let end = timelineDuration;
  for (const element of chain.reverse()) {
    const properties = element.properties as unknown as Record<string, unknown>;
    const hasStart = Number.isFinite(Number(properties['start']));
    const duration = Number(properties['duration']);
    const hasDuration = Number.isFinite(duration);
    accumulatedStart += finiteNumber(properties['start'], 0);
    if (hasStart || hasDuration) start = Math.max(start, accumulatedStart);
    if (hasDuration) end = Math.min(end, accumulatedStart + Math.max(0, duration));
  }
  return { start, end: Math.max(start, end) };
}

/** Match the global time used by preview evaluation, including scene/group starts. */
export function elementTimelineRange(
  scene: Scene,
  elementId: string,
  timelineDuration: number
): ElementClipWindow {
  const index = timelineSceneIndex(scene);
  const source = index.elementsById.get(elementId);
  const sourceProperties = source?.properties as unknown as Record<string, unknown> | undefined;
  const parentStart = source ? elementTimelineParentStart(scene, source.id) : 0;
  const hierarchyWindow = source
    ? elementHierarchyTimelineWindow(scene, source.id, timelineDuration)
    : { start: 0, end: timelineDuration };
  const targets = [elementId, ...(index.textPartsByGroup.get(elementId) ?? [])];

  const authoredStart = Number(sourceProperties?.['start']);
  const authoredDuration = Number(sourceProperties?.['duration']);
  const hasAuthoredStart = Number.isFinite(authoredStart);
  const hasAuthoredDuration = Number.isFinite(authoredDuration);
  if (hasAuthoredStart || hasAuthoredDuration) {
    const start = Math.max(hierarchyWindow.start, parentStart + finiteNumber(authoredStart, 0));
    const end = hasAuthoredDuration
      ? Math.min(hierarchyWindow.end, start + Math.max(0, authoredDuration))
      : hierarchyWindow.end;
    return {
      start: timelineNumber(Math.min(timelineDuration, start)),
      end: timelineNumber(Math.min(timelineDuration, Math.max(start, end))),
    };
  }

  const entries: number[] = [];
  const exits: number[] = [];
  if (source && finiteNumber(source.properties.opacity, 1) > 0) entries.push(parentStart);
  const animations = targets.flatMap((target) => index.animationsByTarget.get(target) ?? []);
  for (const animation of animations) {
    if (animation.keyframes.length) {
      const visible = animation.keyframes.filter(
        (frame) => Number(frame.properties['opacity'] ?? 0) > 0
      );
      if (visible[0]) {
        entries.push(parentStart + animation.delay + visible[0].offset * animation.duration);
      }
      const lastVisible = visible.at(-1);
      const nextHidden =
        lastVisible &&
        animation.keyframes.find(
          (frame) =>
            frame.offset > lastVisible.offset && Number(frame.properties['opacity'] ?? 1) <= 0
        );
      if (nextHidden) {
        exits.push(parentStart + animation.delay + nextHidden.offset * animation.duration);
      }
      continue;
    }
    const fromOpacity = Number(animation.from['opacity'] ?? sourceProperties?.['opacity'] ?? 1);
    const toOpacity = Number(animation.to['opacity'] ?? fromOpacity);
    if (toOpacity > 0) entries.push(parentStart + animation.delay);
    if (fromOpacity > 0 && toOpacity <= 0) {
      exits.push(parentStart + animation.delay + animation.duration);
    }
  }

  const inferredStart = entries.length ? Math.min(...entries) : parentStart;
  const start = Math.max(hierarchyWindow.start, inferredStart);
  const inferredEnd = exits.length ? Math.max(start, ...exits) : timelineDuration;
  const end = Math.min(hierarchyWindow.end, inferredEnd);
  return {
    start: timelineNumber(Math.max(0, Math.min(timelineDuration, start))),
    end: timelineNumber(Math.max(0, Math.min(timelineDuration, end))),
  };
}

function timelineNumber(value: number): number {
  return Number(value.toFixed(6));
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function elementClipWindow(
  properties: Record<string, unknown>,
  timelineDuration: number,
  fallback: ElementClipWindow = { start: 0, end: timelineDuration }
): ElementClipWindow {
  if (properties['start'] === undefined || properties['duration'] === undefined) {
    return fallback;
  }
  const start = Math.max(0, parseTime(properties['start'] as string | number));
  const duration = Math.max(0, parseTime(properties['duration'] as string | number));
  return {
    start: Math.min(timelineDuration, start),
    end: Math.min(timelineDuration, start + duration),
  };
}

export function elementWindowProperties(
  properties: Record<string, unknown>,
  start: number,
  end: number,
  minimum = 1 / 60
): Record<string, unknown> {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart + minimum, end);
  return {
    ...properties,
    start: `${safeStart.toFixed(3)}s`,
    duration: `${(safeEnd - safeStart).toFixed(3)}s`,
  };
}

/** Move an element window and every animation targeting it by the same timeline delta. */
export function moveElementClip(
  program: ProgramNode,
  elementId: string,
  start: number,
  end: number,
  previousStart: number,
  minimum = 1 / 60
): boolean {
  const element = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.name === elementId
  );
  if (!element) return false;
  const delta = start - previousStart;
  element.properties = elementWindowProperties(element.properties, start, end, minimum);
  for (const animation of program.body) {
    if (animation.type !== 'Animation' || animation.target !== elementId) continue;
    animation.delay = `${(parseTime(animation.delay ?? 0) + delta).toFixed(3)}s`;
  }
  return true;
}

export interface ElementSplitResult {
  program: ProgramNode;
  leftId: string;
  rightId: string;
}

/** Split a regular element and all authored animations into adjacent visibility windows. */
export function splitElementClip(
  program: ProgramNode,
  elementId: string,
  splitTime: number,
  range: ElementClipWindow,
  rightId: string,
  minimum = 1 / 60
): ElementSplitResult | null {
  if (splitTime - range.start < minimum || range.end - splitTime < minimum) return null;
  const source = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.name === elementId
  );
  if (!source || program.body.some((node) => 'name' in node && node.name === rightId)) return null;

  const sourceImport = program.body.find(
    (node): node is ImportNode => node.type === 'Import' && node.name === elementId
  );
  const left: ElementNode = {
    ...source,
    properties: elementWindowProperties(source.properties, range.start, splitTime, minimum),
  };
  const right: ElementNode = {
    ...source,
    name: rightId,
    properties: elementWindowProperties(source.properties, splitTime, range.end, minimum),
  };
  const rightImport: ImportNode | null = sourceImport ? { ...sourceImport, name: rightId } : null;

  const body = [] as ProgramNode['body'];
  for (const node of program.body) {
    if (node === source) {
      body.push(left);
      if (rightImport) body.push(rightImport);
      body.push(right);
      continue;
    }
    body.push(node);
    if (node.type === 'Animation' && node.target === elementId) {
      body.push(cloneAnimation(node, rightId));
    }
  }
  return { program: { ...program, body }, leftId: elementId, rightId };
}

function cloneAnimation(animation: AnimationNode, target: string): AnimationNode {
  return {
    ...animation,
    target,
    from: animation.from ? { ...animation.from } : undefined,
    to: animation.to ? { ...animation.to } : undefined,
    keyframes: animation.keyframes?.map((frame) => ({
      ...frame,
      properties: { ...frame.properties },
    })),
  };
}
