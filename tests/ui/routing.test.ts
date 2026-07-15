import { describe, expect, it } from 'vitest';
import { appUrl, initialRoute, relativeAppPath } from '../../src/app/routing';

describe('app routing', () => {
  it('redirects returning users while preserving explicit welcome visits', () => {
    expect(initialRoute('/', false, false)).toBe('onboarding');
    expect(initialRoute('/', false, true)).toBe('editor');
    expect(initialRoute('/', true, true)).toBe('onboarding');
    expect(initialRoute('/editor', false, false)).toBe('editor');
    expect(initialRoute('/Motionly/editor/', false, false, '/Motionly/')).toBe('editor');
    expect(relativeAppPath('/Motionly/editor', '/Motionly/')).toBe('/editor');
    expect(appUrl('preset/logo.svg', '/Motionly/')).toBe('/Motionly/preset/logo.svg');
  });
});
