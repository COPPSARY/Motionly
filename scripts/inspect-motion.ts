import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectMotionProject } from '../src/inspection/project-inspector';

const args = process.argv.slice(2);
const projectArg = args.find((arg) => !arg.startsWith('--'));

if (!projectArg) {
  console.error(
    'Usage: npm run inspect:motion -- <project.motion> [--expect-duration=<seconds>] [--strict] [--json]'
  );
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

  if (args.includes('--json')) {
    console.log(JSON.stringify({ project: projectPath, durationMatches, ...result }, null, 2));
  } else {
    const { audit, ...report } = result;
    console.log(JSON.stringify({ project: projectPath, durationMatches, ...report }, null, 2));
    console.log(`\nMotion quality: ${audit.findings.length} finding(s)`);
    for (const [kind, count] of Object.entries(audit.counts)) {
      console.log(`  ${kind}: ${count}`);
    }
    for (const finding of audit.findings) {
      const where = [finding.target, finding.at !== undefined ? `${finding.at}s` : '']
        .filter(Boolean)
        .join(' @ ');
      console.log(`  [${finding.severity}] ${finding.kind}${where ? ` (${where})` : ''}`);
      console.log(`      ${finding.detail}`);
    }
  }

  // Quality findings are advisory unless --strict is requested, so the inspector
  // stays usable on work in progress.
  const strictFailure = args.includes('--strict') && result.audit.findings.length > 0;
  if (!result.ok || !durationMatches || !result.audit.ok || strictFailure) process.exitCode = 1;
}
