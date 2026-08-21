import { mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StoryboardEditorHarness from './fixtures/StoryboardEditorHarness.svelte';

function target(): HTMLDivElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

function click(element: Element | null | undefined): void {
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

const storyboardSource = `canvas { size 320x180 fps 30 duration 8s background #000000 }

scene intro {
  duration 4s
  label "Intro"
}

text title {
  scene intro
  identity brand
  value "Title"
  center
}

scene demo {
  duration 4s
  label "Demo"
}

text panel {
  scene demo
  identity brand
  value "Panel"
  center
}`;

const flatSource = `canvas { size 320x180 fps 30 duration 4s background #000000 }

text title {
  value "Title"
  center
}`;

function scenes(host: HTMLElement): string[] {
  return [...host.querySelectorAll('.storyboard-scene__label')].map((node) =>
    (node.textContent ?? '').trim()
  );
}

async function editor(code: string) {
  const host = target();
  const instance = mount(StoryboardEditorHarness, { target: host, props: { initial: code } });
  await tick();
  await tick();
  return { host, instance, source: () => instance.getSource() };
}

describe('storyboard strip in the editor', () => {
  beforeEach(() => {
    class ResizeObserverStub {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (_callback: FrameRequestCallback) => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvasContext());
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the storyboard instead of the object list at the top level', async () => {
    const { host, instance } = await editor(storyboardSource);
    expect(scenes(host)).toEqual(['Intro', 'Demo']);
    expect(host.querySelector('.storyboard-strip__meta')?.textContent).toContain('2 scenes');
    await unmount(instance);
  });

  it('labels the boundary with the transition it inferred', async () => {
    const { host, instance } = await editor(storyboardSource);
    const boundary = host.querySelector('.storyboard-boundary__button');
    expect(boundary?.getAttribute('data-kind')).toBe('sharedElement');
    expect(boundary?.getAttribute('aria-label')).toContain('1 shared');
    await unmount(instance);
  });

  it('adds a scene from the strip', async () => {
    const { host, instance } = await editor(storyboardSource);
    click(host.querySelector('.storyboard-strip__tools .storyboard-icon-button'));
    await tick();
    expect(scenes(host)).toHaveLength(3);
    await unmount(instance);
  });

  it('selects a scene, then returns to the whole storyboard', async () => {
    const { host, instance } = await editor(storyboardSource);
    const [, demo] = host.querySelectorAll('.storyboard-scene');
    click(demo);
    await tick();
    expect(
      host.querySelector('.storyboard-scene[aria-current="true"] .storyboard-scene__label')
        ?.textContent
    ).toBe('Demo');

    const back = host.querySelector('[aria-label="Back to all scenes"]');
    expect(back?.textContent).toContain('All scenes');
    click(back);
    await tick();
    expect(host.querySelector('.storyboard-scene[aria-current="true"]')).toBeNull();
    expect(host.querySelector('[aria-label="Back to all scenes"]')).toBeNull();
    await unmount(instance);
  });

  it('cycles a boundary transition and writes it to the source', async () => {
    const { host, instance, source } = await editor(storyboardSource);
    // Inferred `sharedElement` steps to the next explicit kind.
    click(host.querySelector('.storyboard-boundary__button'));
    await tick();
    expect(host.querySelector('.storyboard-boundary__button')?.getAttribute('data-kind')).toBe(
      'cameraMove'
    );
    expect(source()).toContain('transition cameraMove');
    await unmount(instance);
  });

  it('deletes a scene and its contents from the strip', async () => {
    const { host, instance, source } = await editor(storyboardSource);
    click(host.querySelectorAll('.storyboard-scene')[1]);
    await tick();
    click(host.querySelector('[aria-label="Delete the selected scene and its contents"]'));
    await tick();
    expect(scenes(host)).toEqual(['Intro']);
    expect(source()).not.toContain('panel');
    await unmount(instance);
  });

  it('offers to organize a flat project, and does it without losing anything', async () => {
    const { host, instance, source } = await editor(flatSource);
    expect(scenes(host)).toEqual([]);
    const cta = host.querySelector('.storyboard-strip__cta');
    expect(cta?.textContent).toContain('Organize into scenes');

    click(cta);
    await tick();
    expect(scenes(host)).toHaveLength(1);
    expect(source()).toContain('scene main');
    expect(source()).toContain('text title');
    await unmount(instance);
  });
});
