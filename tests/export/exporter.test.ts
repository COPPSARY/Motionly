import { afterEach, describe, expect, it, vi } from 'vitest';
import { canExport, ensureFfmpeg } from '../../src/export/exporter';

describe('MP4 export support', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses deterministic canvas frames instead of MediaRecorder support', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(canExport('mp4')).toBe(true);
  });

  it('offers to install missing FFmpeg and respects cancellation', async () => {
    const confirmInstall = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onInstallChange = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);

    await expect(ensureFfmpeg(confirmInstall, onInstallChange)).resolves.toBe(false);
    await expect(ensureFfmpeg(confirmInstall, onInstallChange)).resolves.toBe(true);
    expect(onInstallChange.mock.calls).toEqual([[true], [false, true]]);
    expect(fetch).toHaveBeenLastCalledWith('/api/exports/ffmpeg', {
      method: 'POST',
      headers: { 'x-motionly-action': 'install-ffmpeg' },
    });
  });

  it('preserves export cancellation while checking FFmpeg', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('Export cancelled', 'AbortError')),
              { once: true }
            );
          })
      )
    );

    const checking = ensureFfmpeg(undefined, undefined, controller.signal);
    controller.abort();
    await expect(checking).rejects.toMatchObject({ name: 'AbortError' });
  });
});
