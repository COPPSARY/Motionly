import { describe, expect, it } from 'vitest';
import { appUrl, relativeAppPath } from '../../src/app/routing';

describe('app routing', () => {
  it('builds root and asset URLs under the configured base path', () => {
    expect(appUrl('', '/Motionly/')).toBe('/Motionly/');
    expect(relativeAppPath('/Motionly/editor', '/Motionly/')).toBe('/editor');
    expect(appUrl('preset/logo.svg', '/Motionly/')).toBe('/Motionly/preset/logo.svg');
  });
});
