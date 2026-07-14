/**
 * Parser AST Types
 *
 * These types define the Abstract Syntax Tree structure
 * produced by the .motion language parser.
 */

/**
 * Token types from the lexer
 */
export type TokenType =
  | 'Word'
  | 'String'
  | 'Number'
  | 'Operator'
  | 'Newline'
  | 'EOF'
  | 'LeftBrace'
  | 'RightBrace'
  | 'LeftParen'
  | 'RightParen'
  | 'Comma'
  | 'Colon';

/**
 * Token from the lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Base AST node
 */
export interface BaseNode {
  type: string;
}

/**
 * Program root node
 */
export interface ProgramNode extends BaseNode {
  type: 'Program';
  body: ASTNode[];
}

/**
 * Canvas configuration node
 */
export interface CanvasNode extends BaseNode {
  type: 'Canvas';
  properties: Record<string, unknown>;
}

/**
 * Import statement node
 */
export interface ImportNode extends BaseNode {
  type: 'Import';
  path: string;
  name: string;
}

/**
 * Camera configuration node
 */
export interface CameraNode extends BaseNode {
  type: 'Camera';
  properties: Record<string, unknown>;
}

/**
 * Element declaration node
 */
export interface ElementNode extends BaseNode {
  type: 'Element';
  kind: string;
  name: string;
  properties: Record<string, unknown>;
}

/**
 * Animation definition node
 */
export interface AnimationNode extends BaseNode {
  type: 'Animation';
  target: string;
  from?: Record<string, unknown>;
  to?: Record<string, unknown>;
  keyframes?: KeyframeNode[];
  delay?: number | string;
  duration?: number | string;
  easing?: string;
  sequence?: string;
}

/**
 * Keyframe within an animation
 */
export interface KeyframeNode {
  offset: number;
  properties: Record<string, unknown>;
}

/**
 * Sequence definition node
 */
export interface SequenceNode extends BaseNode {
  type: 'Sequence';
  name: string;
  properties: Record<string, unknown>;
}

/**
 * Union of all AST node types
 */
export type ASTNode =
  ProgramNode | CanvasNode | ImportNode | CameraNode | ElementNode | AnimationNode | SequenceNode;

/**
 * Parse error with location information
 */
export interface ParseError extends Error {
  line?: number;
  column?: number;
  token?: Token;
}
