import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  migrateToScenes,
  segmentBoundaries,
  suggestIdentities,
} from '../../src/motion-system/scene-migration';
import type { ElementNode } from '../../src/types/parser';

function elements(program: { body: unknown[] }): ElementNode[] {
  return (program.body as ElementNode[]).filter((node) => node.type === 'Element');
}

const flat = `
canvas { size 1920x1080 duration 9s }

text title {
  value "Hello"
  center
  size 72
  color #ffffff
}

text subtitle {
  value "World"
  size 32
  color #9aa3b2
}

animate title {
  from { opacity 0 y 40 }
  to { opacity 1 y 0 }
  delay 0s
  duration 0.6s
}

animate subtitle {
  from { opacity 0 y 40 }
  to { opacity 1 y 0 }
  delay 5s
  duration 0.6s
}
`;

const beaten = `
canvas { duration 12s }

beat intro { duration 4s label "Intro" }
beat reveal { duration 8s label "Reveal" zoom 1.3 }

text title { beat intro value "Hello" center size 72 color #ffffff }
text detail { beat reveal value "Detail" size 40 color #ffffff }
text stray { value "Stray" size 20 color #ffffff }
`;

describe('migration strategy selection', () => {
  it('promotes beats when the project already storyboards with them', () => {
    const result = migrateToScenes(parseMotion(beaten));
    expect(result.strategy).toBe('beats');
    expect(result.scenes).toEqual(['intro', 'reveal']);
  });

  it('segments a flat project at quiet gaps', () => {
    const result = migrateToScenes(parseMotion(flat));
    expect(result.strategy).toBe('segment');
    expect(result.scenes).toHaveLength(2);
  });

  it('falls back to one scene when the timeline never goes quiet', () => {
    const tight = `
canvas { duration 4s }
text a { value "a" size 20 color #fff }
text b { value "b" size 20 color #fff }
`;
    const result = migrateToScenes(parseMotion(tight));
    expect(result.strategy).toBe('single');
    expect(result.scenes).toEqual(['main']);
  });

  it('is idempotent: a storyboard is left alone', () => {
    const once = migrateToScenes(parseMotion(flat));
    const twice = migrateToScenes(once.program);
    expect(twice.strategy).toBe('none');
    expect(twice.program).toBe(once.program);
  });

  it('honors an explicit strategy', () => {
    expect(migrateToScenes(parseMotion(flat), { strategy: 'single' }).strategy).toBe('single');
  });
});

describe('beat promotion', () => {
  const result = migrateToScenes(parseMotion(beaten));

  it('carries the beat window, label, and framing onto the scene', () => {
    const scenes = elements(result.program).filter((node) => node.kind === 'scene');
    expect(scenes.map((node) => node.name)).toEqual(['intro', 'reveal']);
    expect(scenes[1]!.properties['duration']).toBe('8s');
    expect(scenes[1]!.properties['label']).toBe('Reveal');
    expect(scenes[1]!.properties['zoom']).toBe('1.3');
  });

  it('rewrites beat attachments as scene membership', () => {
    const title = elements(result.program).find((node) => node.name === 'title')!;
    expect(title.properties['scene']).toBe('intro');
    expect(title.properties['beat']).toBeUndefined();
  });

  it('adopts unattached objects into the first scene and reports it', () => {
    const stray = elements(result.program).find((node) => node.name === 'stray')!;
    expect(stray.properties['scene']).toBe('intro');
    expect(result.notes.join(' ')).toMatch(/stray/);
  });

  it('leaves no beat blocks behind', () => {
    expect(elements(result.program).some((node) => node.kind === 'beat')).toBe(false);
  });
});

describe('segmentation', () => {
  it('splits where the composition goes quiet', () => {
    expect(segmentBoundaries(parseMotion(flat))).toEqual([0, 5]);
  });

  it('assigns each object to the scene its entrance falls in', () => {
    const result = migrateToScenes(parseMotion(flat));
    const nodes = elements(result.program);
    expect(nodes.find((node) => node.name === 'title')!.properties['scene']).toBe('scene1');
    expect(nodes.find((node) => node.name === 'subtitle')!.properties['scene']).toBe('scene2');
  });

  it('sizes each scene from its own span', () => {
    const scenes = elements(migrateToScenes(parseMotion(flat)).program).filter(
      (node) => node.kind === 'scene'
    );
    expect(scenes[0]!.properties['duration']).toBe('5s');
    expect(scenes[1]!.properties['duration']).toBe('4s');
  });
});

describe('migrated output is a working project', () => {
  it('compiles into a storyboard the editor can read', () => {
    const scene = buildSceneGraph(migrateToScenes(parseMotion(flat)).program);
    expect(scene.storyboard!.map((plan) => plan.name)).toEqual(['scene1', 'scene2']);
    expect(scene.storyboard![0]!.members.map((member) => member.id)).toEqual(['title']);
  });

  it('round-trips through the serializer', () => {
    const migrated = migrateToScenes(parseMotion(flat)).program;
    const text = serializeProgram(migrated);
    expect(text).toMatch(/scene scene1 \{/);
    expect(text).toMatch(/scene scene1\n/);
    const graph = buildSceneGraph(parseMotion(text));
    expect(graph.storyboard!.map((plan) => plan.name)).toEqual(['scene1', 'scene2']);
  });

  it('preserves every animation', () => {
    const before = parseMotion(flat).body.filter((node) => node.type === 'Animation').length;
    const after = migrateToScenes(parseMotion(flat)).program.body.filter(
      (node) => node.type === 'Animation'
    ).length;
    expect(after).toBe(before);
  });
});

describe('identity suggestions', () => {
  it('groups recurring components under one persistent identity', () => {
    const program = parseMotion(`
canvas { duration 8s }
scene a { duration 4s label "A" }
scene b { duration 4s }
text logo { scene a value "M" size 90 color #fff }
text logoSmall { scene b value "M" size 30 color #fff }
text panel { scene b value "P" size 30 color #fff }
`);
    const identities = suggestIdentities(program);
    expect(identities.get('logo')).toBe('logo');
    expect(identities.get('logoSmall')).toBe('logo');
    expect(identities.has('panel')).toBe(false);
  });
});
