/**
 * Motion doctrine, as a prompt contract.
 *
 * The catalog tells the model what exists; this tells it what is correct. It
 * names the specific failure modes of machine-made motion and states the timing
 * budget as numbers, because "be subtle" is not actionable and "≤ 0.8s" is.
 *
 * Every number here is the same constant the engine and the inspector use, so
 * the prompt cannot drift from the implementation.
 */

import { MOTION_BUDGET, STILLNESS_BEFORE_CLIMAX } from './budget';
import { ARRIVAL } from './layout';
import { BEAT_ROUTES } from './beats';

export function doctrinePrompt(): string {
  return [
    'MOTION DOCTRINE — these rules override general animation advice. The engine enforces several of them and the inspector reports the rest.',
    '',
    'Arrivals:',
    '- Reveal binary: opacity snaps to full in the first frame and the movement carries the entrance. Never fade an arrival in; a fade fights the snap of its own motion.',
    '- Never an .inOut curve on an entrance. Default power4.out, or expo.out for a punchier front.',
    '- Bouncy overshoot (back.out, elastic.out, spring.bouncy) is the most recognizable tell of machine-made motion. Use it only for a deliberately playful register, never for product or enterprise work.',
    `- One entrance is at most ${MOTION_BUDGET.maxEntry}s. A longer buildup is a staggered group, never one slow element.`,
    '',
    'Cascades — a group entrance is a wave, not a queue:',
    `- Gaps shrink across the group (about ${ARRIVAL.gapDecay} of the previous gap) so it accelerates and the last item snaps. Equal gaps read as a roll call.`,
    `- Velocity varies by weight: the focal subject travels ${ARRIVAL.focal.travel}px over ${ARRIVAL.focal.duration}s, support travels ${ARRIVAL.support.travel}px over ${ARRIVAL.support.duration}s. Identical travel and duration across a group is why generated motion looks generated.`,
    `- The whole cascade lands inside ${ARRIVAL.maxStaggerWindow}s regardless of item count. Layouts do this for you; match it when hand-authoring.`,
    '',
    'Sustained motion — every beat is owned by one route:',
    `- Routes: ${BEAT_ROUTES.join(', ')}. Declare it with route NAME on the beat.`,
    '- Idle drift (float, breathe, glow pulse) is NOT sustained motion. It reads as the video waiting. A beat with time left after its entrance needs more story, not wobble.',
    `- Nothing may sit still for more than ${MOTION_BUDGET.maxDeadZone}s. Pause anywhere in a beat and something meaningful must be mid-flight.`,
    `- Schedule ${STILLNESS_BEFORE_CLIMAX.min}-${STILLNESS_BEFORE_CLIMAX.max}s of stillness between a major action and its result.`,
    '- If a beat is deliberately still, say so with route hold.',
    '',
    'Continuity:',
    '- Transform, never fade, between shots: sharedElement, objectMorph, layoutMorph, cameraMove, or continuous.',
    '- Pick one dominant direction per film. Changing direction needs a visible cause — a click, an impact, a chapter boundary. Consecutive shots in opposing directions read as an error.',
    '- Pair transitionOut with the matching transitionIn on the next shot, same treatment and direction.',
    '- Cause and effect fire on the same frame, never "shortly after". Large elements rebound slower than small ones.',
    '',
    'Budget:',
    `- Exits run about 75% of their entrance. Moves longer than ${MOTION_BUDGET.maxMove}s read as drift; shorter than ${MOTION_BUDGET.minMove}s do not register.`,
    '- Default arrival curve power4.out; default settle curve power3.out.',
    '',
    'Never:',
    '- fade an arrival, space a cascade evenly, or give every element the same entrance',
    '- use idle float to fill remaining time',
    '- fade or wipe between shots',
    '- flip direction without a cause',
    '- draw decorative shapes in place of a real product asset',
    '- hand-place coordinates where a layout fits',
  ].join('\n');
}
