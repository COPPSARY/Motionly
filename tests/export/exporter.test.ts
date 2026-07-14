import { afterEach, describe, expect, it, vi } from 'vitest';
import { canExport } from '../../src/export/exporter';

describe('MP4 export support', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the browser MP4 recorder when available', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (type: string) => type.startsWith('video/mp4'),
    });

    expect(canExport('mp4')).toBe(true);
  });
});
