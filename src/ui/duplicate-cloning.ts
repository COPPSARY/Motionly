import type {
  AnimationNode,
  ClipNode,
  ElementNode,
  ImportNode,
  ProgramNode,
} from '../types/parser';
import type { Clip } from '../types/scene';

export interface ElementCloneResult {
  program: ProgramNode;
  id: string;
}

export interface ClipCloneResult {
  program: ProgramNode;
  id: string;
}

/** Clone an authored element, its import alias (when present), and every explicit animation. */
export function cloneElementInProgram(
  program: ProgramNode,
  elementId: string,
  offset = 24
): ElementCloneResult | null {
  const source = program.body.find(
    (node): node is ElementNode => node.type === 'Element' && node.name === elementId
  );
  if (!source) return null;

  const usedNames = new Set(
    program.body.flatMap((node) =>
      node.type === 'Element' || node.type === 'Import' ? [node.name] : []
    )
  );
  const descendants = new Set([elementId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of program.body) {
      if (
        node.type === 'Element' &&
        descendants.has(String(node.properties['parent'] ?? '')) &&
        !descendants.has(node.name)
      ) {
        descendants.add(node.name);
        changed = true;
      }
    }
  }
  const sourceElements = program.body.filter(
    (node): node is ElementNode => node.type === 'Element' && descendants.has(node.name)
  );
  const idMap = new Map<string, string>();
  for (const element of sourceElements) {
    const base = `${element.name}_copy`;
    let next = base;
    let suffix = 2;
    while (usedNames.has(next)) next = `${base}_${suffix++}`;
    usedNames.add(next);
    idMap.set(element.name, next);
  }
  const id = idMap.get(elementId)!;
  const remapProperties = (properties: Record<string, unknown>, root: boolean) => {
    const next = { ...properties };
    for (const key of ['parent', 'mask', 'followThrough', 'motionPath', 'from', 'to']) {
      const mapped = idMap.get(String(next[key] ?? ''));
      if (mapped) next[key] = mapped;
    }
    if (root) {
      next['x'] = Number(next['x'] ?? 0) + offset;
      next['y'] = Number(next['y'] ?? 0) + offset;
    }
    return next;
  };
  const clones = sourceElements.map((element): ElementNode => ({
    ...element,
    name: idMap.get(element.name)!,
    properties: remapProperties(element.properties, element.name === elementId),
  }));
  const animations = program.body
    .filter(
      (node): node is AnimationNode => node.type === 'Animation' && descendants.has(node.target)
    )
    .map((animation) => cloneAnimation(animation, idMap.get(animation.target)!));

  const body = [...program.body];
  const sourceIndex = Math.max(...sourceElements.map((element) => body.indexOf(element)));
  const additions: ProgramNode['body'] = [];
  for (const element of sourceElements) {
    const sourceImport = program.body.find(
      (node): node is ImportNode => node.type === 'Import' && node.name === element.name
    );
    if (sourceImport) additions.push({ ...sourceImport, name: idMap.get(element.name)! });
  }
  additions.push(...clones, ...animations);
  body.splice(sourceIndex + 1, 0, ...additions);
  return { program: { ...program, body }, id };
}

/** Clone a media clip without carrying transition relationships to its new neighbors. */
export function cloneClipInProgram(
  program: ProgramNode,
  sceneIndex: number,
  sourceClip: Pick<Clip, 'assetName' | 'start' | 'duration'>,
  timelineDuration: number,
  frameDuration: number
): ClipCloneResult | null {
  const clipNodes = program.body.filter((node): node is ClipNode => node.type === 'Clip');
  const source = clipNodes[sceneIndex];
  if (!source) return null;

  const duration = Math.max(0, sourceClip.duration);
  const latestStart = Math.max(0, timelineDuration - duration);
  const start = Math.min(latestStart, Math.max(0, sourceClip.start + frameDuration));
  const properties = { ...source.properties };
  delete properties['transitionIn'];
  delete properties['transitionInDuration'];
  delete properties['transitionOut'];
  delete properties['transitionOutDuration'];
  properties['start'] = `${start.toFixed(3)}s`;

  const clone: ClipNode = { ...source, properties };
  const body = [...program.body];
  body.splice(body.indexOf(source) + 1, 0, clone);
  const insertedIndex = sceneIndex + 1;
  return {
    program: { ...program, body },
    id: `clip_${sourceClip.assetName}_${insertedIndex}`,
  };
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
