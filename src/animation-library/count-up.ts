const SEPARATOR_ALIASES: Record<string, string> = {
  comma: ',',
  none: '',
  space: ' ',
};

export function countDecimalPlaces(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;

  const text = String(value).toLowerCase();
  if (text.includes('e-')) {
    const [coefficient, exponent] = text.split('e-');
    const coefficientDecimals = coefficient?.split('.')[1]?.length ?? 0;
    return coefficientDecimals + Number(exponent ?? 0);
  }

  return text.split('.')[1]?.length ?? 0;
}

export function resolveCountSeparator(value: unknown): string {
  const separator = String(value ?? '').trim();
  return SEPARATOR_ALIASES[separator.toLowerCase()] ?? separator;
}

export function formatCountValue(value: unknown, separator = '', decimals = 0): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '');

  const fractionDigits = Math.max(0, Math.min(20, Math.floor(decimals)));
  const formatted = new Intl.NumberFormat('en-US', {
    useGrouping: Boolean(separator),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numeric);

  return separator ? formatted.replace(/,/g, separator) : formatted;
}
