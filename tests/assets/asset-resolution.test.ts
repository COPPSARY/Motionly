import { describe, expect, it } from 'vitest';
import {
  assetFilename,
  significantlyDifferentAsset,
  tagEmbeddedAssetPath,
} from '../../src/assets/asset-resolution';

describe('asset filename resolution', () => {
  it('uses the same filename for local and embedded browser assets', () => {
    expect(assetFilename('./assets/My%20Logo.svg?version=2')).toBe('My Logo.svg');
    expect(assetFilename('motionly-local:My%20Logo.svg')).toBe('My Logo.svg');
    expect(
      assetFilename(tagEmbeddedAssetPath('data:image/svg+xml;base64,PHN2Zz4=', 'My Logo.svg'))
    ).toBe('My Logo.svg');
    expect(assetFilename('./assets/100%.svg')).toBe('100%.svg');
  });

  it('only warns for materially different content', () => {
    expect(
      significantlyDifferentAsset(
        { width: 1920, height: 1080, size: 1_000_000 },
        { width: 1900, height: 1060, size: 1_100_000 }
      )
    ).toBe(false);
    expect(
      significantlyDifferentAsset(
        { width: 1920, height: 1080, size: 1_000_000 },
        { width: 640, height: 360, size: 100_000 }
      )
    ).toBe(true);
  });
});
