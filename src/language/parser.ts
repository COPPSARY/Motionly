/**
 * Parser for .motion language
 * Converts tokens into an Abstract Syntax Tree (AST)
 */

import {
  createAnimation,
  createCamera,
  createCanvas,
  createElement,
  createImport,
  createProgram,
  createSequence,
} from './ast';
import { tokenize } from './tokenizer';
import type {
  Token,
  ProgramNode,
  ASTNode,
  ParseError,
  KeyframeNode,
  AnimationNode,
} from '../types/parser';

const ELEMENT_KINDS = new Set(['text', 'overlay', 'effect']);
const PROPERTY_NAMES = new Set([
  'background',
  'backgroundEffect',
  'blur',
  'brightness',
  'center',
  'color',
  'cover',
  'fill',
  'effect',
  'font',
  'height',
  'gridSize',
  'gridThickness',
  'layer',
  'animation',
  'cameraAnimation',
  'textAnimation',
  'opacity',
  'pathProgress',
  'revealProgress',
  'offset',
  'intensity',
  'rotation',
  'scale',
  'skewX',
  'skewY',
  'shadow',
  'size',
  'stroke',
  'tracking',
  'value',
  'weight',
  'width',
  'x',
  'y',
  'zoom',
]);

/**
 * Parse .motion source code into AST
 */
export function parseMotion(source: string): ProgramNode {
  return new Parser(tokenize(source)).parseProgram();
}

/**
 * Parser class that maintains parsing state
 */
class Parser {
  private tokens: Token[];
  private index: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.index = 0;
  }

  /**
   * Parse the root program node
   */
  parseProgram(): ProgramNode {
    const body: ASTNode[] = [];

    while (!this.check('EOF')) {
      this.skipNewlines();
      if (this.check('EOF')) break;
      body.push(this.parseStatement());
    }

    return createProgram(body);
  }

  /**
   * Parse a top-level statement
   */
  parseStatement(): ASTNode {
    const current = this.peek();

    if (this.matchWord('canvas')) {
      return createCanvas(this.parseBlockProperties());
    }

    if (this.matchWord('camera')) {
      return createCamera(this.parseBlockProperties());
    }

    if (this.matchWord('sequence')) {
      const name = this.consume('Word', 'Expected sequence name').value;
      return createSequence(name, this.parseBlockProperties());
    }

    if (this.matchWord('import')) {
      const path = this.consume('String', 'Expected import path').value;
      this.consumeWord('as', 'Expected "as" in import');
      const name = this.consume('Word', 'Expected import alias').value;
      this.skipNewlines();
      return createImport(path, name);
    }

    if (this.matchWord('animate')) {
      const target = this.consume('Word', 'Expected animation target').value;
      return createAnimation(target, this.parseAnimationBody());
    }

    if (current.type === 'Word') {
      const first = this.advance().value;

      if (ELEMENT_KINDS.has(first)) {
        const name = this.consume('Word', `Expected ${first} name`).value;
        return createElement(first, name, this.parseBlockProperties());
      }

      return createElement('asset', first, this.parseBlockProperties());
    }

    throw this.error(current, `Unexpected token "${current.value}"`);
  }

  /**
   * Parse animation body with from, to, keyframes, etc.
   */
  parseAnimationBody(): Omit<AnimationNode, 'type' | 'target'> {
    this.consume('LeftBrace', 'Expected animation block');

    const body: Omit<AnimationNode, 'type' | 'target'> = {
      from: {},
      to: {},
      keyframes: [],
      delay: 0,
      duration: 1,
      easing: 'soft',
    };

    while (!this.check('RightBrace') && !this.check('EOF')) {
      this.skipNewlines();
      if (this.check('RightBrace')) break;

      if (this.matchWord('from')) {
        body.from = this.parseBlockProperties();
        continue;
      }

      if (this.matchWord('to')) {
        body.to = this.parseBlockProperties();
        continue;
      }

      if (this.matchWord('keyframes')) {
        body.keyframes = this.parseKeyframes();
        continue;
      }

      const key = this.consume('Word', 'Expected animation property').value;
      const values = this.collectLineValues();
      (body as Record<string, unknown>)[key] = values.join(' ');
    }

    this.consume('RightBrace', 'Expected end of animation block');
    this.skipNewlines();

    return body;
  }

  /**
   * Parse keyframes block
   */
  parseKeyframes(): KeyframeNode[] {
    this.consume('LeftBrace', 'Expected keyframes block');
    const frames: KeyframeNode[] = [];

    while (!this.check('RightBrace') && !this.check('EOF')) {
      this.skipNewlines();
      if (this.check('RightBrace')) break;

      const offsetToken = this.consume('Word', 'Expected keyframe offset');
      const offset = offsetToken.value.endsWith('%')
        ? Number.parseFloat(offsetToken.value) / 100
        : Number.parseFloat(offsetToken.value);

      frames.push({
        offset,
        properties: this.parseBlockProperties(),
      });
    }

    this.consume('RightBrace', 'Expected end of keyframes block');
    return frames.sort((a, b) => a.offset - b.offset);
  }

  /**
   * Parse block properties inside braces
   */
  parseBlockProperties(): Record<string, unknown> {
    this.consume('LeftBrace', 'Expected block');
    const properties: Record<string, unknown> = {};

    while (!this.check('RightBrace') && !this.check('EOF')) {
      this.skipNewlines();
      if (this.check('RightBrace')) break;

      const key = this.consume('Word', 'Expected property name').value;

      // Boolean properties
      if (key === 'center' || key === 'cover') {
        properties[key] = true;
        this.skipNewlines();
        continue;
      }

      // Check if we should stop at property names
      const compactValues = ![
        'animation',
        'textAnimation',
        'cameraAnimation',
        'backgroundEffect',
      ].includes(key);
      properties[key] = this.collectLineValues({ stopAtPropertyName: compactValues }).join(' ');
    }

    this.consume('RightBrace', 'Expected end of block');
    this.skipNewlines();

    return properties;
  }

  /**
   * Collect values on a single line
   */
  collectLineValues(options: { stopAtPropertyName?: boolean } = {}): string[] {
    const values: string[] = [];

    while (!this.check('Newline') && !this.check('RightBrace') && !this.check('EOF')) {
      if (
        options.stopAtPropertyName &&
        values.length > 0 &&
        this.check('Word') &&
        PROPERTY_NAMES.has(this.peek().value)
      ) {
        break;
      }
      values.push(this.advance().value);
    }

    this.skipNewlines();
    return values;
  }

  /**
   * Skip newline tokens
   */
  skipNewlines(): void {
    while (this.check('Newline')) {
      this.advance();
    }
  }

  /**
   * Try to match and consume a token type
   */
  match(type: string): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  /**
   * Try to match and consume a specific word
   */
  matchWord(value: string): boolean {
    if (!this.check('Word') || this.peek().value !== value) return false;
    this.advance();
    return true;
  }

  /**
   * Consume a token of a specific type or throw error
   */
  consume(type: string, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  /**
   * Consume a specific word or throw error
   */
  consumeWord(value: string, message: string): Token {
    if (this.check('Word') && this.peek().value === value) {
      return this.advance();
    }
    throw this.error(this.peek(), message);
  }

  /**
   * Check if current token is of a specific type
   */
  check(type: string): boolean {
    return this.peek().type === type;
  }

  /**
   * Advance to next token and return current
   */
  advance(): Token {
    const token = this.tokens[this.index];
    if (token) {
      this.index++;
      return token;
    }
    // Return EOF token if we're at the end
    return this.tokens[this.tokens.length - 1]!;
  }

  /**
   * Peek at current token without advancing
   */
  peek(): Token {
    const token = this.tokens[this.index];
    if (!token) {
      // Return EOF token if we're at the end
      return this.tokens[this.tokens.length - 1]!;
    }
    return token;
  }

  /**
   * Create parse error with location info
   */
  error(token: Token, message: string): ParseError {
    const error = new Error(`${message} at ${token.line}:${token.column}`) as ParseError;
    error.line = token.line;
    error.column = token.column;
    error.token = token;
    return error;
  }
}
