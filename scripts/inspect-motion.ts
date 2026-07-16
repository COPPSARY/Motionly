import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectMotionProject } from '../src/inspection/project-inspector';

const args = process.argv.slice(2);
const projectArg = args.find((arg) => !arg.startsWith('--'));

if (!projectArg) {
  console.error('Usage: npm run inspect:motion -- <project.motion> [--expect-duration=<seconds>]');
  process.exitCode = 2;
} else {
  const projectPath = resolve(projectArg);
  const source = await readFile(projectPath, 'utf8');
  const result = inspectMotionProject(source);
  const expectedDurationArg = args.find((arg) => arg.startsWith('--expect-duration='));
  const expectedDuration = expectedDurationArg
    ? Number(expectedDurationArg.slice('--expect-duration='.length))
    : undefined;
  const durationMatches =
    expectedDuration === undefined || Math.abs(result.duration - expectedDuration) < 0.0005;

  console.log(JSON.stringify({ project: projectPath, durationMatches, ...result }, null, 2));
  if (!result.ok || !durationMatches) process.exitCode = 1;
}
