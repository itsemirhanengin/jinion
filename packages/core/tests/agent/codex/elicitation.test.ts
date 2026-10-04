import { describe, expect, it, vi } from 'vitest';
import type { RunContext } from '../../../src/agent/agent.js';
import { elicit } from '../../../src/agent/codex/elicitation.js';
import type { QuestionAnswer } from '../../../src/agent/questions.js';

function turn(answers: QuestionAnswer[] | Error, allow = true) {
  return {
    signal: new AbortController().signal,
    ask: vi.fn(async () => {
      if (answers instanceof Error) throw answers;

      return answers;
    }),
    approve: vi.fn(async () => (allow ? { allow: true as const } : { allow: false as const })),
    approvePlan: vi.fn(),
    asksBeforeCommits: () => true,
  } satisfies RunContext;
}

describe('MCP elicitations on Codex', () => {
  it('asks a form as a question a field, and answers with the values picked or typed', async () => {
    const context = turn([{ options: [1] }, { options: [0, 2] }, { options: [1] }, { options: [], text: '3' }, { options: [], text: 'main' }]);

    const answer = await elicit(
      {
        serverName: 'deploy',
        mode: 'form',
        message: 'Where should it go?',
        requestedSchema: {
          properties: {
            region: { type: 'string', title: 'Region', oneOf: [{ const: 'eu', title: 'Europe' }, { const: 'us', title: 'America' }] },
            targets: { type: 'array', title: 'Targets', items: { enum: ['web', 'api', 'worker'] } },
            dryRun: { type: 'boolean', title: 'Dry run' },
            replicas: { type: 'integer', title: 'Replicas' },
            branch: { type: 'string', title: 'Branch', description: 'Which branch to ship' },
          },
        },
      },
      context,
    );

    expect(context.ask).toHaveBeenCalledWith([
      { id: 'region', prompt: 'deploy: Where should it go?\n\nRegion', options: [{ label: 'Europe' }, { label: 'America' }], multiple: undefined, other: undefined },
      { id: 'targets', prompt: 'Targets', options: [{ label: 'web' }, { label: 'api' }, { label: 'worker' }], multiple: true, other: undefined },
      { id: 'dryRun', prompt: 'Dry run', options: [{ label: 'Yes' }, { label: 'No' }], multiple: undefined, other: undefined },
      { id: 'replicas', prompt: 'Replicas', options: [], multiple: undefined, other: true },
      { id: 'branch', prompt: 'Branch: Which branch to ship', options: [], multiple: undefined, other: true },
    ]);

    expect(answer).toEqual({ action: 'accept', content: { region: 'us', targets: ['web', 'worker'], dryRun: false, replicas: 3, branch: 'main' }, _meta: null });
  });

  it('cancels when the user dismisses the questions', async () => {
    expect(await elicit({ serverName: 'deploy', mode: 'form', message: 'Go?', requestedSchema: { properties: { go: { type: 'boolean' } } } }, turn(new Error('dismissed')))).toEqual({
      action: 'cancel',
      content: null,
      _meta: null,
    });
  });

  it('asks before a page the server wants opened, and declines what it doesn’t know or can’t ask', async () => {
    const context = turn([], false);
    const page = { serverName: 'figma', mode: 'url', message: 'Sign in to Figma', url: 'https://figma.com/auth' };

    expect(await elicit(page, context)).toEqual({ action: 'decline', content: null, _meta: null });
    expect(context.approve).toHaveBeenCalledWith({ title: 'figma wants you to open a page', subject: 'https://figma.com/auth', description: 'Sign in to Figma' });
    expect(await elicit(page, turn([]))).toEqual({ action: 'accept', content: null, _meta: null });
    expect(await elicit({ serverName: 'x', mode: 'openai/userVerification' }, turn([]))).toMatchObject({ action: 'decline' });
    expect(await elicit(page, undefined)).toMatchObject({ action: 'decline' });
  });
});
