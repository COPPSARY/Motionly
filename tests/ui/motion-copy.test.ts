import { describe, expect, it } from 'vitest';
import { parseMotion } from '../../src/language/parser';
import { copyMotion, pasteMotion } from '../../src/ui/motion-copy';

describe('motion copy and paste', () => {
  it('rebases transform motion relatively and supports absolute paste', () => {
    const program = parseMotion(`overlay source { x 100 scale 2 }
overlay target { x 500 scale 1 }
animate source {
  from { x 50 scale 1 }
  to { x 200 scale 4 }
}`);
    const clipboard = copyMotion(program, 'source')!;
    pasteMotion(program, clipboard, 'target');
    const relative = program.body.find(
      (node) => node.type === 'Animation' && node.target === 'target'
    );
    expect(relative && relative.type === 'Animation' ? relative.from?.['x'] : null).toBe(450);
    expect(relative && relative.type === 'Animation' ? relative.to?.['scale'] : null).toBe(2);
    pasteMotion(program, clipboard, 'target', 'absolute');
    const absolute = program.body.find(
      (node) => node.type === 'Animation' && node.target === 'target'
    );
    expect(absolute && absolute.type === 'Animation' ? absolute.to?.['x'] : null).toBe('200');
  });
});
