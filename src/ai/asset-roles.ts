import { assetFilename } from '../assets/asset-resolution';
import type { Asset } from '../types/scene';

export type AssetRole =
  'hero' | 'product' | 'logo' | 'feature' | 'walkthrough' | 'before' | 'after' | 'unknown';

export interface AnalyzedAsset {
  asset: Asset;
  filename: string;
  role: AssetRole;
  order?: number;
  frame: 'phone' | 'browser' | 'laptop';
  ambiguous: boolean;
}

export function analyzeAssets(assets: readonly Asset[]): AnalyzedAsset[] {
  return assets
    .map((asset) => {
      const filename = assetFilename(asset.path) || asset.name;
      const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
      const numbered = /^(?:(\d+)[-_])|(?:feature|step)[-_]?(\d+)/.exec(stem);
      const order = Number(numbered?.[1] ?? numbered?.[2]);
      const role: AssetRole = /(^|[-_])(logo|wordmark|brand)([-_]|$)/.test(stem)
        ? 'logo'
        : /(^|[-_])(before)([-_]|$)/.test(stem)
          ? 'before'
          : /(^|[-_])(after)([-_]|$)/.test(stem)
            ? 'after'
            : /(^|[-_])step[-_]?\d+/.test(stem)
              ? 'walkthrough'
              : /(^|[-_])feature[-_]?\d+/.test(stem)
                ? 'feature'
                : /(^|[-_])hero([-_]|$)/.test(stem)
                  ? 'hero'
                  : /(^|[-_])(product|screenshot|dashboard|app)([-_]|$)/.test(stem)
                    ? 'product'
                    : 'unknown';
      const ratio = asset.width && asset.height ? asset.width / Math.max(1, asset.height) : 16 / 9;
      const frame: AnalyzedAsset['frame'] =
        ratio < 0.78 ? 'phone' : ratio > 1.75 ? 'laptop' : 'browser';
      return {
        asset,
        filename,
        role,
        ...(Number.isFinite(order) && order > 0 ? { order } : {}),
        frame,
        ambiguous: role === 'unknown',
      };
    })
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
        left.filename.localeCompare(right.filename)
    );
}

export function assetMappingPrompt(assets: readonly Asset[]): string {
  if (!assets.length)
    return 'Asset mapping: no local assets. Request required product/logo media instead of drawing a substitute.';
  const analyzed = analyzeAssets(assets);
  const lines = analyzed.map(({ asset, filename, role, order, frame }) => {
    const dimensions =
      asset.width && asset.height ? `${asset.width}x${asset.height}` : 'dimensions unavailable';
    return `- ${asset.name} (${filename}): role=${role}${order ? `, order=${order}` : ''}, frame=${frame}, ${dimensions}${asset.dominantColor ? `, dominant=${asset.dominantColor}` : ''}`;
  });
  const ambiguous = analyzed.filter((item) => item.ambiguous).map((item) => item.asset.name);
  return `Asset mapping (confirm this as // comments in generated source):\n${lines.join('\n')}${
    ambiguous.length
      ? `\nAmbiguous aliases: ${ambiguous.join(', ')}. Ask one concise mapping question and do not generate source until resolved.`
      : ''
  }`;
}
