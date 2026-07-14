/**
 * AST node factory functions for .motion language
 */

import type {
  ProgramNode,
  CanvasNode,
  ImportNode,
  CameraNode,
  ElementNode,
  AnimationNode,
  SequenceNode,
  ASTNode,
  KeyframeNode,
} from '../types/parser';

/**
 * Create program root node
 */
export function createProgram(body: ASTNode[]): ProgramNode {
  return { type: 'Program', body };
}

/**
 * Create canvas configuration node
 */
export function createCanvas(properties: Record<string, unknown>): CanvasNode {
  return { type: 'Canvas', properties };
}

/**
 * Create import statement node
 */
export function createImport(path: string, name: string): ImportNode {
  return { type: 'Import', path, name };
}

/**
 * Create camera configuration node
 */
export function createCamera(properties: Record<string, unknown>): CameraNode {
  return { type: 'Camera', properties };
}

/**
 * Create element declaration node
 */
export function createElement(
  kind: string,
  name: string,
  properties: Record<string, unknown>
): ElementNode {
  return { type: 'Element', kind, name, properties };
}

/**
 * Create animation definition node
 */
export function createAnimation(
  target: string,
  body: {
    from?: Record<string, unknown>;
    to?: Record<string, unknown>;
    keyframes?: KeyframeNode[];
    delay?: number | string;
    duration?: number | string;
    easing?: string;
    sequence?: string;
  }
): AnimationNode {
  return { type: 'Animation', target, ...body };
}

/**
 * Create sequence definition node
 */
export function createSequence(name: string, properties: Record<string, unknown>): SequenceNode {
  return { type: 'Sequence', name, properties };
}
