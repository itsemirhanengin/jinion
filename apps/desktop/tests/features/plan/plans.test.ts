import { expect, test } from 'vitest';
import { planReach, planTab, planTitle } from '../../../src/renderer/features/plan/plans.js';

test('names a plan by its first heading, without a "Plan:" before it', () => {
  expect(planTitle('# Plan: Rate limiting for the API\n\nSteps')).toBe('Rate limiting for the API');
  expect(planTitle('Intro line\n\n## Steps')).toBe('Steps');
  expect(planTitle('Just a line')).toBe('Just a line');
  expect(planTitle('')).toBe('Plan');
});

test('says what a plan reaches from its steps, its files and its diagrams', () => {
  const plan = [
    '# Plan',
    '```mermaid',
    'flowchart LR',
    '  a --> b',
    '```',
    '## Steps',
    '1. Add it',
    '2. Use it',
    '```ts',
    '1. not a step',
    '```',
    '## Files',
    '- [ ] `src/a.ts`, new',
    '- [ ] `src/b.ts`',
    '## Risks',
    '- not a file',
  ].join('\n');

  expect(planReach(plan)).toBe('2 steps · 2 files · a diagram');
  expect(planReach('# Plan\n\nJust words.')).toBe('');
});

test('reads the thread and the plan from a tab’s id', () => {
  expect(planTab('session_1|entry_7')).toEqual({ session: 'session_1', entry: 'entry_7' });
});
