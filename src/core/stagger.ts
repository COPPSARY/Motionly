/**
 * Shared delay-distribution math for `sequence` blocks, used by both explicit
 * `animate` nodes (scene-graph.ts) and preset-driven elements (presets.ts) so a
 * group of members enters with an intentional hierarchy instead of a flat
 * per-index delay increment.
 */

export type SequenceHierarchy = 'linear' | 'wave' | 'center-out';

/**
 * Compute the extra delay for a member at `index` within a `count`-member
 * sequence, given a base `delay` and per-step `gap`.
 */
export function distributeSequenceDelay(
  delay: number,
  gap: number,
  index: number,
  count: number,
  hierarchy: SequenceHierarchy = 'linear'
): number {
  if (index < 0 || count <= 1) return delay;

  if (hierarchy === 'center-out') {
    const mid = (count - 1) / 2;
    return delay + Math.abs(index - mid) * gap;
  }

  if (hierarchy === 'wave') {
    const t = index / (count - 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return delay + eased * gap * (count - 1);
  }

  return delay + index * gap;
}

export function normalizeHierarchy(value: unknown): SequenceHierarchy {
  return value === 'wave' || value === 'center-out' ? value : 'linear';
}

interface SequenceLike {
  name: string;
  delay: number;
  gap: number;
  items: string[];
  hierarchy: SequenceHierarchy;
}

/**
 * Compute a member element's sequence-driven delay offset, for preset-driven
 * animations (as opposed to explicit `animate` nodes, which resolve their
 * `sequence` reference through the scene-graph's normalizeAnimation instead).
 * Returns 0 if `sequenceName` is unset, unknown, or does not list `elementId`.
 */
export function elementSequenceOffset(
  sequences: SequenceLike[],
  sequenceName: unknown,
  elementId: string
): number {
  if (!sequenceName) return 0;

  const sequence = sequences.find((item) => item.name === sequenceName);
  if (!sequence) return 0;

  const index = sequence.items.indexOf(elementId);
  if (index < 0) return 0;

  return distributeSequenceDelay(
    sequence.delay,
    sequence.gap,
    index,
    sequence.items.length,
    sequence.hierarchy
  );
}
