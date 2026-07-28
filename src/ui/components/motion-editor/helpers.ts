import { isLoadedAudio, type LoadedAsset } from '../../../assets/asset-loader';
import { waveformPath } from '../../../assets/audio-waveform';
import { normalizeSpeed } from '../../audio-clips';
import type { AnimationNode, ProgramNode } from '../../../types/parser';
import type { Asset, Clip, Element, EvaluatedElement } from '../../../types/scene';
import type { TimelineLane } from '../../timeline-lanes';

/**
 * Waveform for the portion of the source a clip actually plays, so trimming or
 * retiming a clip re-draws the bar instead of showing the whole file.
 *
 * A retimed clip covers `duration * speed` seconds of source in the same bar
 * width, so speeding a clip up squeezes more of the waveform into it.
 */
export function clipWaveform(
  asset: LoadedAsset | undefined,
  clip: Pick<Clip, 'trimIn' | 'duration' | 'speed'>
): { path: string; width: number } | null {
  if (!isLoadedAudio(asset)) return null;
  const peaks = asset.motionlyPeaks;
  const total = asset.motionlyDuration;
  if (!peaks?.length || !(total > 0)) return null;
  const at = (seconds: number) => Math.round((seconds / total) * peaks.length);
  const played = clip.duration * normalizeSpeed(clip.speed);
  const from = Math.max(0, Math.min(peaks.length - 1, at(clip.trimIn)));
  const to = Math.max(from + 1, Math.min(peaks.length, at(clip.trimIn + played)));
  const slice = peaks.slice(from, to);
  return { path: waveformPath(slice), width: slice.length };
}

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
