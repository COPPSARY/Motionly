import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/language/tokenizer';

describe('Tokenizer', () => {
  it('should tokenize simple canvas block', () => {
    const source = `canvas {
  size 1920x1080
  fps 60
}`;
    const tokens = tokenize(source);

    expect(tokens).toHaveLength(11); // canvas { newline size 1920x1080 newline fps 60 newline } eof
    expect(tokens[0]!.type).toBe('Word');
    expect(tokens[0]!.value).toBe('canvas');
    expect(tokens[1]!.type).toBe('LeftBrace');
  });

  it('should tokenize strings', () => {
    const source = 'text "Hello World"';
    const tokens = tokenize(source);

    expect(tokens[1]!.type).toBe('String');
    expect(tokens[1]!.value).toBe('Hello World');
  });

  it('should tokenize numbers', () => {
    const source = 'x 100 y 200.5';
    const tokens = tokenize(source);

    expect(tokens[1]!.value).toBe('100');
    expect(tokens[3]!.value).toBe('200.5');
  });

  it('should handle comments', () => {
    const source = `// This is a comment
canvas {}`;
    const tokens = tokenize(source);

    // Comments are skipped
    expect(tokens.find((token) => token.type !== 'Newline')!.value).toBe('canvas');
  });

  it('should throw on unterminated string', () => {
    const source = 'text "Hello';

    expect(() => tokenize(source)).toThrow('Unterminated string');
  });
});
