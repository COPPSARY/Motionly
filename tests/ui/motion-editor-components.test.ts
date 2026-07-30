import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MotionlyApp from '../../src/ui/MotionlyApp.svelte';
import MotionEditor from '../../src/ui/components/MotionEditor.svelte';
import EditorFeedback from '../../src/ui/components/motion-editor/EditorFeedback.svelte';
import NavigationRail from '../../src/ui/components/motion-editor/NavigationRail.svelte';
import MotionEditorBindingsHarness from './fixtures/MotionEditorBindingsHarness.svelte';

const contentPanelCss = readFileSync(
  resolve(process.cwd(), 'src/ui/components/motion-editor/content-panel.css'),
  'utf8'
);
const brandPanelSource = readFileSync(
  resolve(process.cwd(), 'src/ui/components/BrandConfigPanel.svelte'),
  'utf8'
);

function target(): HTMLDivElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

function click(element: Element | null): void {
  if (!(element instanceof HTMLElement)) throw new Error('Expected a clickable element');
  element.click();
}

function canvasContext(): CanvasRenderingContext2D {
  const methods = new Map<PropertyKey, unknown>([
    ['measureText', () => ({ width: 0 })],
    ['createLinearGradient', () => ({ addColorStop: () => undefined })],
    ['getImageData', () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })],
  ]);
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      return methods.get(property) ?? (() => undefined);
    },
    set() {
      return true;
    },
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('motion editor leaf components', () => {
  it('keeps SourceEditor code two-way bound and exposes PreviewStage DOM bindings and callbacks', async () => {
    const onFit = vi.fn();
    const onToggleFullscreen = vi.fn();
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const host = target();
    const instance = mount(MotionEditorBindingsHarness, {
      target: host,
      props: { onFit, onToggleFullscreen, onPointerDown, onPointerMove, onPointerUp },
    });

    const textarea = host.querySelector<HTMLTextAreaElement>('.me-code-textarea');
    expect(textarea).not.toBeNull();
    if (!textarea) throw new Error('Expected source editor textarea');
    textarea.value = 'canvas { duration 2s }';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(instance.getSourceCode()).toBe('canvas { duration 2s }');

    const bindings = instance.getPreviewBindings();
    expect(bindings.canvas).toBe(host.querySelector('.me-preview-canvas'));
    expect(bindings.stage).toBe(host.querySelector('.me-stage'));

    click(host.querySelector('.me-meta-btn'));
    click(host.querySelector('.me-stage-actions .me-icon-btn'));
    bindings.canvas.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    bindings.canvas.dispatchEvent(new Event('pointermove', { bubbles: true }));
    bindings.canvas.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(onFit).toHaveBeenCalledOnce();
    expect(onToggleFullscreen).toHaveBeenCalledOnce();
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(onPointerMove).toHaveBeenCalledOnce();
    expect(onPointerUp).toHaveBeenCalledOnce();

    await unmount(instance);
  });

  it('reports navigation selections and marks the active tab', async () => {
    const onSelect = vi.fn();
    const host = target();
    const instance = mount(NavigationRail, {
      target: host,
      props: { activeTab: 'media', onSelect },
    });

    expect(
      host.querySelector('[aria-label="Media / Assets"]')?.classList.contains('me-active')
    ).toBe(true);
    click(host.querySelector('[aria-label="Text"]'));
    expect(onSelect).toHaveBeenCalledWith('text');

    await unmount(instance);
  });

  it('routes delete undo and preset confirmation actions', async () => {
    const onUndoDelete = vi.fn();
    const onCancelPreset = vi.fn();
    const onConfirmPreset = vi.fn();
    const host = target();
    const instance = mount(EditorFeedback, {
      target: host,
      props: {
        deleteToast: 'Deleted title',
        keyframeNotice: 'Keyframe created',
        showConfirmDialog: true,
        dialogTitle: 'Load Preset',
        dialogMessage: 'Replace the project?',
        dialogConfirmLabel: 'Load Preset',
        onUndoDelete,
        onCancelDialog: onCancelPreset,
        onConfirmDialog: onConfirmPreset,
      },
    });

    click(
      Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Undo') ??
        null
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Load Preset'
      ) ?? null
    );
    expect(onUndoDelete).toHaveBeenCalledOnce();
    expect(onCancelPreset).toHaveBeenCalledOnce();
    expect(onConfirmPreset).toHaveBeenCalledOnce();
    expect(host.querySelector('.me-keyframe-toast')?.textContent).toBe('Keyframe created');

    await unmount(instance);
  });
});

describe('MotionEditor integration', () => {
  it('configures and cancels an export before offering FFmpeg installation', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const savePicker = vi.fn().mockResolvedValue({
      name: 'chosen.mp4',
      getFile: () => Promise.resolve(new File([], 'chosen.mp4')),
      createWritable: () => Promise.resolve({ write: vi.fn(), close: vi.fn() }),
    });
    vi.stubGlobal('showSaveFilePicker', savePicker);
    let finishInstall: ((response: Response) => void) | undefined;
    const installation = new Promise<Response>((resolve) => {
      finishInstall = resolve;
    });
    let ffmpegChecks = 0;
    let firstExportSignal: AbortSignal | null = null;
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== '/api/exports/ffmpeg') return new Response('', { status: 404 });
      if (init?.method === 'POST') return installation;
      ffmpegChecks += 1;
      if (ffmpegChecks === 1) {
        firstExportSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          firstExportSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Export cancelled', 'AbortError')),
            { once: true }
          );
        });
      }
      return new Response('', { status: 503 });
    });
    vi.stubGlobal('fetch', fetch);
    localStorage.removeItem('motionly:auto-save');

    const host = target();
    const instance = mount(MotionlyApp, { target: host });
    await tick();

    click(host.querySelector('.export-action'));
    await tick();
    expect(host.querySelector('.export-settings-dialog')).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('#export-format option')).map((option) => option.textContent)
    ).toEqual(['MP4', 'WebM', 'GIF']);
    expect(host.querySelector<HTMLSelectElement>('#export-fps')?.value).toBe('60');
    expect(host.querySelector<HTMLSelectElement>('#export-resolution')?.value).toBe('1080');
    expect(host.querySelector<HTMLSelectElement>('#export-quality')?.value).toBe('high');
    expect(host.querySelector<HTMLSelectElement>('#export-bitrate')?.value).toBe('10');
    expect(
      Array.from(host.querySelectorAll('#export-quality option')).map(
        (option) => option.textContent
      )
    ).toEqual(['Low', 'Medium', 'High', 'Very High']);
    expect(
      Array.from(host.querySelectorAll('#export-fps option')).map((option) => option.textContent)
    ).toEqual(['24 FPS', '25 FPS', '30 FPS', '50 FPS', '60 FPS']);
    expect(
      Array.from(host.querySelectorAll('#export-bitrate option')).map(
        (option) => option.textContent
      )
    ).toEqual(['2 Mbps', '5 Mbps', '10 Mbps', '20 Mbps', '30 Mbps', '50 Mbps', '100 Mbps']);
    expect(savePicker).not.toHaveBeenCalled();

    const fps = host.querySelector<HTMLSelectElement>('#export-fps');
    const resolution = host.querySelector<HTMLSelectElement>('#export-resolution');
    const quality = host.querySelector<HTMLSelectElement>('#export-quality');
    const bitrate = host.querySelector<HTMLSelectElement>('#export-bitrate');
    if (!fps || !resolution || !quality || !bitrate) throw new Error('Export settings missing');
    fps.value = '30';
    fps.dispatchEvent(new Event('change', { bubbles: true }));
    resolution.value = '720';
    resolution.dispatchEvent(new Event('change', { bubbles: true }));
    quality.value = 'medium';
    quality.dispatchEvent(new Event('change', { bubbles: true }));
    bitrate.value = '5';
    bitrate.dispatchEvent(new Event('change', { bubbles: true }));
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Choose Save Location'
      ) ?? null
    );
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    const pickerOptions = savePicker.mock.calls[0]?.[0] as { suggestedName?: string };
    expect(pickerOptions.suggestedName).toMatch(/^untitled_\d{4}-\d{2}-\d{2}_\d{4}\.mp4$/);
    expect(host.querySelector('.export-spinner')).not.toBeNull();
    expect(host.querySelector('.export-progress-card')?.textContent).toContain('Exporting MP4');
    expect(host.querySelector('.export-progress-card')?.textContent).toContain('0% complete');
    expect(host.querySelector('.export-progress-track')?.getAttribute('aria-valuenow')).toBe('0');
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Cancel Export'
      ) ?? null
    );
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    expect(firstExportSignal?.aborted).toBe(true);
    expect(host.querySelector('.export-spinner')).toBeNull();
    expect(host.querySelector('.export-progress-card')).toBeNull();

    click(host.querySelector('.export-action'));
    await tick();
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Choose Save Location'
      ) ?? null
    );
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    expect(host.querySelector('.me-dialog-header')?.textContent).toContain('Install FFmpeg?');
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Install FFmpeg'
      ) ?? null
    );
    await tick();
    expect(host.querySelector('.me-dialog-spinner')).not.toBeNull();
    expect(host.querySelector('.me-dialog-btn.me-danger')?.textContent).toContain('Installing…');
    expect(host.querySelector<HTMLButtonElement>('.me-dialog-btn.me-secondary')?.disabled).toBe(
      true
    );

    finishInstall?.(new Response(null, { status: 204 }));
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    expect(host.querySelector('.me-dialog')).toBeNull();
    expect(host.querySelector('.export-spinner')).toBeNull();
    expect(host.querySelector('.me-keyframe-toast')?.textContent).toBe('FFmpeg installed.');

    await unmount(instance);
    localStorage.removeItem('motionly:auto-save');
  });

  it('auto-saves a server-backed project before it is reopened', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    let project = `canvas { size 320x180 fps 30 duration 2s background #000000 }
text original { value "Original" center }`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) !== '/api/motion-project') return new Response('', { status: 404 });
        if (init?.method === 'PUT') {
          project = String(init.body);
          return new Response(null, { status: 204 });
        }
        return new Response(project, {
          headers: {
            'content-type': 'text/plain;charset=utf-8',
            'x-motionly-project-name': 'project.motion',
          },
        });
      })
    );

    const saved = project.replace('original', 'restored').replace('Original', 'Restored');
    let host = target();
    let instance = mount(MotionlyApp, { target: host });
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    click(host.querySelector('.me-source-toggle'));
    await tick();
    const textarea = host.querySelector<HTMLTextAreaElement>('.me-code-textarea');
    if (!textarea) throw new Error('Source editor missing');
    textarea.value = saved;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await unmount(instance);
    host.remove();

    host = target();
    instance = mount(MotionlyApp, { target: host });
    await new Promise((resolve) => setTimeout(resolve));
    await tick();
    click(host.querySelector('.me-source-toggle'));
    await tick();
    expect(host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value).toBe(saved);

    await unmount(instance);
  });

  it('restores the auto-saved project after remounting', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    localStorage.removeItem('motionly:auto-save');

    const saved = `canvas { size 320x180 fps 30 duration 2s background #000000 }
text restored { value "Still here" center }`;
    let host = target();
    let instance = mount(MotionlyApp, { target: host });
    await tick();
    click(host.querySelector('.me-source-toggle'));
    await tick();
    const textarea = host.querySelector<HTMLTextAreaElement>('.me-code-textarea');
    if (!textarea) throw new Error('Source editor missing');
    textarea.value = saved;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    await unmount(instance);
    host.remove();

    host = target();
    instance = mount(MotionlyApp, { target: host });
    await tick();
    click(host.querySelector('.me-source-toggle'));
    await tick();
    expect(host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value).toBe(saved);

    await unmount(instance);
    localStorage.removeItem('motionly:auto-save');
  });

  it('drops the retired Bluesky preset autosave after its assets are removed', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    localStorage.setItem(
      'motionly:auto-save',
      JSON.stringify({
        name: 'untitled.motion',
        code: 'import "./pair.jpg" as phonePair\nimport "./hero.jpg" as phoneHero\nimport "./feed.png" as feedUi\nimport "./butterfly.svg" as butterfly',
      })
    );

    const host = target();
    const instance = mount(MotionlyApp, { target: host });
    await tick();
    click(host.querySelector('.me-source-toggle'));
    await tick();

    expect(host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value).toContain(
      'Motion graphics, written.'
    );
    expect(localStorage.getItem('motionly:auto-save')).not.toContain('phonePair');

    await unmount(instance);
    localStorage.removeItem('motionly:auto-save');
  });

  it('deletes selected timeline items with Delete or Backspace', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 2s background #000000 }
text title { value "Title" center }
text subtitle { value "Subtitle" center }`,
        onSave: () => undefined,
      },
    });
    await tick();

    for (const [id, key] of [
      ['title', 'Delete'],
      ['subtitle', 'Backspace'],
    ] as const) {
      const item = host.querySelector<HTMLButtonElement>(`[aria-label="Select or move ${id}"]`);
      if (!item) throw new Error(`Timeline item ${id} missing`);
      click(item);
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await tick();
      expect(host.querySelector(`[aria-label="Select or move ${id}"]`)).toBeNull();
    }

    await unmount(instance);
  });

  it('deletes an imported asset from the asset sidebar', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.stubGlobal(
      'Image',
      class {
        decode = () => Promise.resolve();
      }
    );
    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 2s background #000000 }
import "./logo.png" as logo
import "./other.png" as other
image product { source logo center }
animate product { from { opacity 0 } to { opacity 1 } duration 1s }
clip logo { start 0s duration 2s }
text title { value "Title" center }
text subtitle { value "Subtitle" center }`,
        onSave: () => undefined,
      },
    });
    await tick();

    click(host.querySelector('[aria-label="Show list view"]'));
    await tick();
    expect(host.querySelector('.me-asset-grid')?.classList.contains('me-list-view')).toBe(true);
    click(host.querySelector('[aria-label="Show grid view"]'));
    await tick();
    expect(host.querySelector('.me-asset-grid')?.classList.contains('me-list-view')).toBe(false);

    click(host.querySelector('[aria-label="Select and preview logo"]'));
    await tick();
    expect(host.querySelector('.me-asset-card-wrap')?.classList.contains('me-selected')).toBe(true);
    expect(host.querySelector('[aria-label="Delete selected asset"]')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();
    expect(host.querySelector('[aria-label="Delete selected asset"]')).toBeNull();

    click(host.querySelector('[aria-label="Select and preview logo"]'));
    await tick();
    click(host.querySelector('[aria-label="Text"]'));
    await tick();
    click(host.querySelector('[aria-label="Media / Assets"]'));
    await tick();
    expect(host.querySelector('[aria-label="Delete selected asset"]')).toBeNull();

    click(host.querySelector('[aria-label="Select and preview logo"]'));
    await tick();
    host
      .querySelector('[aria-label="Select and preview other"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    await tick();
    expect(host.querySelectorAll('.me-asset-card-wrap.me-selected')).toHaveLength(2);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    click(host.querySelector('[aria-label="Select and preview logo"]'));
    host
      .querySelector('[aria-label="Select and preview other"]')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, shiftKey: true }));
    await tick();
    expect(host.querySelectorAll('.me-asset-card-wrap.me-selected')).toHaveLength(2);

    click(host.querySelector('[aria-label="Delete selected assets"]'));
    await tick();

    expect(host.querySelector('.me-dialog-body')?.textContent).toContain(
      'Delete 2 selected assets and their timeline items?'
    );
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete'
      ) ?? null
    );
    await tick();
    expect(host.querySelector('[aria-label="Select and preview logo"]')).toBeNull();
    expect(host.querySelector('[aria-label="Select and preview other"]')).toBeNull();

    click(host.querySelector('[aria-label="Text"]'));
    await tick();
    click(host.querySelector('[aria-label="Select title"]'));
    host
      .querySelector('[aria-label="Select subtitle"]')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, shiftKey: true }));
    await tick();
    expect(host.querySelectorAll('.me-layer-row-wrap.me-checked')).toHaveLength(2);
    click(host.querySelector('[aria-label="Delete selected text layers"]'));
    await tick();
    expect(host.querySelector('.me-dialog-body')?.textContent).toContain(
      'Delete 2 selected text layers?'
    );
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Delete'
      ) ?? null
    );
    await tick();

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const source = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';
    expect(source).not.toContain('import ');
    expect(source).not.toContain('image product');
    expect(source).not.toContain('animate product');
    expect(source).not.toContain('clip logo');
    expect(source).not.toContain('text title');
    expect(source).not.toContain('text subtitle');

    await unmount(instance);
  });

  it('places, selects, and edits reusable audio clips', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        // The same file twice, overlapping — the case the old single-audio
        // model could not represent at all.
        code: `canvas { size 320x180 fps 30 duration 12s background #000000 }
track score { label "Audio" role audio content audio order 1 }
import "./tone.wav" as tone
clip tone { track score start 0s duration 6s volume 0.6 fadeIn 1s fadeOut 2s }
clip tone { track score start 4s duration 5s }`,
        onSave: () => undefined,
      },
    });
    await tick();

    expect(host.querySelectorAll('.me-clip.me-audio-clip')).toHaveLength(2);

    click(host.querySelector('[aria-label="Select tone clip"]'));
    await tick();

    // The audio inspector, not the visual clip inspector.
    const volume = host.querySelector<HTMLInputElement>('[aria-label="Clip volume"]');
    expect(volume?.value).toBe('0.6');
    expect(host.querySelector('[aria-label="Mute clip"]')).not.toBeNull();
    expect(host.textContent).toContain('Fade in');
    expect(host.textContent).toContain('-4.4 dB');

    // An audio clip must be able to name a track to move to. Note this covers
    // the inspector's filter against a declared track, not the track the drop
    // handler creates — that path needs a loaded asset and stays manual.
    const trackOptions = host.querySelectorAll('.me-properties-panel select option');
    expect(trackOptions.length).toBeGreaterThan(0);
    expect(Array.from(trackOptions).map((option) => option.textContent)).toContain('Audio');

    volume.value = '0.25';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const widthBefore = parseFloat(
      host.querySelector<HTMLElement>('.me-clip.me-audio-clip')?.style.width ?? '0'
    );
    click(host.querySelector('[aria-label="Set playback speed to 2×"]'));
    await tick();
    expect(host.querySelector('.me-speed-readout')?.textContent).toBe('2.00×');
    const widthAfter = parseFloat(
      host.querySelector<HTMLElement>('.me-clip.me-audio-clip')?.style.width ?? '0'
    );
    expect(widthAfter).toBeLessThan(widthBefore);

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const source = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';
    expect(source).toContain('volume 0.25');
    expect(source).toContain('duration 3.000s');
    expect(source).toContain('speed 2');
    // The second placement is untouched, so one file really is reusable.
    expect(source.match(/clip tone/g)).toHaveLength(2);

    await unmount(instance);
  });

  it('gives a new text layer the short static default instead of the whole project', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 20s background #000000 }`,
        onSave: () => undefined,
      },
    });
    await tick();

    click(host.querySelector('[aria-label="Text"]'));
    await tick();
    click(host.querySelector('[title="Add text"]'));
    await tick();

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const source = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';
    expect(source).toMatch(/text text1 \{[^}]*duration 3\.000s/s);
    expect(source).not.toMatch(/text text1 \{[^}]*duration 20\.000s/s);

    await unmount(instance);
  });

  it('mounts every major region and keeps nested panel styles isolated', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas {
  size 320x180
  fps 30
  duration 2s
  background #000000
}`,
        onSave: () => undefined,
      },
    });
    await tick();

    expect(host.querySelector('.me-content-panel')).not.toBeNull();
    expect(host.querySelector('.me-preview-container')).not.toBeNull();
    expect(host.querySelector('.me-properties-panel')).not.toBeNull();
    expect(host.querySelector('.me-timeline-panel')).not.toBeNull();
    expect(host.querySelector('.me-source-toggle')).not.toBeNull();

    host
      .querySelector('[aria-label="Resize asset panel"]')
      ?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 260 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 320 }));
    window.dispatchEvent(new MouseEvent('pointerup'));
    await tick();
    expect(
      host
        .querySelector<HTMLElement>('.me-workbench')
        ?.style.getPropertyValue('--content-panel-width')
    ).toBe('320px');

    click(host.querySelector('[aria-label="Settings"]'));
    await tick();
    const nestedPanel = host.querySelector<HTMLElement>('.me-content-panel .panel-content');
    expect(nestedPanel).not.toBeNull();
    expect(nestedPanel?.classList.contains('me-panel-content')).toBe(false);
    expect(contentPanelCss).toContain('.me-panel-content');
    expect(contentPanelCss).not.toMatch(/(^|[\s,{>+~])\.panel-content\b/m);
    expect(brandPanelSource).toMatch(/\.panel-content\s*\{[^}]*padding:\s*14px/s);

    await unmount(instance);
  });

  it('creates and updates position keyframes through the visual controls', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 2s background #000000 }
text title { value "Title" x 0 y 0 }`,
        onSave: () => undefined,
      },
    });
    await tick();

    click(host.querySelector('.me-element-clip .me-clip-select'));
    await tick();
    click(host.querySelector('.me-keyframe-add'));
    await tick();
    expect(host.querySelector('.me-keyframe-add')).toBeNull();

    const scrubber = host.querySelector<HTMLInputElement>('.me-timeline-scrubber');
    if (!scrubber) throw new Error('Timeline scrubber missing');
    scrubber.value = '1';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const scaleInput = host.querySelector<HTMLInputElement>('[aria-label="Scale value"]');
    if (!scaleInput) throw new Error('Scale input missing');
    scaleInput.value = '2';
    scaleInput.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    expect(host.querySelectorAll('.me-keyframe-marker')).toHaveLength(2);
    click(host.querySelector('.me-source-toggle'));
    await tick();
    const beforeDelete = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';
    expect(beforeDelete).toContain('50%');
    expect(beforeDelete).toContain('scale 2');
    click(host.querySelector('.me-source-toggle'));
    await tick();

    click(host.querySelector('[aria-label="Keyframe at 50 percent"]'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await tick();
    expect(host.querySelectorAll('.me-keyframe-marker')).toHaveLength(1);

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const serialized = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';
    expect(serialized).toContain('0%');
    expect(serialized).not.toContain('50%');
    expect(serialized).not.toContain('scale 2');

    await unmount(instance);
  });

  it('scales the timeline width to the project duration', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    function timelineWidth(host: HTMLElement): number {
      const scroll = host.querySelector<HTMLElement>('.me-timeline-scroll');
      if (!scroll) throw new Error('Timeline scroll missing');
      const value = scroll.style.getPropertyValue('--timeline-content-width');
      return Number.parseFloat(value);
    }

    function clipWidthPercent(host: HTMLElement): number {
      const clip = host.querySelector<HTMLElement>('.me-element-clip');
      if (!clip) throw new Error('Element clip missing');
      const match = /width:\s*([\d.]+)%/.exec(clip.getAttribute('style') ?? '');
      if (!match) throw new Error('Clip width not found');
      return Number.parseFloat(match[1]);
    }

    // A short (1s) project keeps the clip bar short relative to the ruler; at
    // rest there is no trailing padding.
    const shortHost = target();
    const shortEditor = mount(MotionEditor, {
      target: shortHost,
      props: {
        code: `canvas { size 320x180 fps 30 duration 1s background #000000 }
text title { value "Hi" }`,
        onSave: () => undefined,
      },
    });
    await tick();
    const shortWidth = timelineWidth(shortHost);
    const shortClipPercent = clipWidthPercent(shortHost);

    // ...while a longer (12s) project produces a proportionally wider timeline
    // whose clip does fill the (still fixed-scale) visible duration.
    const longHost = target();
    const longEditor = mount(MotionEditor, {
      target: longHost,
      props: {
        code: `canvas { size 320x180 fps 30 duration 12s background #000000 }
text title { value "Hi" }`,
        onSave: () => undefined,
      },
    });
    await tick();
    const longWidth = timelineWidth(longHost);

    // The ruler spans the content end + a fixed 20s tail (at 100px/s + 220px
    // At rest the ruler spans the content (or the panel if the content is
    // shorter) with no trailing padding, at 100px/s + a 220px label. In jsdom
    // the panel measures 0, so a 12s project is 12s wide and a 1s project falls
    // back to the tiny panel-fill floor — both far from the old 820px minimum.
    expect(longWidth).toBeGreaterThan(shortWidth);
    expect(longWidth).toBeCloseTo(220 + 12 * 100, 0);
    expect(shortWidth).toBeLessThan(820);

    // The 1s clip only covers its own duration within the ruler (well under 100%).
    expect(shortClipPercent).toBeLessThan(100);
    expect(shortClipPercent).toBeCloseTo(62.5, 1);

    // Zoom in/out must rescale the timeline width around that base scale.
    const zoomIn = longHost.querySelector<HTMLElement>('[title="Timeline zoom in"]');
    const zoomOut = longHost.querySelector<HTMLElement>('[title="Timeline zoom out"]');
    if (!zoomIn || !zoomOut) throw new Error('Timeline zoom controls missing');

    click(zoomIn);
    await tick();
    const zoomedInWidth = timelineWidth(longHost);
    expect(zoomedInWidth).toBeGreaterThan(longWidth);
    expect(zoomedInWidth).toBeCloseTo(220 + 12 * 100 * 1.25, 0);

    click(zoomOut);
    await tick();
    expect(timelineWidth(longHost)).toBeCloseTo(longWidth, 0);

    await unmount(shortEditor);
    await unmount(longEditor);
  });

  it('drags a full-duration clip into the empty time and extends the project', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () =>
      null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    // Give the timeline a real width so the visible duration exceeds the 5s project.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 2000,
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 1000,
          bottom: 40,
          width: 1000,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 5s background #000000 }
text title { value "Hi" }`,
        onSave: () => undefined,
      },
    });
    await tick();
    await tick();

    const grip = host.querySelector<HTMLElement>('.me-element-clip .me-clip-select');
    if (!grip) throw new Error('Clip grip missing');

    // Grab near the clip start and drag well to the right (500px of a 1000px,
    // 17.8s-visible lane ≈ 8.9s), which places a 5s clip past the 5s project end.
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 50 }));
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 500 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 500 }));
    await tick();

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const source = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';

    // The element must have moved to a later start...
    const startMatch = /start\s+([\d.]+)s/.exec(source);
    expect(startMatch).not.toBeNull();
    expect(Number.parseFloat(startMatch![1])).toBeGreaterThan(5);
    // ...and the project duration must have grown to contain it.
    const durationMatch = /duration\s+([\d.]+)s/.exec(source);
    expect(durationMatch).not.toBeNull();
    expect(Number.parseFloat(durationMatch![1])).toBeGreaterThan(5);

    delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth;
    await unmount(instance);
  });

  it('extends a text clip (and the project) when dragging its end past the project', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('CSS', { escape: (value: string) => value });
    (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () =>
      null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 2000,
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 1000,
          bottom: 40,
          width: 1000,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 5s background #000000 }
text title { value "Hi" }`,
        onSave: () => undefined,
      },
    });
    await tick();
    await tick();

    const trimEnd = host.querySelector<HTMLElement>('.me-element-clip .me-trim-end');
    if (!trimEnd) throw new Error('Trim-end handle missing');

    // Drag the right edge to ~800px of a 1000px, 17.8s-visible lane (≈14s).
    trimEnd.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 400 })
    );
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 800 }));
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 800 }));
    await tick();

    click(host.querySelector('.me-source-toggle'));
    await tick();
    const source = host.querySelector<HTMLTextAreaElement>('.me-code-textarea')?.value ?? '';

    // The clip and the canvas duration must both have grown past the original 5s.
    const durations = Array.from(source.matchAll(/duration\s+([\d.]+)s/g)).map((m) =>
      Number.parseFloat(m[1])
    );
    expect(durations.length).toBeGreaterThan(0);
    expect(Math.max(...durations)).toBeGreaterThan(5);

    delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth;
    await unmount(instance);
  });

  it('clamps the playhead to the content end, not the padded ruler tail', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    // A wide panel makes the ruler span more than the 5s content, so the
    // scrubber's max exceeds the content end and we can test the clamp.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 2000,
    });

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 5s background #000000 }
text title { value "Hi" }`,
        onSave: () => undefined,
      },
    });
    await tick();

    const scrubber = host.querySelector<HTMLInputElement>('.me-timeline-scrubber');
    if (!scrubber) throw new Error('Timeline scrubber missing');
    // Seek to the far end of the ruler; the playhead must clamp to the 5s
    // content end (frame 150 at 30fps), not the ruler tail.
    scrubber.value = scrubber.max;
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const framecode = host.querySelector('.me-framecode')?.textContent ?? '';
    expect(framecode).toContain('150');

    delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth;
    await unmount(instance);
  });

  it('shows the evaluated scale while the playhead moves between keyframes', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const host = target();
    const instance = mount(MotionEditor, {
      target: host,
      props: {
        code: `canvas { size 320x180 fps 30 duration 2s background #000000 }
text title { value "Title" x 0 y 0 scale 1 }
animate title {
  keyframes {
    0% { scale 1 }
    100% { scale 2 }
  }
  duration 2s
  easing linear
}`,
        onSave: () => undefined,
      },
    });
    await tick();

    click(host.querySelector('.me-element-clip .me-clip-select'));
    const scrubber = host.querySelector<HTMLInputElement>('.me-timeline-scrubber');
    if (!scrubber) throw new Error('Timeline scrubber missing');
    scrubber.value = '1';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    expect(host.querySelector<HTMLInputElement>('[aria-label="Scale"]')?.value).toBe('1.5');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Scale value"]')?.value).toBe('1.50');

    await unmount(instance);
  });
});
