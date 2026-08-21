import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import {
  authoredEditorElements,
  elementsForStoryboardTimeline,
  localizeTimelineRange,
  projectTimeFromTimeline,
  storyboardTimelineWindow,
  timelineTimeFromProject,
} from '../../src/ui/storyboard-timeline';
import { upsertPresetCallOption } from '../../src/ui/preset-call-editing';

const SOURCE = `canvas { size 320x180 fps 30 duration 8s background #000000 }
scene intro { label "Intro" duration 3s }
scene demo { label "Demo" duration 5s }
text authored__name { scene intro value "Intro" duration 2s }
text demoTitle { scene demo value "Demo" duration 2s textAnimation "charReveal(duration 800ms)" }`;

describe('storyboard editor timelines', () => {
  it('uses authored AST identity and scopes rows to roots or active-scene members', () => {
    const program = parseMotion(SOURCE);
    const scene = buildSceneGraph(program);
    const authored = authoredEditorElements(program, scene.elements);

    expect(authored.map((element) => element.id)).toContain('authored__name');
    expect(authored.some((element) => element.id.startsWith('demoTitle__'))).toBe(false);
    expect(elementsForStoryboardTimeline(authored, scene.storyboard ?? [], '')).toHaveLength(2);
    expect(
      elementsForStoryboardTimeline(authored, scene.storyboard ?? [], 'intro').map(
        (element) => element.id
      )
    ).toEqual(['authored__name']);
    expect(
      elementsForStoryboardTimeline(authored, scene.storyboard ?? [], 'demo').map(
        (element) => element.id
      )
    ).toEqual(['demoTitle']);
  });

  it('converts project-global time and ranges to the active scene timeline', () => {
    const scene = buildSceneGraph(parseMotion(SOURCE));
    const window = storyboardTimelineWindow(scene.storyboard ?? [], 'demo', 8);

    expect(window).toEqual({ origin: 3, duration: 5, end: 8 });
    expect(timelineTimeFromProject(4.5, window)).toBe(1.5);
    expect(projectTimeFromTimeline(1.5, window)).toBe(4.5);
    expect(localizeTimelineRange({ start: 3, end: 10 }, window)).toEqual({ start: 0, end: 5 });
  });

  it('selects large storyboards in one pass', () => {
    const program = parseMotion(SOURCE);
    const scene = buildSceneGraph(program);
    const base = authoredEditorElements(program, scene.elements);
    const large = Array.from({ length: 20_000 }, (_, index) => {
      const sourceElement = base[index % base.length];
      if (!sourceElement) throw new Error('Expected authored storyboard fixtures.');
      return { ...sourceElement, id: `generated_${index}` };
    });
    const started = performance.now();
    const selected = elementsForStoryboardTimeline(large, scene.storyboard ?? [], 'demo');
    const elapsed = performance.now() - started;

    expect(selected).toEqual([]);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('preset call editing', () => {
  it('updates one option while preserving the preset and other options', () => {
    expect(upsertPresetCallOption('beams(duration 4s intensity .5)', 'opacity', 0.35)).toBe(
      'beams(duration 4s intensity .5 opacity 0.35)'
    );
    expect(upsertPresetCallOption('beams(duration 4s opacity .2)', 'opacity', 0.6)).toBe(
      'beams(duration 4s opacity 0.6)'
    );
  });
});
