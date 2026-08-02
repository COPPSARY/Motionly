import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  createScene,
  deleteScene,
  duplicateScene,
  identityMap,
  moveMember,
  readStoryboard,
  renameScene,
  reorderScene,
  setMemberIdentity,
  setSceneBackground,
  setSceneDuration,
  setSceneLabel,
  setSceneTransition,
} from '../../src/ui/storyboard';
import type { ElementNode, ProgramNode } from '../../src/types/parser';

const source = `
canvas { size 1920x1080 duration 12s }

scene intro {
  duration 4s
  label "Intro"
  background #05060a
}

text title {
  scene intro
  identity brand
  value "Motionly"
  center
  size 72
  color #ffffff
}

animate title {
  from { opacity 0 y 40 }
  to { opacity 1 y 0 }
  delay 0.2s
  duration 0.6s
}

scene demo {
  duration 8s
  label "Demo"
}

text panel {
  scene demo
  value "Dashboard"
  size 48
  color #ffffff
}
`;

function program(): ProgramNode {
  return parseMotion(source);
}

function names(next: ProgramNode): string[] {
  return readStoryboard(next).map((entry) => entry.name);
}

function node(next: ProgramNode, name: string): ElementNode | undefined {
  return next.body.find(
    (entry): entry is ElementNode => entry.type === 'Element' && entry.name === name
  );
}

describe('reading the storyboard', () => {
  it('derives the strip straight from the source', () => {
    const strip = readStoryboard(program());
    expect(strip).toHaveLength(2);
    expect(strip[0]).toMatchObject({
      name: 'intro',
      index: 0,
      label: 'Intro',
      duration: 4,
      background: '#05060a',
      members: ['title'],
    });
    expect(strip[1]!.members).toEqual(['panel']);
  });

  it('stays a two-entry strip no matter how many objects a scene holds', () => {
    let next = program();
    for (let index = 0; index < 40; index += 1) {
      next = moveMember(createScene(next, { name: `x${index}` }), 'panel', `x${index}`);
    }
    expect(readStoryboard(next)).toHaveLength(42);
    expect(readStoryboard(program())).toHaveLength(2);
  });
});

describe('scene operations', () => {
  it('creates an empty scene after a chosen one', () => {
    const next = createScene(program(), { after: 'intro', name: 'prompt', label: 'Prompt' });
    expect(names(next)).toEqual(['intro', 'prompt', 'demo']);
    expect(node(next, 'prompt')!.properties['label']).toBe('Prompt');
  });

  it('appends when no anchor is given and never collides with an existing name', () => {
    const next = createScene(createScene(program(), { name: 'demo' }), { name: 'demo' });
    expect(names(next)).toEqual(['intro', 'demo', 'demo2', 'demo3']);
  });

  it('duplicates a scene with its members and their animations', () => {
    const next = duplicateScene(program(), 'intro');
    expect(names(next)).toEqual(['intro', 'introCopy', 'demo']);
    const clone = node(next, 'titleCopy')!;
    expect(clone.properties['scene']).toBe('introCopy');
    expect(clone.properties['identity']).toBe('brand');
    expect(
      next.body.filter((entry) => entry.type === 'Animation' && entry.target === 'titleCopy')
    ).toHaveLength(1);
  });

  it('renames a scene and repoints its members', () => {
    const next = renameScene(program(), 'demo', 'editing');
    expect(names(next)).toEqual(['intro', 'editing']);
    expect(node(next, 'panel')!.properties['scene']).toBe('editing');
  });

  it('refuses a rename that collides or empties the name', () => {
    expect(() => renameScene(program(), 'demo', 'intro')).toThrow(/already taken/);
    expect(() => renameScene(program(), 'demo', '  ')).toThrow(/needs a name/);
    expect(() => renameScene(program(), 'ghost', 'x')).toThrow(/missing scene/);
  });

  it('retimes a scene without touching any animation', () => {
    const before = program().body.filter((entry) => entry.type === 'Animation');
    const next = setSceneDuration(program(), 'intro', 6);
    expect(node(next, 'intro')!.properties['duration']).toBe('6s');
    expect(next.body.filter((entry) => entry.type === 'Animation')).toEqual(before);
  });

  it('clamps a scene to the minimum length', () => {
    expect(node(setSceneDuration(program(), 'intro', 0), 'intro')!.properties['duration']).toBe(
      '0.5s'
    );
  });

  it('edits the label and background', () => {
    const next = setSceneBackground(setSceneLabel(program(), 'demo', 'Editing'), 'demo', '#101014');
    expect(node(next, 'demo')!.properties['label']).toBe('Editing');
    expect(node(next, 'demo')!.properties['background']).toBe('#101014');
  });

  it('sets and clears the boundary transition, and rejects a fade', () => {
    const set = setSceneTransition(program(), 'demo', 'cut');
    expect(readStoryboard(set)[1]!.transition).toBe('cut');
    const cleared = setSceneTransition(set, 'demo', undefined);
    expect(readStoryboard(cleared)[1]!.transition).toBeUndefined();
    expect(() => setSceneTransition(program(), 'demo', 'crossfade' as never)).toThrow(/never fade/);
  });

  it('reorders a scene together with everything inside it', () => {
    const next = reorderScene(program(), 'demo', 0);
    expect(names(next)).toEqual(['demo', 'intro']);
    const order = next.body
      .filter((entry) => entry.type === 'Element' || entry.type === 'Animation')
      .map((entry) => (entry.type === 'Animation' ? `@${entry.target}` : entry.name));
    expect(order).toEqual(['demo', 'panel', 'intro', 'title', '@title']);
  });

  it('keeps canvas and imports at the top when reordering', () => {
    const next = reorderScene(program(), 'demo', 0);
    expect(next.body[0]!.type).toBe('Canvas');
  });

  it('deletes a scene and everything it organized', () => {
    const next = deleteScene(program(), 'intro');
    expect(names(next)).toEqual(['demo']);
    expect(node(next, 'title')).toBeUndefined();
    expect(next.body.some((entry) => entry.type === 'Animation' && entry.target === 'title')).toBe(
      false
    );
  });

  it('can delete a scene while keeping its members in a neighbour', () => {
    const next = deleteScene(program(), 'demo', { keepMembers: true });
    expect(names(next)).toEqual(['intro']);
    expect(node(next, 'panel')!.properties['scene']).toBe('intro');
  });

  it('refuses to keep members when there is nowhere to put them', () => {
    const single = createScene({ ...parseMotion('canvas { duration 4s }') }, { name: 'only' });
    expect(() => deleteScene(single, 'only', { keepMembers: true })).toThrow(/no other scene/);
  });
});

describe('members and shared identity', () => {
  it('moves an object into another scene', () => {
    const next = moveMember(program(), 'panel', 'intro');
    expect(readStoryboard(next)[0]!.members).toEqual(['title', 'panel']);
    expect(readStoryboard(next)[1]!.members).toEqual([]);
  });

  it('refuses to move into a scene that does not exist', () => {
    expect(() => moveMember(program(), 'panel', 'ghost')).toThrow(/missing scene/);
    expect(() => moveMember(program(), 'ghost', 'intro')).toThrow(/missing object/);
  });

  it('turns a jump cut into continuity by sharing an identity', () => {
    const before = buildSceneGraph(program());
    expect(before.storyboard![1]!.transition!.participation.shared).toEqual([]);
    expect(before.storyboard![1]!.transition!.kind).toBe('continuous');

    const next = setMemberIdentity(program(), 'panel', 'brand');
    const after = buildSceneGraph(next);
    expect(after.storyboard![1]!.transition!.kind).toBe('sharedElement');
    expect(after.storyboard![1]!.transition!.participation.shared).toEqual([
      { identity: 'brand', from: 'title', to: 'panel' },
    ]);
  });

  it('clears an identity again', () => {
    const next = setMemberIdentity(program(), 'title', undefined);
    expect(node(next, 'title')!.properties['identity']).toBeUndefined();
    expect(identityMap(next).size).toBe(0);
  });

  it('reports the continuity map', () => {
    const next = setMemberIdentity(program(), 'panel', 'brand');
    expect(identityMap(next).get('brand')).toEqual(['title', 'panel']);
  });
});

describe('every operation produces a loadable project', () => {
  const operations: Array<[string, (input: ProgramNode) => ProgramNode]> = [
    ['create', (input) => createScene(input, { after: 'intro', name: 'prompt' })],
    ['duplicate', (input) => duplicateScene(input, 'intro')],
    ['rename', (input) => renameScene(input, 'intro', 'opening')],
    ['reorder', (input) => reorderScene(input, 'demo', 0)],
    ['delete', (input) => deleteScene(input, 'demo')],
    ['duration', (input) => setSceneDuration(input, 'intro', 6)],
    ['transition', (input) => setSceneTransition(input, 'demo', 'cameraMove')],
    ['identity', (input) => setMemberIdentity(input, 'panel', 'brand')],
    ['move', (input) => moveMember(input, 'panel', 'intro')],
  ];

  for (const [label, operate] of operations) {
    it(`round-trips through source after ${label}`, () => {
      const next = operate(program());
      const reparsed = parseMotion(serializeProgram(next));
      const graph = buildSceneGraph(reparsed);
      expect(graph.storyboard!.length).toBeGreaterThan(0);
      expect(readStoryboard(reparsed).map((entry) => entry.name)).toEqual(names(next));
    });
  }

  it('never mutates the input program', () => {
    const input = program();
    const snapshot = JSON.stringify(input);
    for (const [, operate] of operations) operate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
