import type { Element, ElementKind } from '../types/scene';

export interface TimelineItem {
  element: Element;
  range: { start: number; end: number };
}

export interface TimelineLane {
  kind: ElementKind;
  items: [TimelineItem, ...TimelineItem[]];
  start: number;
  end: number;
}

export function packTimelineLanes(
  elements: Element[],
  rangeOf: (id: string) => TimelineItem['range']
): TimelineLane[] {
  const lanes: TimelineLane[] = [];
  const items = elements
    .map((element) => ({ element, range: rangeOf(element.id) }))
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);

  for (const item of items) {
    const lane = lanes.find(
      (candidate) => candidate.kind === item.element.kind && candidate.end <= item.range.start
    );
    if (lane) {
      lane.items.push(item);
      lane.end = Math.max(lane.end, item.range.end);
    } else {
      lanes.push({
        kind: item.element.kind,
        items: [item],
        start: item.range.start,
        end: item.range.end,
      });
    }
  }

  return lanes;
}
