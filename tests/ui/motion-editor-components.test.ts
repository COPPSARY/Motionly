import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
        showConfirmDialog: true,
        onUndoDelete,
        onCancelPreset,
        onConfirmPreset,
      },
    });

    click(
      Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Undo') ??
        null
    );
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Cancel'
      ) ?? null
    );
    click(
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === 'Load Preset'
      ) ?? null
    );
    expect(onUndoDelete).toHaveBeenCalledOnce();
    expect(onCancelPreset).toHaveBeenCalledOnce();
    expect(onConfirmPreset).toHaveBeenCalledOnce();

    await unmount(instance);
  });
});

describe('MotionEditor integration', () => {
  it('mounts every major region and keeps nested panel styles isolated', async () => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());

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
});
