import { describe, expect, it } from 'vitest';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';

describe('rotation/repeat .motion syntax', () => {
  it('normalizes rotationZ to the canonical rotation field', () => {
    const scene = buildSceneGraph(
      parseMotion(`canvas { duration 1s }\nimage logo { source "logo.svg" rotationZ 45 }`)
    );
    const element = scene.elements.find((item) => item.id === 'logo');
    expect((element?.properties as unknown as Record<string, unknown>)['rotation']).toBe(45);
    expect(
      (element?.properties as unknown as Record<string, unknown>)['rotationZ']
    ).toBeUndefined();
  });

  it('parses repeat and repeatType on an animate block, including "infinite"', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 5s }
        image logo { source "logo.svg" }
        animate logo {
          from { rotation 0 }
          to { rotation 360 }
          duration 1s
          repeat infinite
          repeatType yoyo
        }
      `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    expect(animation?.repeat).toBe('infinite');
    expect(animation?.repeatType).toBe('yoyo');
  });

  it('parses a numeric repeat count', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 5s }
        image logo { source "logo.svg" }
        animate logo {
          from { rotation 0 }
          to { rotation 360 }
          duration 1s
          repeat 3
        }
      `)
    );
    const animation = scene.animations.find((item) => item.target === 'logo');
    expect(animation?.repeat).toBe(3);
  });

  it('round-trips repeat/repeatType through the serializer', () => {
    const ast = parseMotion(`
      canvas { duration 5s }
      image logo { source "logo.svg" }
      animate logo {
        from { rotation 0 }
        to { rotation 360 }
        duration 1s
        repeat infinite
        repeatType yoyo
      }
    `);
    const source = serializeProgram(ast);
    expect(source).toContain('repeat infinite');
    expect(source).toContain('repeatType yoyo');

    const reparsed = buildSceneGraph(parseMotion(source));
    const animation = reparsed.animations.find((item) => item.target === 'logo');
    expect(animation?.repeat).toBe('infinite');
    expect(animation?.repeatType).toBe('yoyo');
  });
});
