/**
 * Tokenizer for .motion language
 * Converts source code into a stream of tokens
 */

import type { Token, TokenType } from '../types/parser';

/**
 * Tokenize .motion source code
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < source.length) {
    const char = source[index];

    // Newlines
    if (char === '\n') {
      tokens.push(createToken('Newline', '\n', line, column));
      index += 1;
      line += 1;
      column = 1;
      continue;
    }

    // Whitespace
    if (/\s/.test(char!)) {
      index += 1;
      column += 1;
      continue;
    }

    // Comments
    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
        column += 1;
      }
      continue;
    }

    // Braces
    if (char === '{' || char === '}') {
      const type: TokenType = char === '{' ? 'LeftBrace' : 'RightBrace';
      tokens.push(createToken(type, char, line, column));
      index += 1;
      column += 1;
      continue;
    }

    // Strings
    if (char === '"') {
      const startColumn = column;
      let value = '';
      index += 1;
      column += 1;

      while (index < source.length && source[index] !== '"') {
        if (source[index] === '\\' && index + 1 < source.length) {
          const escaped = source[index + 1];
          value += escaped === 'n' ? '\n' : escaped;
          index += 2;
          column += 2;
          continue;
        }
        value += source[index];
        index += 1;
        column += 1;
      }

      if (source[index] !== '"') {
        throw new Error(`Unterminated string at ${line}:${startColumn}`);
      }

      index += 1;
      column += 1;
      tokens.push(createToken('String', value, line, startColumn));
      continue;
    }

    // Words and numbers
    const startColumn = column;
    let value = '';

    while (
      index < source.length &&
      !/\s/.test(source[index]!) &&
      source[index] !== '{' &&
      source[index] !== '}'
    ) {
      value += source[index];
      index += 1;
      column += 1;
    }

    tokens.push(createToken('Word', value, line, startColumn));
  }

  tokens.push(createToken('EOF', '', line, column));
  return tokens;
}

/**
 * Create a token
 */
function createToken(type: TokenType, value: string, line: number, column: number): Token {
  return { type, value, line, column };
}
