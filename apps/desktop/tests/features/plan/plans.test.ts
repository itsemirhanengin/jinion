import { expect, test } from 'vitest';
import { planTab, planTitle } from '../../../src/renderer/features/plan/plans.js';

test('names a plan by its first heading, without a "Plan:" before it', () => {
  expect(planTitle('# Plan: Rate limiting for the API\n\nSteps')).toBe('Rate limiting for the API');
  expect(planTitle('Intro line\n\n## Steps')).toBe('Steps');
  expect(planTitle('Just a line')).toBe('Just a line');
  expect(planTitle('')).toBe('Plan');
});

test('reads the thread and the plan from a tab’s id', () => {
  expect(planTab('session_1|entry_7')).toEqual({ session: 'session_1', entry: 'entry_7' });
});
