import { afterEach, describe, expect, it, vi } from 'vitest';
import { canExport } from '../../src/export/exporter';

describe('MP4 export support', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses deterministic canvas frames instead of MediaRecorder support', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(canExport('mp4')).toBe(true);
  });
});
