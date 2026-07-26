import { describe, expect, it } from 'vitest';
import {
  editorShortcut,
  shortcutContext,
  type ShortcutContext,
} from '../../src/ui/editor-shortcuts';

const key = (
  value: string,
  overrides: Partial<Parameters<typeof editorShortcut>[0]> = {},
  context: ShortcutContext = 'global'
) =>
  editorShortcut(
    {
      altKey: false,
      ctrlKey: false,
      key: value,
      metaKey: false,
      shiftKey: false,
      ...overrides,
    },
    context
  );

describe('editor shortcuts', () => {
  it('maps the common editor actions', () => {
    expect(key(' ')).toBe('toggle-playback');
    expect(key('Delete')).toBe('delete-selection');
    expect(key('ArrowLeft')).toBe('nudge-left');
    expect(key('s')).toBe('split');
    expect(key('Home')).toBe('reset-playhead');
    expect(key('Escape')).toBe('clear-selection');
    expect(key('s', { ctrlKey: true })).toBe('save');
    expect(key('d', { ctrlKey: true })).toBe('duplicate-selection');
    expect(key('d', { metaKey: true })).toBe('duplicate-selection');
    expect(key('z', { metaKey: true })).toBe('undo');
    expect(key('z', { metaKey: true, shiftKey: true })).toBe('redo');
  });

  it('leaves typing alone except for save', () => {
    expect(key(' ', {}, 'typing')).toBeNull();
    expect(key('Backspace', {}, 'typing')).toBeNull();
    expect(key('Escape', {}, 'typing')).toBeNull();
    expect(key('z', { ctrlKey: true }, 'typing')).toBeNull();
    expect(key('d', { ctrlKey: true }, 'typing')).toBeNull();
    expect(key('s', { ctrlKey: true }, 'typing')).toBe('save');
  });

  it('keeps shortcuts working while a button is focused, except Space', () => {
    expect(key('z', { ctrlKey: true }, 'control')).toBe('undo');
    expect(key('z', { ctrlKey: true, shiftKey: true }, 'control')).toBe('redo');
    expect(key('d', { ctrlKey: true }, 'control')).toBe('duplicate-selection');
    expect(key('Delete', {}, 'control')).toBe('delete-selection');
    expect(key('ArrowLeft', {}, 'control')).toBe('nudge-left');
    expect(key('s', {}, 'control')).toBe('split');
    expect(key('Escape', {}, 'control')).toBe('clear-selection');
    expect(key(' ', {}, 'control')).toBeNull();
  });

  it('leaves arrows and Space to sliders and selects', () => {
    expect(key('ArrowLeft', {}, 'arrow-control')).toBeNull();
    expect(key('ArrowUp', {}, 'arrow-control')).toBeNull();
    expect(key(' ', {}, 'arrow-control')).toBeNull();
    expect(key('z', { ctrlKey: true }, 'arrow-control')).toBe('undo');
    expect(key('Delete', {}, 'arrow-control')).toBe('delete-selection');
  });
});

describe('shortcut context classification', () => {
  const element = (html: string): Element => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.querySelector('[data-target]') ?? host.firstElementChild!;
  };

  it('treats text entry as typing', () => {
    expect(shortcutContext(element('<textarea></textarea>'))).toBe('typing');
    expect(shortcutContext(element('<input type="text">'))).toBe('typing');
    expect(shortcutContext(element('<input type="number">'))).toBe('typing');
    expect(shortcutContext(element('<input type="search">'))).toBe('typing');
    expect(shortcutContext(element('<div contenteditable="true"></div>'))).toBe('typing');
    expect(
      shortcutContext(element('<div contenteditable="true"><span data-target>x</span></div>'))
    ).toBe('typing');
  });

  it('treats buttons and links as controls, not typing', () => {
    expect(shortcutContext(element('<button></button>'))).toBe('control');
    expect(shortcutContext(element('<button><span data-target></span></button>'))).toBe('control');
    expect(shortcutContext(element('<a href="#"></a>'))).toBe('control');
    expect(shortcutContext(element('<div role="button"></div>'))).toBe('control');
    expect(shortcutContext(element('<input type="checkbox">'))).toBe('control');
  });

  it('treats arrow-consuming controls separately', () => {
    expect(shortcutContext(element('<select></select>'))).toBe('arrow-control');
    expect(shortcutContext(element('<input type="range">'))).toBe('arrow-control');
    expect(shortcutContext(element('<input type="radio">'))).toBe('arrow-control');
    expect(shortcutContext(element('<div role="slider"></div>'))).toBe('arrow-control');
  });

  it('treats everything else as global', () => {
    expect(shortcutContext(null)).toBe('global');
    expect(shortcutContext(document.body)).toBe('global');
    expect(shortcutContext(element('<canvas></canvas>'))).toBe('global');
    expect(shortcutContext(element('<div tabindex="0"></div>'))).toBe('global');
  });
});
