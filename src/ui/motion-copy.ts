import type { AnimationNode, ElementNode, ProgramNode } from '../types/parser';

export interface MotionClipboard {
  source: string;
  animations: AnimationNode[];
  base: Record<string, unknown>;
}

export function copyMotion(program: ProgramNode, source: string): MotionClipboard | null {
  const element = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.name === source
  );
  const animations = program.body
    .filter((node): node is AnimationNode => node.type === 'Animation' && node.target === source)
    .map((animation) => structuredClone(animation));
  return element && animations.length
    ? { source, animations, base: structuredClone(element.properties) }
    : null;
}

export function pasteMotion(
  program: ProgramNode,
  clipboard: MotionClipboard,
  target: string,
  mode: 'relative' | 'absolute' = 'relative'
): void {
  const targetElement = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.name === target
  );
  if (!targetElement) return;
  program.body = program.body.filter((node) => node.type !== 'Animation' || node.target !== target);
  const rebase = (properties: Record<string, unknown>) => {
    if (mode === 'absolute') return structuredClone(properties);
    const next = structuredClone(properties);
    for (const key of ['x', 'y', 'rotation']) {
      if (next[key] === undefined) continue;
      next[key] =
        Number(next[key]) -
        Number(clipboard.base[key] ?? 0) +
        Number(targetElement.properties[key] ?? 0);
    }
    if (next['scale'] !== undefined) {
      const sourceScale = Number(clipboard.base['scale'] ?? 1) || 1;
      next['scale'] =
        (Number(next['scale']) / sourceScale) * Number(targetElement.properties['scale'] ?? 1);
    }
    return next;
  };
  for (const source of clipboard.animations) {
    program.body.push({
      ...structuredClone(source),
      target,
      from: rebase(source.from ?? {}),
      to: rebase(source.to ?? {}),
      keyframes: source.keyframes?.map((frame) => ({
        ...frame,
        properties: rebase(frame.properties),
      })),
    });
  }
}
