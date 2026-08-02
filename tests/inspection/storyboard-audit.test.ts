import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { auditStoryboard } from '../../src/inspection/motion-audit';
import { setMemberIdentity } from '../../src/ui/storyboard';
import { serializeProgram } from '../../src/language/serializer';

function graph(source: string) {
  return buildSceneGraph(parseMotion(source));
}

function kinds(source: string): string[] {
  return auditStoryboard(graph(source)).map((finding) => finding.kind);
}

const contiguous = `
canvas { size 1920x1080 duration 8s }

scene intro { duration 4s label "Intro" }
scene demo { duration 4s }

text title {
  scene intro
  identity brand
  value "Motionly"
  center
  size 72
  color #ffffff
}

animate title {
  from { opacity 0 y 40 }
  to { opacity 1 y 0 }
  delay 0.1s
  duration 0.6s
}

text panel {
  scene demo
  identity brand
  value "Motionly"
  size 32
  color #ffffff
}
`;

describe('storyboard audit', () => {
  it('says nothing about a legacy flat project', () => {
    expect(
      auditStoryboard(graph('canvas { duration 4s }\ntext t { value "x" size 40 color #fff }'))
    ).toEqual([]);
  });

  it('passes a contiguous storyboard with a shared component', () => {
    expect(kinds(contiguous)).toEqual([]);
  });

  it('flags an object that belongs to no scene', () => {
    const findings = auditStoryboard(
      graph(`${contiguous}\ntext loose { value "loose" size 20 color #fff }`)
    );
    const orphan = findings.find((finding) => finding.kind === 'scene-orphan');
    expect(orphan?.target).toBe('loose');
    expect(orphan?.detail).toMatch(/scene NAME/);
  });

  it('accepts a nested object because its scene is an ancestor', () => {
    const nested = `
canvas { duration 8s }
scene intro { duration 8s label "Intro" }
group stack { scene intro }
text a { parent stack value "a" size 20 color #fff animation softReveal }
`;
    expect(kinds(nested)).not.toContain('scene-orphan');
  });

  it('reports dead air between scenes', () => {
    const gap = `
canvas { duration 12s }
scene a { duration 4s label "A" }
scene b { start 6s duration 4s }
text t { scene a value "x" size 20 color #fff animation softReveal }
text u { scene b value "y" size 20 color #fff animation softReveal }
`;
    const finding = auditStoryboard(graph(gap)).find((entry) => entry.kind === 'scene-gap');
    expect(finding?.detail).toMatch(/2s of dead air/);
    expect(finding?.at).toBe(4);
  });

  it('reports overlapping scenes as an error', () => {
    const overlap = `
canvas { duration 12s }
scene a { duration 6s label "A" }
scene b { start 3s duration 4s }
text t { scene a value "x" size 20 color #fff animation softReveal }
text u { scene b value "y" size 20 color #fff animation softReveal }
`;
    const finding = auditStoryboard(graph(overlap)).find((entry) => entry.kind === 'scene-overlap');
    expect(finding?.severity).toBe('error');
    expect(finding?.detail).toMatch(/starts 3s before/);
  });

  it('reports a jump cut, and clears once a component is shared', () => {
    const jump = `
canvas { duration 8s }
scene a { duration 4s label "A" }
scene b { duration 4s }
text t { scene a value "x" size 20 color #fff animation softReveal }
text u { scene b value "y" size 20 color #fff animation softReveal }
`;
    expect(kinds(jump)).toContain('scene-discontinuity');

    const shared = serializeProgram(
      setMemberIdentity(setMemberIdentity(parseMotion(jump), 't', 'brand'), 'u', 'brand')
    );
    expect(kinds(shared)).not.toContain('scene-discontinuity');
  });

  it('accepts a reframe as continuity without a shared component', () => {
    const reframed = `
canvas { duration 8s }
scene a { duration 4s label "A" }
scene b { duration 4s zoom 1.3 }
text t { scene a value "x" size 20 color #fff animation softReveal }
text u { scene b value "y" size 20 color #fff animation softReveal }
`;
    expect(kinds(reframed)).not.toContain('scene-discontinuity');
  });

  it('reports a member that would sit frozen', () => {
    const frozen = `
canvas { duration 4s }
scene a { duration 4s label "A" }
text still { scene a value "x" size 20 color #fff }
`;
    const finding = auditStoryboard(graph(frozen)).find((entry) => entry.kind === 'scene-still');
    expect(finding?.target).toBe('still');
  });
});
