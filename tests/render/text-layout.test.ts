import { describe, expect, it } from 'vitest';
import { layoutTextLines } from '../../src/render/canvas-renderer';

describe('professional text layout', () => {
  it('wraps using measured glyph widths instead of character estimates', () => {
    const context = {
      measureText(value: string) {
        return { width: value === 'WWW' ? 60 : value.length * 10 } as TextMetrics;
      },
    };
    expect(layoutTextLines(context, 'one two three', 75, 'word')).toEqual(['one two', 'three']);
    expect(layoutTextLines(context, 'abcd', 25, 'char')).toEqual(['ab', 'cd']);
    expect(layoutTextLines(context, 'a\nb', 25, 'none')).toEqual(['a', 'b']);
  });
});
