import { evaluateScene } from '../animation/evaluator';
import { parseMotion } from '../language/parser';
import { serializeProgram } from '../language/serializer';
import { buildSceneGraph } from '../scene/scene-graph';
import type { EvaluatedElement, EvaluatedScene } from '../types/scene';

export interface FrameInspection {
  frame: number;
  time: number;
  visibleElements: number;
  signature: string;
}

export interface ProjectInspection {
  ok: boolean;
  duration: number;
  fps: number;
  frameCount: number;
  elementCount: number;
  animationCount: number;
  emptyFrameRanges: Array<{ start: number; end: number }>;
  invalidFrames: number[];
  representativeFrames: FrameInspection[];
  renderSignature: string;
  roundTripStable: boolean;
}

/**
 * Performs a dependency-free semantic headless render. It evaluates every
 * declared frame through the same scene evaluator used by preview and export,
 * then reduces the results to deterministic signatures and diagnostics.
 */
export function inspectMotionProject(source: string): ProjectInspection {
  const ast = parseMotion(source);
  const scene = buildSceneGraph(ast);
  const frameCount = Math.max(1, Math.ceil(scene.canvas.duration * scene.canvas.fps));
  const frames: FrameInspection[] = [];
  const emptyFrames: number[] = [];
  const invalidFrames: number[] = [];
  let aggregate = FNV_OFFSET;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = Math.min(frame / scene.canvas.fps, scene.canvas.duration);
    const evaluated = evaluateScene(scene, time);
    const invalid = hasInvalidNumbers(evaluated);
    const visibleElements = evaluated.elements.filter(isVisible).length;
    const signature = frameSignature(evaluated);

    if (invalid) invalidFrames.push(frame);
    if (visibleElements === 0) emptyFrames.push(frame);
    aggregate = hashString(`${aggregate}:${signature}`);
    frames.push({ frame, time, visibleElements, signature: hex(aggregate) });
  }

  const representativeIndexes = new Set([0, Math.floor((frameCount - 1) / 2), frameCount - 1]);
  const roundTrip = buildSceneGraph(parseMotion(serializeProgram(ast)));
  const roundTripStable = sceneFingerprint(scene) === sceneFingerprint(roundTrip);

  return {
    ok: invalidFrames.length === 0 && roundTripStable,
    duration: scene.canvas.duration,
    fps: scene.canvas.fps,
    frameCount,
    elementCount: scene.elements.length,
    animationCount: scene.animations.length,
    emptyFrameRanges: compactRanges(emptyFrames),
    invalidFrames,
    representativeFrames: frames.filter((frame) => representativeIndexes.has(frame.frame)),
    renderSignature: hex(aggregate),
    roundTripStable,
  };
}

function isVisible(element: EvaluatedElement): boolean {
  const props = element.render as unknown as Record<string, unknown>;
  return Number(props['opacity'] ?? 1) > 0.001;
}

function hasInvalidNumbers(frame: EvaluatedScene): boolean {
  return [frame.camera, ...frame.elements.map((element) => element.render)].some((properties) =>
    Object.values(properties as unknown as Record<string, unknown>).some(
      (value) => typeof value === 'number' && !Number.isFinite(value)
    )
  );
}

function frameSignature(frame: EvaluatedScene): number {
  const state = frame.elements.map((element) => ({
    id: element.id,
    kind: element.kind,
    render: sortedRecord(element.render as unknown as Record<string, unknown>),
  }));
  return hashString(JSON.stringify({ camera: sortedRecord(frame.camera), elements: state }));
}

function sceneFingerprint(scene: ReturnType<typeof buildSceneGraph>): string {
  return JSON.stringify({
    canvas: scene.canvas,
    camera: scene.camera,
    elements: scene.elements,
    animations: scene.animations,
    imports: scene.imports,
    sequences: scene.sequences,
  });
}

function sortedRecord(value: unknown): Record<string, unknown> {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]])
  );
}

function compactRanges(values: number[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const value of values) {
    const last = ranges.at(-1);
    if (last && value === last.end + 1) last.end = value;
    else ranges.push({ start: value, end: value });
  }
  return ranges;
}

const FNV_OFFSET = 0x811c9dc5;

function hashString(value: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hex(value: number): string {
  return value.toString(16).padStart(8, '0');
}
