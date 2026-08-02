/**
 * Storyboard editing model.
 *
 * The editor's top-level timeline is a storyboard, not an object timeline. This
 * module is the whole operation set behind it — create, duplicate, rename, delete,
 * reorder, retime, retransition — expressed as pure AST → AST functions so the
 * strip and the source stay in lockstep and every operation is undoable through
 * the existing history stack.
 *
 * Two rules make the model safe:
 *
 * 1. **Nothing is edited in place.** Every operation returns a new program, so the
 *    editor can diff, preview, and undo.
 * 2. **Absolute time is never authored.** Scenes are ordered and sized; the
 *    storyboard planner derives `start`. Reordering two scenes is therefore a list
 *    move, not a retiming pass over hundreds of animations — which is the whole
 *    reason scenes exist.
 */

import type { ASTNode, ElementNode, ProgramNode } from '../types/parser';
import {
  MIN_SCENE_DURATION,
  isSceneTransitionKind,
  type SceneTransitionKind,
} from '../motion-system/scenes';

/** Kinds that are never storyboard members. */
const NON_MEMBER_KINDS = new Set(['scene', 'theme', 'beat', 'transition']);

/** One entry in the storyboard strip, derived straight from the AST. */
export interface StoryboardEntry {
  name: string;
  index: number;
  label: string;
  duration: number;
  background?: string;
  transition?: SceneTransitionKind;
  /** Ids of the objects that live in this scene, in authored order. */
  members: string[];
}

const DEFAULT_SCENE_DURATION = 4;

/** Read the storyboard strip out of a program. */
export function readStoryboard(program: ProgramNode): StoryboardEntry[] {
  const members = membersByScene(program);
  return sceneNodes(program).map((node, index) => {
    const transition = String(node.properties['transition'] ?? '');
    return {
      name: node.name,
      index,
      label: String(node.properties['label'] ?? node.name),
      duration: seconds(node.properties['duration'], DEFAULT_SCENE_DURATION),
      ...(node.properties['background'] !== undefined
        ? { background: String(node.properties['background']) }
        : {}),
      ...(isSceneTransitionKind(transition) ? { transition } : {}),
      members: members.get(node.name) ?? [],
    };
  });
}

export interface CreateSceneOptions {
  /** Insert after this scene. Omit to append. */
  after?: string;
  name?: string;
  label?: string;
  duration?: number;
  background?: string;
}

/**
 * Add an empty scene.
 *
 * An empty scene is a legitimate storyboard state — the user blocks out the
 * structure first and fills it in after, which is exactly the workflow scenes are
 * meant to enable.
 */
export function createScene(program: ProgramNode, options: CreateSceneOptions = {}): ProgramNode {
  const taken = new Set(allNames(program));
  const name = uniqueName(options.name ?? 'scene', taken);
  const node = sceneBlock(name, {
    duration: `${round(Math.max(MIN_SCENE_DURATION, options.duration ?? DEFAULT_SCENE_DURATION))}s`,
    label: options.label ?? titleCase(name),
    ...(options.background ? { background: options.background } : {}),
  });
  return { ...program, body: insertScene(program.body, node, options.after) };
}

/**
 * Copy a scene and everything inside it.
 *
 * Members are cloned with fresh ids, and their animations come along, so the copy
 * performs identically. A cloned member keeps its `identity` only when the
 * original declared one — a duplicate of a shared component is still that
 * component, which is what makes duplicating a scene useful for A/B variants.
 */
export function duplicateScene(program: ProgramNode, name: string): ProgramNode {
  const source = sceneNodes(program).find((node) => node.name === name);
  if (!source) throw new Error(`Cannot duplicate missing scene "${name}".`);

  const taken = new Set(allNames(program));
  const sceneName = uniqueName(`${name}Copy`, taken);
  taken.add(sceneName);

  const rename = new Map<string, string>();
  for (const member of membersOf(program, name)) {
    const next = uniqueName(`${member.name}Copy`, taken);
    taken.add(next);
    rename.set(member.name, next);
  }

  const clones: ASTNode[] = [
    sceneBlock(sceneName, {
      ...source.properties,
      label: `${source.properties['label'] ?? titleCase(name)} copy`,
    }),
  ];
  for (const member of membersOf(program, name)) {
    clones.push({
      ...member,
      name: rename.get(member.name)!,
      properties: { ...member.properties, scene: sceneName },
    });
  }
  for (const node of program.body) {
    if (node.type !== 'Animation') continue;
    const target = rename.get(node.target);
    if (!target) continue;
    clones.push({ ...node, target });
  }

  const body = [...program.body];
  const anchor = lastIndexOfScene(body, name);
  body.splice(anchor + 1, 0, ...clones);
  return { ...program, body };
}

/** Rename a scene and repoint every member and reference at it. */
export function renameScene(program: ProgramNode, name: string, next: string): ProgramNode {
  if (name === next) return program;
  const trimmed = next.trim();
  if (!trimmed) throw new Error('A scene needs a name.');
  if (allNames(program).includes(trimmed)) throw new Error(`"${trimmed}" is already taken.`);
  if (!sceneNodes(program).some((node) => node.name === name)) {
    throw new Error(`Cannot rename missing scene "${name}".`);
  }

  const body = program.body.map((node): ASTNode => {
    if (node.type !== 'Element') return node;
    if (node.kind === 'scene' && node.name === name) return { ...node, name: trimmed };
    const properties = { ...node.properties };
    let changed = false;
    if (String(properties['scene'] ?? '') === name) {
      properties['scene'] = trimmed;
      changed = true;
    }
    if (String(properties['parent'] ?? '') === name) {
      properties['parent'] = trimmed;
      changed = true;
    }
    return changed ? { ...node, properties } : node;
  });
  return { ...program, body };
}

/** Set the label shown in the storyboard strip. */
export function setSceneLabel(program: ProgramNode, name: string, label: string): ProgramNode {
  return patchScene(program, name, { label: label.trim() || titleCase(name) });
}

/** Change a scene's length. Downstream scenes shift automatically — no retiming pass. */
export function setSceneDuration(
  program: ProgramNode,
  name: string,
  duration: number
): ProgramNode {
  return patchScene(program, name, {
    duration: `${round(Math.max(MIN_SCENE_DURATION, duration))}s`,
  });
}

export function setSceneBackground(
  program: ProgramNode,
  name: string,
  background: string
): ProgramNode {
  return patchScene(program, name, { background });
}

/**
 * Set the transition into a scene. Passing `undefined` returns the boundary to
 * inference, which is usually the better answer: the storyboard already knows
 * whether something is shared.
 */
export function setSceneTransition(
  program: ProgramNode,
  name: string,
  kind: SceneTransitionKind | undefined
): ProgramNode {
  if (kind === undefined) return patchScene(program, name, { transition: undefined });
  if (!isSceneTransitionKind(kind)) {
    throw new Error(`Unsupported scene transition "${kind}". Scene boundaries never fade.`);
  }
  return patchScene(program, name, { transition: kind });
}

/**
 * Move a scene to a new position in the storyboard.
 *
 * The scene block and every member move together, so the source stays readable
 * and the diff shows a moved block rather than a hundred changed delays.
 */
export function reorderScene(program: ProgramNode, name: string, toIndex: number): ProgramNode {
  const order = sceneNodes(program).map((node) => node.name);
  const from = order.indexOf(name);
  if (from === -1) throw new Error(`Cannot reorder missing scene "${name}".`);
  const target = Math.max(0, Math.min(order.length - 1, toIndex));
  if (target === from) return program;

  const groups = new Map<string, ASTNode[]>(order.map((scene) => [scene, []]));
  const rest: ASTNode[] = [];
  for (const node of program.body) {
    const owner = ownerScene(node, groups);
    if (owner) groups.get(owner)!.push(node);
    else rest.push(node);
  }

  const nextOrder = [...order];
  nextOrder.splice(from, 1);
  nextOrder.splice(target, 0, name);

  const head: ASTNode[] = [];
  const tail: ASTNode[] = [];
  let seenScene = false;
  for (const node of rest) {
    if (!seenScene && isStructural(node)) head.push(node);
    else {
      seenScene = true;
      tail.push(node);
    }
  }

  return {
    ...program,
    body: [...head, ...nextOrder.flatMap((scene) => groups.get(scene)!), ...tail],
  };
}

/**
 * Delete a scene.
 *
 * By default its members are deleted with it — a scene is the unit of
 * organization, so removing it removes what it organized. Pass `keepMembers` to
 * move them into the previous scene instead.
 */
export function deleteScene(
  program: ProgramNode,
  name: string,
  options: { keepMembers?: boolean } = {}
): ProgramNode {
  const order = sceneNodes(program).map((node) => node.name);
  const index = order.indexOf(name);
  if (index === -1) throw new Error(`Cannot delete missing scene "${name}".`);
  const fallback = order[index - 1] ?? order[index + 1];
  if (options.keepMembers && !fallback) {
    throw new Error('Cannot keep members: the storyboard has no other scene to hold them.');
  }

  const doomed = new Set(
    options.keepMembers ? [] : membersOf(program, name).map((node) => node.name)
  );

  const body: ASTNode[] = [];
  for (const node of program.body) {
    if (node.type === 'Element' && node.kind === 'scene' && node.name === name) continue;
    if (node.type === 'Element' && doomed.has(node.name)) continue;
    if (node.type === 'Animation' && doomed.has(node.target)) continue;
    if (
      options.keepMembers &&
      node.type === 'Element' &&
      String(node.properties['scene'] ?? '') === name
    ) {
      body.push({ ...node, properties: { ...node.properties, scene: fallback! } });
      continue;
    }
    body.push(node);
  }
  return { ...program, body };
}

/** Move one object into another scene. */
export function moveMember(program: ProgramNode, member: string, scene: string): ProgramNode {
  if (!sceneNodes(program).some((node) => node.name === scene)) {
    throw new Error(`Cannot move "${member}" into missing scene "${scene}".`);
  }
  let found = false;
  const body = program.body.map((node): ASTNode => {
    if (node.type !== 'Element' || node.name !== member) return node;
    found = true;
    const properties: Record<string, unknown> = { ...node.properties, scene };
    // A member that lands in a scene loses whatever it was parented to; the scene
    // becomes its owner, and the storyboard is the only thing that reparents it.
    delete properties['parent'];
    return { ...node, properties };
  });
  if (!found) throw new Error(`Cannot move missing object "${member}".`);
  return { ...program, body };
}

/**
 * Mark an object as a persistent component.
 *
 * Two objects in different scenes sharing an identity are the same component, so
 * the boundary between them becomes a handoff instead of an exit plus an entrance.
 * This single call is how a user turns a jump cut into continuity.
 */
export function setMemberIdentity(
  program: ProgramNode,
  member: string,
  identity: string | undefined
): ProgramNode {
  let found = false;
  const body = program.body.map((node): ASTNode => {
    if (node.type !== 'Element' || node.name !== member) return node;
    found = true;
    const properties = { ...node.properties };
    if (identity && identity.trim()) properties['identity'] = identity.trim();
    else delete properties['identity'];
    return { ...node, properties };
  });
  if (!found) throw new Error(`Cannot tag missing object "${member}".`);
  return { ...program, body };
}

/** Scene names sharing each identity — the storyboard's continuity map. */
export function identityMap(program: ProgramNode): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of program.body) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    const identity = String(node.properties['identity'] ?? '');
    if (!identity) continue;
    map.set(identity, [...(map.get(identity) ?? []), node.name]);
  }
  return map;
}

function patchScene(
  program: ProgramNode,
  name: string,
  patch: Record<string, unknown>
): ProgramNode {
  let found = false;
  const body = program.body.map((node): ASTNode => {
    if (node.type !== 'Element' || node.kind !== 'scene' || node.name !== name) return node;
    found = true;
    const properties = { ...node.properties };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete properties[key];
      else properties[key] = value;
    }
    return { ...node, properties };
  });
  if (!found) throw new Error(`Cannot edit missing scene "${name}".`);
  return { ...program, body };
}

function insertScene(body: readonly ASTNode[], node: ElementNode, after?: string): ASTNode[] {
  const next = [...body];
  if (after) {
    const anchor = lastIndexOfScene(next, after);
    if (anchor >= 0) {
      next.splice(anchor + 1, 0, node);
      return next;
    }
  }
  return [...next, node];
}

/**
 * The end of a scene's block in the source: its own node plus its members and
 * their animations, so an insert lands after the whole scene rather than inside it.
 */
function lastIndexOfScene(body: readonly ASTNode[], name: string): number {
  const owned = new Set<string>();
  let last = -1;
  for (const [index, node] of body.entries()) {
    if (node.type === 'Element' && node.kind === 'scene' && node.name === name) {
      last = index;
      continue;
    }
    if (node.type === 'Element' && String(node.properties['scene'] ?? '') === name) {
      owned.add(node.name);
      last = index;
      continue;
    }
    if (node.type === 'Animation' && owned.has(node.target)) last = index;
  }
  return last;
}

function ownerScene(node: ASTNode, groups: ReadonlyMap<string, ASTNode[]>): string | null {
  if (node.type === 'Element' && node.kind === 'scene' && groups.has(node.name)) return node.name;
  if (node.type === 'Element') {
    const scene = String(node.properties['scene'] ?? '');
    if (groups.has(scene)) return scene;
  }
  if (node.type === 'Animation') {
    for (const [scene, members] of groups) {
      if (members.some((member) => member.type === 'Element' && member.name === node.target)) {
        return scene;
      }
    }
  }
  return null;
}

function isStructural(node: ASTNode): boolean {
  return (
    node.type === 'Canvas' ||
    node.type === 'Camera' ||
    node.type === 'Import' ||
    node.type === 'Track' ||
    node.type === 'Sequence' ||
    (node.type === 'Element' && node.kind === 'theme')
  );
}

function sceneNodes(program: ProgramNode): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode =>
      node.type === 'Element' && node.kind === 'scene' && !node.properties['parent']
  );
}

function membersOf(program: ProgramNode, scene: string): ElementNode[] {
  return program.body.filter(
    (node): node is ElementNode =>
      node.type === 'Element' &&
      !NON_MEMBER_KINDS.has(node.kind) &&
      String(node.properties['scene'] ?? '') === scene
  );
}

function membersByScene(program: ProgramNode): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of program.body) {
    if (node.type !== 'Element' || NON_MEMBER_KINDS.has(node.kind)) continue;
    const scene = String(node.properties['scene'] ?? '');
    if (!scene) continue;
    map.set(scene, [...(map.get(scene) ?? []), node.name]);
  }
  return map;
}

function sceneBlock(name: string, properties: Record<string, unknown>): ElementNode {
  return { type: 'Element', kind: 'scene', name, properties };
}

function allNames(program: ProgramNode): string[] {
  return program.body.flatMap((node) =>
    node.type === 'Element' || node.type === 'Import' ? [node.name] : []
  );
}

function uniqueName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

function titleCase(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function seconds(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
