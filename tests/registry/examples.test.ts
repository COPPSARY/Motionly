import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditScene } from '../../src/inspection/motion-audit';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { registryExamples } from '../../src/motion-system/examples';
import { LAYOUT_TYPES } from '../../src/motion-system/layout';
import { SHOWCASE_TYPES } from '../../src/motion-system/showcase';

const examples = registryExamples();

describe('registry example compositions', () => {
  it('ships one installable example per layout and showcase', () => {
    const names = examples.map((example) => example.name).sort();
    expect(names).toEqual([...LAYOUT_TYPES, ...SHOWCASE_TYPES].sort());
  });

  it('compiles every example into a renderable scene', () => {
    for (const example of examples) {
      const scene = buildSceneGraph(parseMotion(example.source));
      expect(scene.elements.length, example.name).toBeGreaterThan(1);
      expect(scene.canvas.duration, example.name).toBe(example.duration);
    }
  });

  /**
   * The catalog is held to the rules it publishes. If this fails, either an
   * example regressed or the engine started emitting motion that violates the
   * doctrine — both are worth failing the build for.
   */
  it('passes the motion doctrine audit with zero findings', () => {
    for (const example of examples) {
      const audit = auditScene(buildSceneGraph(parseMotion(example.source)));
      expect(
        audit.findings.map((finding) => `${finding.kind}: ${finding.detail}`),
        example.name
      ).toEqual([]);
    }
  });

  it('declares a sustained-motion route on every beat', () => {
    for (const example of examples) {
      const beats = buildSceneGraph(parseMotion(example.source)).beats ?? [];
      expect(beats.length, example.name).toBeGreaterThan(1);
      for (const beat of beats) {
        expect(beat.route, `${example.name} / ${beat.name}`).toBeTruthy();
        expect(beat.label, `${example.name} / ${beat.name}`).toBeTruthy();
      }
    }
  });

  it('writes each example into its registry folder as an installable file', () => {
    const registry = JSON.parse(readFileSync(resolve('registry/registry.json'), 'utf8')) as {
      items: Array<{ name: string; files?: Array<{ path: string; target: string }> }>;
    };
    for (const example of examples) {
      const item = registry.items.find((candidate) => candidate.name === example.name)!;
      expect(item, example.name).toBeDefined();
      expect(item.files?.length, example.name).toBe(1);
      const file = item.files![0]!;
      expect(existsSync(resolve(file.path)), file.path).toBe(true);
      expect(file.target).toBe(`compositions/${example.slug}.motion`);
      // The generated registry copy must match the source of truth.
      expect(readFileSync(resolve(file.path), 'utf8')).toBe(example.source);
    }
  });

  it('points every registry item at the TypeScript that implements it', () => {
    const registry = JSON.parse(readFileSync(resolve('registry/registry.json'), 'utf8')) as {
      items: Array<{ name: string; builtin?: boolean; manifest: string }>;
    };
    for (const item of registry.items.filter((candidate) => candidate.builtin)) {
      const manifest = JSON.parse(readFileSync(resolve('registry', item.manifest), 'utf8')) as {
        implementation?: { name: string; source: string };
      };
      expect(manifest.implementation, item.name).toBeDefined();
      expect(existsSync(resolve(manifest.implementation!.source)), item.name).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(registryExamples()).toEqual(examples);
  });
});
