import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

describe('uploaded data assets', () => {
  it('keeps embedded SVG imports renderable after serialization', () => {
    const source = `import "data:image/svg+xml;base64,PHN2Zy8+" as logo

logo {
  center
  width 480
}`;
    const program = parseMotion(source);
    const scene = buildSceneGraph(parseMotion(serializeProgram(program)));

    expect(scene.imports[0]).toMatchObject({ name: 'logo', type: 'svg' });
    expect(scene.elements[0]?.asset?.path).toContain('data:image/svg+xml');
  });
});
