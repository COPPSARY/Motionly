export interface AssetIdentity {
  width: number;
  height: number;
  size?: number;
}

/** Filename is the stable identity shared by local paths and browser uploads. */
export function assetFilename(path: string): string {
  const embeddedMarker = '#motionly-filename=';
  const embeddedIndex = path.lastIndexOf(embeddedMarker);
  if (embeddedIndex >= 0) return decode(path.slice(embeddedIndex + embeddedMarker.length));
  if (path.startsWith('data:')) return '';
  if (path.startsWith('motionly-local:')) {
    return decode(path.slice('motionly-local:'.length).split(/[?#]/, 1)[0] ?? '');
  }
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  const filename = clean.split(/[\\/]/).pop() ?? '';
  return decode(filename);
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function tagEmbeddedAssetPath(dataUrl: string, filename: string): string {
  return `${dataUrl.split('#', 1)[0]}#motionly-filename=${encodeURIComponent(filename)}`;
}

export function significantlyDifferentAsset(
  existing: AssetIdentity,
  replacement: AssetIdentity
): boolean {
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(1, Math.min(a, b));
  return (
    ratio(existing.width, replacement.width) > 1.5 ||
    ratio(existing.height, replacement.height) > 1.5 ||
    (!!existing.size && !!replacement.size && ratio(existing.size, replacement.size) > 2)
  );
}
