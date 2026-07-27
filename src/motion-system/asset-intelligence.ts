/**
 * Asset intelligence.
 *
 * Assets stop being generic images. Every import is classified into an
 * `AssetKind`, and each kind maps to the showcases and layouts that present it
 * professionally. This is the bridge between "the user dropped three PNGs" and
 * "use a deviceStack of browserShowcases".
 *
 * Classification is deterministic: filename intent first (an explicit
 * `logo.svg` is a logo), then declared asset type, then geometry. No network
 * calls, no model inference — the same asset always classifies the same way, so
 * generated projects are reproducible.
 */

import { assetFilename } from '../assets/asset-resolution';
import type { Asset } from '../types/scene';
import type { AssetKind } from './asset-kinds';
import type { LayoutType } from './layout';
import type { ShowcaseType } from './showcase';

export interface ClassifiedAsset {
  asset: Asset;
  filename: string;
  kind: AssetKind;
  /** Width / height, defaulted to 16:9 when the asset has no measured size. */
  ratio: number;
  /** True when the filename gave no intent and geometry drove the decision. */
  inferred: boolean;
}

export interface PresentationRecommendation {
  kind: AssetKind;
  count: number;
  /** Showcases that frame a single asset of this kind. */
  showcases: readonly ShowcaseType[];
  /** Layouts that arrange several assets of this kind. */
  layouts: readonly LayoutType[];
  /** Short human-readable justification, surfaced to the AI as a brief line. */
  reason: string;
}

const LOGO = /(^|[-_. ])(logo|wordmark|brandmark|brand|mark)([-_. ]|$)/;
const ICON = /(^|[-_. ])(icon|glyph|symbol|favicon)([-_. ]|$)/;
const AVATAR = /(^|[-_. ])(avatar|headshot|portrait|profile|team|founder)([-_. ]|$)/;
const CHART = /(^|[-_. ])(chart|graph|plot|metrics?|analytics|revenue)([-_. ]|$)/;
const UI = /(^|[-_. ])(ui|dashboard|app|admin|console|panel|editor|settings)([-_. ]|$)/;
const SCREENSHOT = /(^|[-_. ])(screenshot|screen|capture|shot|frame|mockup|preview)([-_. ]|$)/;
const ILLUSTRATION = /(^|[-_. ])(illustration|drawing|art|graphic|diagram|scene)([-_. ]|$)/;
// `img`/`image` are deliberately absent: they are generic export names carrying
// no design intent, so those assets fall through to geometry instead.
const PHOTO = /(^|[-_. ])(photo|picture|hero|background|bg)([-_. ]|$)/;

/** Classify one asset into a presentation-relevant kind. */
export function classifyAsset(asset: Asset): ClassifiedAsset {
  const filename = assetFilename(asset.path) || asset.name;
  const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const ratio = asset.width && asset.height ? asset.width / Math.max(1, asset.height) : 16 / 9;
  const named = namedKind(stem, asset);
  if (named) {
    return { asset, filename, kind: refineCapture(named, asset, ratio), ratio, inferred: false };
  }
  return { asset, filename, kind: geometryKind(asset, ratio), ratio, inferred: true };
}

/**
 * `ui` and `screenshot` describe the same act of capturing a screen, and
 * filenames mix them freely (`app-screenshot.png`). Shape decides which frame it
 * belongs in: portrait is a phone capture, landscape is a desktop interface.
 */
function refineCapture(kind: AssetKind, asset: Asset, ratio: number): AssetKind {
  if (kind !== 'ui' && kind !== 'screenshot') return kind;
  if (!asset.width || !asset.height) return kind;
  if (ratio < 0.8) return 'screenshot';
  if (ratio >= 1.4) return 'ui';
  return kind;
}

export function classifyAssets(assets: readonly Asset[]): ClassifiedAsset[] {
  return assets.map(classifyAsset);
}

function namedKind(stem: string, asset: Asset): AssetKind | null {
  if (asset.type === 'video') return 'video';
  if (LOGO.test(stem)) return 'logo';
  if (ICON.test(stem)) return 'icon';
  if (AVATAR.test(stem)) return 'avatar';
  if (CHART.test(stem)) return 'chart';
  if (UI.test(stem)) return 'ui';
  if (SCREENSHOT.test(stem)) return 'screenshot';
  if (ILLUSTRATION.test(stem)) return 'illustration';
  if (PHOTO.test(stem)) return 'photo';
  return null;
}

/**
 * Geometry fallback. Small squares read as icons, tall narrow media reads as a
 * phone capture, wide media reads as a desktop UI capture.
 */
function geometryKind(asset: Asset, ratio: number): AssetKind {
  if (asset.type === 'video') return 'video';
  if (asset.type === 'lottie') return 'illustration';
  const size = Math.max(asset.width ?? 0, asset.height ?? 0);
  const square = ratio > 0.9 && ratio < 1.12;
  if (asset.type === 'svg') {
    if (square && size > 0 && size <= 128) return 'icon';
    return square ? 'logo' : 'illustration';
  }
  if (square && size > 0 && size <= 192) return 'icon';
  if (ratio < 0.72) return 'screenshot';
  if (ratio >= 1.5) return 'ui';
  return 'photo';
}

const recommendations: Record<
  AssetKind,
  { single: readonly ShowcaseType[]; multiple: readonly LayoutType[]; reason: string }
> = {
  logo: {
    single: ['productHero'],
    multiple: ['logoWall'],
    reason: 'Brand marks open or close a film; many marks become social proof.',
  },
  icon: {
    single: ['productHero'],
    multiple: ['bentoGrid', 'featureGrid'],
    reason: 'Icons carry feature meaning, so they belong in a rhythmic grid.',
  },
  screenshot: {
    single: ['phoneShowcase'],
    multiple: ['deviceStack', 'carousel', 'masonryGrid'],
    reason: 'Tall captures read as app screens and want a device frame.',
  },
  ui: {
    single: ['dashboardShowcase', 'browserShowcase', 'laptopShowcase'],
    multiple: ['deviceStack', 'comparisonLayout', 'masonryGrid'],
    reason: 'Wide product UI wants a desktop frame and a camera push into detail.',
  },
  illustration: {
    single: ['screenshotPresentation'],
    multiple: ['gallery', 'floatingCollage'],
    reason: 'Illustrations present flat, without a device frame.',
  },
  photo: {
    single: ['screenshotPresentation'],
    multiple: ['gallery', 'masonryGrid'],
    reason: 'Photography fills the frame; grids keep several photos calm.',
  },
  video: {
    single: ['browserShowcase', 'appWindow'],
    multiple: ['carousel'],
    reason: 'Motion media plays inside a frame so the surrounding shot stays still.',
  },
  avatar: {
    single: ['screenshotPresentation'],
    multiple: ['featureGrid', 'logoWall'],
    reason: 'People read best at equal weight in a uniform grid.',
  },
  chart: {
    single: ['dashboardShowcase'],
    multiple: ['bentoGrid', 'comparisonLayout'],
    reason: 'Data wants a panel and a camera move that lands on the number.',
  },
  unknown: {
    single: ['screenshotPresentation'],
    multiple: ['gallery'],
    reason: 'Unclassified media presents flat until its role is confirmed.',
  },
};

/** Recommend how to present `count` assets of one kind. */
export function recommendPresentation(kind: AssetKind, count = 1): PresentationRecommendation {
  const entry = recommendations[kind];
  return {
    kind,
    count,
    showcases: entry.single,
    layouts: count > 1 ? entry.multiple : [],
    reason: entry.reason,
  };
}

/** Group classified assets by kind and recommend a presentation per group. */
export function recommendPresentations(
  assets: readonly Asset[]
): readonly PresentationRecommendation[] {
  const counts = new Map<AssetKind, number>();
  for (const classified of classifyAssets(assets)) {
    counts.set(classified.kind, (counts.get(classified.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([kind, count]) => recommendPresentation(kind, count));
}

/** Prompt section: what the assets are and how the engine wants them presented. */
export function assetIntelligencePrompt(assets: readonly Asset[]): string {
  if (!assets.length) {
    return 'Asset intelligence: no local assets. Ask for real product media instead of drawing a substitute.';
  }
  const rows = classifyAssets(assets).map((item) => {
    const geometry =
      item.asset.width && item.asset.height
        ? `${item.asset.width}x${item.asset.height}`
        : 'size unknown';
    const presentation = recommendPresentation(item.kind);
    return `- ${item.asset.name} (${item.filename}): kind=${item.kind}${item.inferred ? ' (inferred)' : ''}, ${geometry}, present with ${presentation.showcases.join(' | ')}`;
  });
  const groups = recommendPresentations(assets)
    .filter((group) => group.layouts.length)
    .map(
      (group) =>
        `- ${group.count}x ${group.kind}: arrange with ${group.layouts.join(' | ')} — ${group.reason}`
    );
  return [
    'Asset intelligence (classification drives component selection):',
    ...rows,
    ...(groups.length ? ['Multi-asset arrangements:', ...groups] : []),
  ].join('\n');
}
