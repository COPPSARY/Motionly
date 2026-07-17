import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectProvider,
  extractMotion,
  maskEmbeddedAssetPaths,
  requestAssistant,
  restoreEmbeddedAssetPaths,
  resolveChatEndpoint,
} from '../../src/ai/chat';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AI chat helpers', () => {
  it('detects providers, extracts projects, and normalizes custom endpoints', () => {
    expect(detectProvider('sk-ant-test')).toBe('anthropic');
    expect(detectProvider('sk-or-test')).toBe('openrouter');
    expect(detectProvider('sk-proj-test')).toBe('openai');
    expect(detectProvider('AIza-test')).toBe('gemini');
    expect(detectProvider('AQ.test')).toBe('gemini');
    expect(detectProvider('hf_test')).toBe('huggingface');
    expect(detectProvider('ksk-test')).toBeNull();
    expect(detectProvider('unknown')).toBeNull();
    expect(extractMotion('Done\n```motion\ncanvas {\n  duration 2s\n}\n```')).toContain(
      'duration 2s'
    );
    expect(resolveChatEndpoint('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
  });

  it('keeps uploaded asset bytes out of prompts and restores them before loading', () => {
    const assets = [
      { name: 'logo', path: 'data:image/svg+xml;base64,PHN2Zy8+', type: 'svg' as const },
    ];
    const source = 'import "data:image/svg+xml;base64,PHN2Zy8+" as logo\n\nlogo {\n  width 240\n}';

    const masked = maskEmbeddedAssetPaths(source, assets);
    expect(masked).toContain('import "motionly-local:logo" as logo');
    expect(masked).not.toContain('PHN2Zy8+');
    expect(restoreEmbeddedAssetPaths('import "/changed.svg" as logo', assets)).toContain(
      'data:image/svg+xml;base64,PHN2Zy8+'
    );
    expect(
      restoreEmbeddedAssetPaths('import "motionly-local:logo" as renamedLogo', assets)
    ).toContain('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('sends project and asset context directly to an OpenAI-compatible endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Draft\n```motion\ncanvas {\n  duration 2s\n}\n```' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestAssistant(
      {
        apiKey: 'local-key',
        provider: 'custom',
        baseUrl: 'http://localhost:11434/v1',
        model: 'local-model',
      },
      [{ id: 'one', role: 'user', content: 'Use my logo' }],
      'canvas {\n  duration 2s\n}',
      [{ name: 'logo', path: '/assets/logo.svg', type: 'svg' }]
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer local-key');
    expect(String(init.body)).toContain('/assets/logo.svg');
    expect(String(init.body)).toContain('local-model');
    expect(String(init.body)).toContain('NEVER write image name');
    expect(String(init.body)).toContain('Render an imported asset with its alias directly');
  });

  it('routes Gemini keys to Google OpenAI compatibility', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Gemini draft' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestAssistant(
      { apiKey: 'AIza-test', provider: 'gemini', baseUrl: '', model: '' },
      [{ id: 'one', role: 'user', content: 'Draft it' }],
      'canvas { duration 2s }',
      []
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(String(init.body)).toContain('gemini-2.5-flash');
  });

  it('retries a transient Gemini 503 once', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Overloaded' } }), { status: 503 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered' } }] }), {
          status: 200,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAssistant(
      { apiKey: 'AIza-test', provider: 'gemini', baseUrl: '', model: '' },
      [{ id: 'one', role: 'user', content: 'Draft it' }],
      'canvas { duration 2s }',
      []
    );
    await vi.advanceTimersByTimeAsync(800);

    await expect(request).resolves.toBe('Recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces Gemini error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'The requested model is not available.' }), {
          status: 400,
        })
      )
    );

    await expect(
      requestAssistant(
        { apiKey: 'AIza-test', provider: 'gemini', baseUrl: '', model: 'bad-model' },
        [{ id: 'one', role: 'user', content: 'Draft it' }],
        'canvas { duration 2s }',
        []
      )
    ).rejects.toThrow('The requested model is not available.');
  });

  it('appends optional AI Config knowledge to the system context', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestAssistant(
      { apiKey: 'sk-proj-test', provider: 'openai', baseUrl: '', model: '' },
      [{ id: 'one', role: 'user', content: 'Draft it' }],
      'canvas { duration 2s }',
      [],
      'Brand profile (BRAND.md):\nBrand:\nMotionly'
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[0].content).toContain('Brand profile (BRAND.md):');
    expect(body.messages[0].content).toContain('Motionly');
  });

  it('routes Hugging Face tokens with an exact model override', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'HF draft' } }] }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await requestAssistant(
      {
        apiKey: 'hf_test',
        provider: 'huggingface',
        baseUrl: '',
        model: 'deepseek-ai/DeepSeek-R1:fastest',
      },
      [{ id: 'one', role: 'user', content: 'Draft it' }],
      'canvas { duration 2s }',
      []
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(String(init.body)).toContain('deepseek-ai/DeepSeek-R1:fastest');
  });
});
