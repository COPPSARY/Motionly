import { describe, expect, it } from 'vitest';
import { packTimelineLanes } from '../../src/ui/timeline-lanes';
import type { Element } from '../../src/types/scene';

const element = (id: string, kind: Element['kind']): Element => ({ id, kind }) as Element;

describe('timeline lane packing', () => {
  it('reuses lanes for continuations and separates overlaps', () => {
    const ranges = new Map([
      ['textOne', { start: 0, end: 2 }],
      ['textTwo', { start: 2, end: 4 }],
      ['textOverlap', { start: 1, end: 3 }],
      ['imageOne', { start: 0, end: 2 }],
      ['imageTwo', { start: 2, end: 4 }],
    ]);
    const lanes = packTimelineLanes(
      [
        element('textOne', 'text'),
        element('textTwo', 'text'),
        element('textOverlap', 'text'),
        element('imageOne', 'asset'),
        element('imageTwo', 'asset'),
      ],
      (id) => ranges.get(id)!
    );

    expect(lanes.map((lane) => lane.items.map((item) => item.element.id))).toEqual([
      ['textOne', 'textTwo'],
      ['imageOne', 'imageTwo'],
      ['textOverlap'],
    ]);
  });
});
