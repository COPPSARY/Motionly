import type { LoadedAsset } from '../../../assets/asset-loader';
import type { AnimationNode, ProgramNode } from '../../../types/parser';
import type { Asset, Element, EvaluatedElement } from '../../../types/scene';
import type { TimelineLane } from '../../timeline-lanes';

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatPreciseTime(seconds: number): string {
  return `${formatTime(seconds)}.${Math.floor((seconds % 1) * 10)}`;
}

export function propertiesOf(element: Element | EvaluatedElement): Record<string, unknown> {
  return ('render' in element ? element.render : element.properties) as unknown as Record<
    string,
    unknown
  >;
}

export function numericProperty(
  element: Element | EvaluatedElement | null,
  key: string,
  fallback: number
): number {
  if (!element) return fallback;
  const value = propertiesOf(element)[key];
  return typeof value === 'number' ? value : fallback;
}

export function stringProperty(
  element: Element | EvaluatedElement | null,
  key: string,
  fallback: string
): string {
  if (!element) return fallback;
  const value = propertiesOf(element)[key];
  return typeof value === 'string' ? value : fallback;
}

export function elementDetail(element: Element): string {
  if (element.asset?.path) return element.asset.path.split('/').pop() ?? 'Asset';
  if (element.kind === 'text') {
    const value = stringProperty(element, 'value', 'Text');
    return value.length > 24 ? `${value.slice(0, 24)}...` : value;
  }
  if (element.kind === 'overlay') return 'Scene color';
  if (element.kind === 'effect') return 'Effect';
  return 'Layer';
}

export function mergeAssets(current: Asset[], embedded: Asset[]): Asset[] {
  return [...new Map([...current, ...embedded].map((asset) => [asset.name, asset])).values()];
}

export function assetPreviewSource(asset: LoadedAsset | undefined, fallback = ''): string {
  if (!asset) return fallback;
  if (asset.motionlyType === 'lottie') {
    try {
      return asset.toDataURL('image/png');
    } catch {
      return fallback;
    }
  }
  return asset.motionlySource;
}

export function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function timelineLaneLabel(row: TimelineLane): string {
  if (row.kind === 'text') return 'Text';
  if (row.kind === 'asset') return 'Images & video';
  if (row.kind === 'overlay') return 'Scenes';
  return 'Effects';
}

export function ensureAnimationNode(program: ProgramNode, target: string): AnimationNode {
  const existing = program.body.find(
    (item): item is AnimationNode => item.type === 'Animation' && item.target === target
  );
  if (existing) return existing;
  const node: AnimationNode = {
    type: 'Animation',
    target,
    from: { opacity: 0 },
    to: { opacity: 1 },
    keyframes: [],
    delay: 0,
    duration: 1,
    easing: 'soft',
  };
  program.body.push(node);
  return node;
}
