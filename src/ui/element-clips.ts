import { parseTime } from '../core/units';
import type { AnimationNode, ElementNode, ImportNode, ProgramNode } from '../types/parser';

export interface ElementClipWindow {
  start: number;
  end: number;
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
