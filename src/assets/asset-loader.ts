/**
 * Asset loader for loading images and SVGs
 */

import type { Scene } from '../types/scene';

export type LoadedAsset = HTMLImageElement & {
  motionlySvg?: {
    width: number;
    height: number;
    paths: Array<{
      d: string;
      stroke: string;
      strokeWidth: number;
      opacity: number;
      lineCap: CanvasLineCap;
      lineJoin: CanvasLineJoin;
      length: number;
    }>;
  };
};

/**
 * Load all assets from scene
 * Returns map of asset names to loaded images
 */
export async function loadAssets(
  scene: Scene,
  baseUrl: string = document.baseURI
): Promise<Map<string, LoadedAsset>> {
  const entries = await Promise.all(
    scene.imports.map(async (asset): Promise<[string, LoadedAsset]> => [
      asset.name,
      await loadAsset(asset.path, baseUrl, asset.type === 'svg'),
    ])
  );
  return new Map(entries);
}

/**
 * Load single asset
 */
async function loadAsset(path: string, baseUrl: string, isSvg: boolean): Promise<LoadedAsset> {
  const url = new URL(path, baseUrl).href;
  const image = new Image() as LoadedAsset;
  image.decoding = 'async';
  image.src = url;
  const svgSource = isSvg ? fetch(url).then((response) => response.text()) : null;
  await Promise.all([image.decode(), svgSource]);
  if (svgSource) image.motionlySvg = parseSvg(await svgSource);
  return image;
}

function parseSvg(source: string): LoadedAsset['motionlySvg'] {
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  const width = viewBox?.[2] ?? Number.parseFloat(svg.getAttribute('width') ?? '1');
  const height = viewBox?.[3] ?? Number.parseFloat(svg.getAttribute('height') ?? '1');
  const paths = Array.from(svg.querySelectorAll('path[d]')).flatMap((path, index) => {
    const stroke = path.getAttribute('stroke');
    if (!stroke || stroke === 'none') return [];
    let length = width + height;
    try {
      length = (path as SVGPathElement).getTotalLength();
    } catch {
      // Detached SVG geometry is unavailable in a few browsers; the reveal still works.
    }
    return [
      {
        d: path.getAttribute('d')!,
        stroke: stroke.startsWith('url(') ? (index ? '#ffffff' : '#8ab4ff') : stroke,
        strokeWidth: Number.parseFloat(path.getAttribute('stroke-width') ?? '1'),
        opacity: Number.parseFloat(path.getAttribute('stroke-opacity') ?? '1'),
        lineCap: (path.getAttribute('stroke-linecap') as CanvasLineCap) || 'butt',
        lineJoin: (path.getAttribute('stroke-linejoin') as CanvasLineJoin) || 'miter',
        length: Math.max(1, length),
      },
    ];
  });
  return { width, height, paths };
}
