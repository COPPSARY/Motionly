/**
 * Convert a preset project into a storyboard.
 *
 * Presets are the flagship examples, so their scene boundaries are authored, not
 * guessed: each one is passed the times its own composition already turns on.
 * The script proves timing is preserved before it writes anything — a preset that
 * drifts is worse than a preset that is still flat.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseMotion } from '../src/language/parser';
import { serializeProgram } from '../src/language/serializer';
import { buildSceneGraph } from '../src/scene/scene-graph';
import { evaluateScene } from '../src/animation/evaluator';
import { migrateToScenes } from '../src/motion-system/scene-migration';
import { auditStoryboard } from '../src/inspection/motion-audit';
import type { ProgramNode } from '../src/types/parser';

interface PresetPlan {
  file: string;
  boundaries: number[];
  names: string[];
  labels: string[];
}

const PLANS: PresetPlan[] = [
  {
    file: 'preset/motionly/motionly.motion',
    // The composition's own pseudo-scene backdrops already mark these turns.
    boundaries: [0, 2.7, 8.75, 13.75, 23.05, 28.85],
    names: ['opening', 'origin', 'agents', 'editor', 'pipeline', 'closing'],
    labels: ['Opening', 'Source', 'Agents', 'Editor', 'Pipeline', 'Closing'],
  },
];

/** Visible opacity, treating a culled element as invisible. */
function opacity(program: ProgramNode, id: string, time: number): number {
  const found = evaluateScene(buildSceneGraph(program), time).elements.find(
    (element) => element.id === id
  );
  return found ? Number(found.render.opacity) : 0;
}

function ids(program: ProgramNode): string[] {
  return program.body.flatMap((node) =>
    node.type === 'Element' && node.kind !== 'scene' ? [node.name] : []
  );
}

function compare(before: ProgramNode, after: ProgramNode, samples: number[]): string[] {
  const drift: string[] = [];
  for (const id of ids(before)) {
    for (const time of samples) {
      const left = opacity(before, id, time);
      const right = opacity(after, id, time);
      if (Math.abs(left - right) > 0.02) {
        drift.push(`${id} @ ${time}s: ${left.toFixed(3)} → ${right.toFixed(3)}`);
      }
    }
  }
  return drift;
}

for (const plan of PLANS) {
  const source = readFileSync(plan.file, 'utf8');
  const before = parseMotion(source);
  const result = migrateToScenes(before, {
    strategy: 'segment',
    boundaries: plan.boundaries,
    names: plan.names,
    labels: plan.labels,
  });

  const text = serializeProgram(result.program);
  const after = parseMotion(text);
  const graph = buildSceneGraph(after);

  // Sample the middle of each scene, where the composition should be settled and
  // identical. Boundaries themselves are expected to differ: that is where the
  // storyboard now supplies exits instead of letting objects pop.
  const samples = plan.boundaries.map((start, index) => {
    const end = plan.boundaries[index + 1] ?? graph.canvas.duration;
    return Number((start + (end - start) / 2).toFixed(2));
  });

  const drift = compare(before, after, samples);
  const findings = auditStoryboard(graph);

  console.log(`\n=== ${plan.file}`);
  console.log(`strategy: ${result.strategy}, scenes: ${result.scenes.join(', ')}`);
  console.log(`storyboard: ${graph.storyboard?.map((s) => `${s.name}@${s.start}s`).join(' → ')}`);
  console.log(`sampled at: ${samples.join(', ')}`);
  console.log(`drift: ${drift.length ? `\n  ${drift.join('\n  ')}` : 'none'}`);
  console.log(
    `audit: ${findings.length ? findings.map((f) => `${f.kind}(${f.target ?? ''})`).join(', ') : 'clean'}`
  );

  if (process.argv.includes('--write')) {
    if (drift.length) {
      console.error('Refusing to write: the migration changed the film.');
      process.exit(1);
    }
    writeFileSync(plan.file, `${text}\n`, 'utf8');
    console.log('written');
  }
}
