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
  const base = `${elementId}_copy`;
  let id = base;
  let suffix = 2;
  while (usedNames.has(id)) id = `${base}_${suffix++}`;

  const sourceImport = program.body.find(
    (node): node is ImportNode => node.type === 'Import' && node.name === elementId
  );
  const clone: ElementNode = {
    ...source,
    name: id,
    properties: {
      ...source.properties,
      x: Number(source.properties['x'] ?? 0) + offset,
      y: Number(source.properties['y'] ?? 0) + offset,
    },
  };
  const animations = program.body
    .filter((node): node is AnimationNode => node.type === 'Animation' && node.target === elementId)
    .map((animation) => cloneAnimation(animation, id));

  const body = [...program.body];
  const sourceIndex = body.indexOf(source);
  const additions: ProgramNode['body'] = [];
  if (sourceImport) additions.push({ ...sourceImport, name: id });
  additions.push(clone, ...animations);
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
