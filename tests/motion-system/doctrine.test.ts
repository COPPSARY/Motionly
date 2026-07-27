import { describe, expect, it } from 'vitest';
import { doctrinePrompt } from '../../src/motion-system/doctrine';
import { ARRIVAL } from '../../src/motion-system/layout';
import { BEAT_ROUTES } from '../../src/motion-system/beats';
import { MOTION_BUDGET, STILLNESS_BEFORE_CLIMAX } from '../../src/motion-system/budget';

describe('motion doctrine prompt', () => {
  const prompt = doctrinePrompt();

  it('states that it overrides general animation advice', () => {
    expect(prompt).toContain('override general animation advice');
  });

  it('names the specific failure modes rather than asking for restraint', () => {
    for (const phrase of [
      'Never fade an arrival',
      'Bouncy overshoot',
      'NOT sustained motion',
      'wave, not a queue',
      'Equal gaps',
      'same frame',
    ]) {
      expect(prompt, phrase).toContain(phrase);
    }
  });

  it('quotes the same numbers the engine enforces', () => {
    expect(prompt).toContain(`${MOTION_BUDGET.maxEntry}s`);
    expect(prompt).toContain(`${MOTION_BUDGET.maxDeadZone}s`);
    expect(prompt).toContain(`${MOTION_BUDGET.maxMove}s`);
    expect(prompt).toContain(`${ARRIVAL.maxStaggerWindow}s`);
    expect(prompt).toContain(`${ARRIVAL.focal.travel}px`);
    expect(prompt).toContain(`${ARRIVAL.support.duration}s`);
    expect(prompt).toContain(`${ARRIVAL.gapDecay}`);
    expect(prompt).toContain(`${STILLNESS_BEFORE_CLIMAX.min}-${STILLNESS_BEFORE_CLIMAX.max}s`);
  });

  it('lists every sustained-motion route', () => {
    for (const route of BEAT_ROUTES) expect(prompt, route).toContain(route);
  });

  it('is deterministic', () => {
    expect(doctrinePrompt()).toBe(prompt);
  });
});
