/** Update one single-token option without disturbing the rest of a preset call. */
export function upsertPresetCallOption(
  value: unknown,
  option: string,
  nextValue: string | number
): string {
  const source = String(value ?? '').trim();
  const match = /^([A-Za-z][\w-]*)(?:\((.*)\))?$/.exec(source);
  if (!match) return source;

  const name = match[1];
  if (!name) return source;
  const body = (match[2] ?? '').trim();
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[\\s,])(${escaped})(\\s+)([^\\s,)]+)`);
  const replacement = `$1$2$3${String(nextValue)}`;
  const updated = pattern.test(body)
    ? body.replace(pattern, replacement)
    : `${body}${body ? ' ' : ''}${option} ${String(nextValue)}`;
  return `${name}(${updated})`;
}
