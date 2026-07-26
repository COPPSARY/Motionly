export type EditorShortcut =
  | 'clear-selection'
  | 'delete-selection'
  | 'duplicate-selection'
  | 'nudge-down'
  | 'nudge-left'
  | 'nudge-right'
  | 'nudge-up'
  | 'redo'
  | 'reset-playhead'
  | 'save'
  | 'split'
  | 'toggle-playback'
  | 'undo';

/**
 * Where keyboard focus currently sits, from the shortcut system's viewpoint:
 * - 'typing': a text-entry field — shortcuts must not fire while typing
 * - 'arrow-control': a control that consumes arrow keys (slider, select, radio)
 * - 'control': a clickable control that only consumes Space/Enter (button, link)
 * - 'global': anything else — every shortcut applies
 */
export type ShortcutContext = 'arrow-control' | 'control' | 'global' | 'typing';

type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>;

// Input types that behave like buttons rather than text entry.
const CLICKY_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'reset',
  'submit',
]);

const ARROW_CONTROL_SELECTOR =
  'select, audio, video, [role="slider"], [role="spinbutton"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [role="listbox"], [role="menu"]';

const CONTROL_SELECTOR =
  'button, a, summary, [role="button"], [role="checkbox"], [role="switch"], [role="link"]';

const EDITABLE_SELECTOR =
  '[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

export function shortcutContext(target: EventTarget | null | undefined): ShortcutContext {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return 'global';
  if (target.tagName === 'TEXTAREA') return 'typing';
  if (target.tagName === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    if (type === 'range' || type === 'radio') return 'arrow-control';
    return CLICKY_INPUT_TYPES.has(type) ? 'control' : 'typing';
  }
  if ((target as HTMLElement).isContentEditable || target.closest(EDITABLE_SELECTOR))
    return 'typing';
  if (target.closest(ARROW_CONTROL_SELECTOR)) return 'arrow-control';
  if (target.closest(CONTROL_SELECTOR)) return 'control';
  return 'global';
}

export function editorShortcut(
  event: ShortcutEvent,
  context: ShortcutContext = 'global'
): EditorShortcut | null {
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  const typing = context === 'typing';

  if (command) {
    if (!event.altKey && !event.shiftKey && key === 's') return 'save';
    if (typing) return null;
    if (!event.altKey && !event.shiftKey && key === 'd') return 'duplicate-selection';
    if (!event.altKey && key === 'z') return event.shiftKey ? 'redo' : 'undo';
    return null;
  }
  if (typing || event.altKey) return null;

  // Focused controls keep the keys they respond to natively: Space activates
  // buttons and arrows drive sliders/selects/radios.
  if (event.key === ' ') return context === 'global' ? 'toggle-playback' : null;
  if (event.key.startsWith('Arrow') && context === 'arrow-control') return null;

  if (event.key === 'Delete' || event.key === 'Backspace') return 'delete-selection';
  if (event.key === 'ArrowLeft') return 'nudge-left';
  if (event.key === 'ArrowRight') return 'nudge-right';
  if (event.key === 'ArrowUp') return 'nudge-up';
  if (event.key === 'ArrowDown') return 'nudge-down';
  if (event.key === 'Home') return 'reset-playhead';
  if (event.key === 'Escape') return 'clear-selection';
  if (!event.shiftKey && key === 's') return 'split';
  return null;
}
