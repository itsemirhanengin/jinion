import { describe, expect, it } from 'vitest';
import type { BackgroundTask } from '@jinion/core/agent/tasks';
import { activity } from '../../src/app/activity.js';
import { createSession } from '@jinion/core/conversation/session';

describe('activity', () => {
  it('names the command that runs, and offers ctrl+b once it is listed as a task', () => {
    const session = createSession(200_000);
    const command = 'pnpm test --run --reporter verbose && pnpm build && pnpm lint --max-diagnostics 200';

    session.entries.push({
      id: 'bash',
      kind: 'tool',
      run: { name: 'bash', input: { command, timeoutMs: 120_000 } },
      status: 'running',
      output: [],
      startedAt: 0,
    });

    const task: BackgroundTask = { id: 'task', kind: 'shell', title: command, status: 'running', startedAt: 0, foreground: true };

    expect(activity(session, undefined, [])).toBe('Running pnpm test --run --reporter verbose && pnpm build && pnpm li…');

    expect(activity(session, undefined, [task])).toBe(
      'Running pnpm test --run --reporter verbose && pnpm build && pnpm li… · ctrl+b to run it in the background',
    );
  });
});
