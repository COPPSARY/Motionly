import { describe, expect, it } from 'vitest';
import { editorShortcut } from '../../src/ui/editor-shortcuts';

const key = (
  value: string,
  overrides: Partial<Parameters<typeof editorShortcut>[0]> = {},
  interactive = false
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
    interactive
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

  it('leaves typing and focused controls alone except for save', () => {
    expect(key(' ', {}, true)).toBeNull();
    expect(key('Backspace', {}, true)).toBeNull();
    expect(key('z', { ctrlKey: true }, true)).toBeNull();
    expect(key('s', { ctrlKey: true }, true)).toBe('save');
    expect(key('d', { ctrlKey: true }, true)).toBeNull();
  });
});
