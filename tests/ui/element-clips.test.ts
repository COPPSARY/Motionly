import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  elementClipWindow,
  elementWindowProperties,
  moveElementClip,
  splitElementClip,
} from '../../src/ui/element-clips';

describe('regular element clip timing', () => {
  it('normalizes explicit windows and preserves unrelated properties', () => {
    expect(elementClipWindow({ start: '500ms', duration: '2s' }, 5)).toEqual({
      start: 0.5,
      end: 2.5,
    });
    expect(elementWindowProperties({ value: 'Hello' }, 1, 3)).toMatchObject({
      value: 'Hello',
      start: '1.000s',
      duration: '2.000s',
    });
  });

  it('splits text with duplicated animations into adjacent windows', () => {
    const program = parseMotion(`
      text title {
        value "Hello"
        start 0s
        duration 4s
      }
      animate title {
        from { opacity 0 }
        to { opacity 1 }
        delay 0s
        duration 1s
      }
    `);
    const result = splitElementClip(program, 'title', 2, { start: 0, end: 4 }, 'title_split');
    expect(result).not.toBeNull();
    const reparsed = parseMotion(serializeProgram(result!.program));
    const elements = reparsed.body.filter((node) => node.type === 'Element');
    expect(elements.map((node) => node.name)).toEqual(['title', 'title_split']);
    expect(elements.map((node) => node.properties)).toMatchObject([
      { start: '0.000s', duration: '2.000s' },
      { start: '2.000s', duration: '2.000s' },
    ]);
    expect(
      reparsed.body.filter((node) => node.type === 'Animation').map((node) => node.target)
    ).toEqual(['title', 'title_split']);
  });

  it('moves an element window and its keyframes together', () => {
    const program = parseMotion(`
      text title { value "Hello" start 1s duration 3s }
      animate title {
        keyframes {
          0% { opacity 0 }
          100% { opacity 1 }
        }
        delay 1.5s
        duration 2s
      }
    `);
    expect(moveElementClip(program, 'title', 4, 7, 1)).toBe(true);
    const scene = buildSceneGraph(parseMotion(serializeProgram(program)));
    expect(scene.elements[0]?.properties).toMatchObject({ start: 4, duration: 3 });
    expect(scene.animations[0]).toMatchObject({ delay: 4.5, duration: 2 });
    expect(scene.animations[0]?.keyframes.map((frame) => frame.offset)).toEqual([0, 1]);
  });

  it('creates a second import alias and evaluator respects both visibility windows', () => {
    const program = parseMotion(`
      import "/image.svg" as image
      image { center }
    `);
    const result = splitElementClip(program, 'image', 2, { start: 0, end: 4 }, 'image_split')!;
    const source = serializeProgram(result.program);
    expect(source).toContain('import "/image.svg" as image_split');
    const scene = buildSceneGraph(parseMotion(source));
    expect(evaluateScene(scene, 1).elements.map((element) => element.id)).toContain('image');
    expect(evaluateScene(scene, 1).elements.map((element) => element.id)).not.toContain(
      'image_split'
    );
    expect(evaluateScene(scene, 3).elements.map((element) => element.id)).toContain('image_split');
    expect(evaluateScene(scene, 3).elements.map((element) => element.id)).not.toContain('image');
  });
});
