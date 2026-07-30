import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { buildSceneGraph } from '../../src/scene/scene-graph';
import { auditScene, MOTION_FINDING_KINDS } from '../../src/inspection/motion-audit';
import { inspectMotionProject } from '../../src/inspection/project-inspector';

const audit = (body: string, duration = 6) =>
  auditScene(
    buildSceneGraph(
      parseMotion(`canvas {
  size 1920x1080
  fps 60
  duration ${duration}s
}

${body}`)
    )
  );

const kinds = (body: string, duration?: number) =>
  audit(body, duration).findings.map((finding) => finding.kind);

describe('motion quality audit', () => {
  it('flags an entrance slower than the single-entry budget', () => {
    const found = kinds(`text slow {
  value "Slow"
  center
  opacity 0
}

animate slow {
  from {
    opacity 0
    y 60
  }
  to {
    opacity 1
    y 0
  }
  duration 1.6s
  easing power3.out
}`);
    expect(found).toContain('entry-over-budget');
  });

  it('accepts an entrance inside the budget', () => {
    const found = kinds(`text quick {
  value "Quick"
  center
  opacity 0
}

animate quick {
  from {
    opacity 0
    y 40
  }
  to {
    opacity 1
    y 0
  }
  duration 0.6s
  easing power4.out
}`);
    expect(found).not.toContain('entry-over-budget');
  });

  it('flags a cascade with identical gaps as a queue', () => {
    const body = [0, 0.2, 0.4, 0.6]
      .map(
        (delay, index) => `text q${index} {
  value "Item"
  center
  y ${index * 100}
  opacity 0
}

animate q${index} {
  from {
    opacity 0
    y ${index * 100 + 40}
  }
  to {
    opacity 1
    y ${index * 100}
  }
  duration 0.5s
  delay ${delay}s
  easing power4.out
}`
      )
      .join('\n\n');
    const findings = audit(body).findings;
    expect(findings.map((finding) => finding.kind)).toContain('uneven-stagger');
    expect(findings.find((finding) => finding.kind === 'uneven-stagger')!.detail).toContain(
      'a queue, not a wave'
    );
  });

  it('flags a cascade that spreads past one beat', () => {
    const body = [0, 0.18, 0.36, 0.54]
      .map(
        (delay, index) => `text s${index} {
  value "Item"
  center
  opacity 0
}

animate s${index} {
  from {
    opacity 0
    y 40
  }
  to {
    opacity 1
    y 0
  }
  duration 0.5s
  delay ${delay}s
  easing power4.out
}`
      )
      .join('\n\n');
    expect(kinds(body)).toContain('stagger-window');
  });

  it('accepts an accelerating cascade produced by the layout engine', () => {
    const found = kinds(
      `layout grid {
  type featureGrid
  columns 3
}

text a {
  value "A"
  parent grid
}

text b {
  value "B"
  parent grid
}

text c {
  value "C"
  parent grid
}

text d {
  value "D"
  parent grid
}`
    );
    expect(found).not.toContain('uneven-stagger');
    expect(found).not.toContain('stagger-window');
  });

  it('reports a dead zone where nothing is in flight', () => {
    const findings = audit(
      `text only {
  value "Alone"
  center
  opacity 0
}

animate only {
  from {
    opacity 0
    y 40
  }
  to {
    opacity 1
    y 0
  }
  duration 0.6s
  easing power4.out
}`,
      8
    ).findings;
    const dead = findings.find((finding) => finding.kind === 'dead-zone')!;
    expect(dead).toBeDefined();
    expect(dead.detail).toContain('sustained-motion route');
  });

  it('does not count idle drift as coverage', () => {
    const findings = audit(
      `text drifting {
  value "Waiting"
  center
}

animate drifting {
  keyframes {
    0% { y 0 }
    50% { y -12 }
    100% { y 0 }
  }
  duration 4s
  easing sine.inOut
  repeat infinite
  repeatType loop
}`,
      8
    ).findings;
    const dead = findings.find((finding) => finding.kind === 'dead-zone')!;
    expect(dead).toBeDefined();
    expect(dead.detail).toContain('reads as waiting');
  });

  it('places child animation coverage inside its parent scene window', () => {
    const found = kinds(
      `text early {
  value "First"
}

animate early {
  from { x -100 }
  to { x 100 }
  duration 3s
  easing power3.out
}

scene later {
  start 3s
  duration 3s
}

text late {
  parent later
  value "Second"
}

animate late {
  from { x -100 }
  to { x 100 }
  duration 3s
  easing power3.out
}`,
      6
    );
    expect(found).not.toContain('dead-zone');
  });

  it('treats containment as composition, not collision', () => {
    const found = kinds(`group stage {
  center
}

overlay panel {
  parent stage
  width 900
  height 500
  fill #202020
  opacity 1
}

overlay chip {
  parent stage
  width 200
  height 60
  fill #7CF7C5
  opacity 1
}`);
    expect(found).not.toContain('collision');
  });

  it('flags two similarly sized unrelated elements stacked on each other', () => {
    const found = kinds(`group stage {
  center
}

overlay cardA {
  parent stage
  width 600
  height 400
  fill #202020
  opacity 1
}

overlay cardB {
  parent stage
  width 620
  height 420
  fill #303030
  opacity 1
}`);
    expect(found).toContain('collision');
  });

  it('does not flag an element that travels off frame as offscreen', () => {
    const found = kinds(`group stage {
  center
}

overlay exiting {
  parent stage
  width 200
  height 200
  fill #ffffff
  opacity 1
}

animate exiting {
  from {
    x 0
  }
  to {
    x 2400
  }
  duration 2s
  easing power2.in
}`);
    expect(found).not.toContain('offscreen');
  });

  it('does not report binary opacity steps as imperceptibly fast motion', () => {
    const found = kinds(`text title {
  value "Snap"
  opacity 0
}

animate title {
  from {
    opacity 0
  }
  to {
    opacity 1
  }
  duration 1ms
  easing linear
}`);
    expect(found).not.toContain('paced-fast');
  });

  it('does not report shared-transition descendants as accidental collisions', () => {
    const found = kinds(`canvas { duration 3s }
group outgoing {
  width 500
  height 300
}
overlay outgoing__panel {
  parent outgoing
  width 500
  height 300
}
group incoming {
  width 500
  height 300
}
overlay incoming__panel {
  parent incoming
  width 500
  height 300
}
transition swap {
  from outgoing
  to incoming
  at 1s
  duration 1s
}`);
    expect(found).not.toContain('collision');
  });

  it('does not report paired scene-transition descendants as accidental collisions', () => {
    const found = kinds(
      `scene outgoing {
  start 0s
  duration 1.8s
  transitionOut "sceneSlide(direction right duration .6s)"
}

overlay outgoingPanel {
  parent outgoing
  width 700
  height 420
  opacity 1
}

scene incoming {
  start 1.2s
  duration 1.8s
  transitionIn "sceneSlide(direction right duration .6s)"
}

overlay incomingPanel {
  parent incoming
  width 700
  height 420
  opacity 1
}`,
      3
    );
    expect(found).not.toContain('collision');
  });

  it('ignores structural group bounds when checking visible collisions', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 3s }
        group first { center width 600 height 400 x 0 y 0 }
        group second { center width 600 height 400 x 0 y 0 }
        overlay dot {
          parent first
          shape circle
          radius 24
          x -200
          opacity 1
        }
        overlay other {
          parent second
          shape circle
          radius 24
          x 200
          opacity 1
        }
      `)
    );
    expect(auditScene(scene).findings.map((finding) => finding.kind)).not.toContain('collision');
  });

  it('exposes the audit through the project inspector', () => {
    const report = inspectMotionProject(`canvas {
  size 1920x1080
  fps 60
  duration 4s
}

text hello {
  value "Hi"
  center
}`);
    expect(report.audit).toBeDefined();
    expect(report.audit.ok).toBe(true);
    for (const finding of report.audit.findings) {
      expect(MOTION_FINDING_KINDS).toContain(finding.kind);
      expect(finding.detail.length).toBeGreaterThan(12);
    }
  });

  it('is deterministic', () => {
    const body = `layout grid {
  type bentoGrid
  columns 3
}

component a {
  parent grid
  type button
}

component b {
  parent grid
  type notification
}

component c {
  parent grid
  type chart
}`;
    expect(audit(body).findings).toEqual(audit(body).findings);
  });
});
