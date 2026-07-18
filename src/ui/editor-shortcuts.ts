export type EditorShortcut =
  | 'clear-selection'
  | 'delete-selection'
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

type ShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>;

export function editorShortcut(event: ShortcutEvent, interactive = false): EditorShortcut | null {
  const command = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (command) {
    if (!event.altKey && !event.shiftKey && key === 's') return 'save';
    if (!event.altKey && !interactive && key === 'z') return event.shiftKey ? 'redo' : 'undo';
    return null;
  }
  if (interactive || event.altKey) return null;

  if (event.key === ' ') return 'toggle-playback';
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
