import type { Options, query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { claudeTitle, cleanTitle } from './title.js';

function answering(reply: Partial<SDKMessage>) {
  const asked: { prompt?: string; options?: Options; closed: boolean } = { closed: false };
  const spawn = (({ prompt, options }) => {
    Object.assign(asked, { prompt, options });
    return {
      async *[Symbol.asyncIterator]() {
        yield { type: 'system', subtype: 'init' };
        yield reply;
      },
      close: () => {
        asked.closed = true;
      },
    };
  }) as typeof query;
  return { asked, spawn };
}

describe('claudeTitle', () => {
  it('asks the small model without tools, thinking or a saved transcript, under the account in use', async () => {
    const { asked, spawn } = answering({ type: 'result', subtype: 'success', result: '"Add rate limiting to the API."\n' } as never);
    const title = await claudeTitle({ digest: 'First message: hello', current: 'Say hello', cwd: '/project', account: 'default', spawn });
    expect(title).toBe('Add rate limiting to the API');
    expect(asked.prompt).toBe('Current title: Say hello\n\nThe conversation:\nFirst message: hello');
    expect(asked.options).toMatchObject({
      cwd: '/project',
      model: 'haiku',
      tools: [],
      maxTurns: 1,
      thinking: { type: 'disabled' },
      persistSession: false,
      settingSources: [],
    });
    expect(asked.closed).toBe(true);
  });

  it('has no title when the request fails', async () => {
    const { spawn } = answering({ type: 'result', subtype: 'error_during_execution' } as never);
    expect(await claudeTitle({ digest: 'First message: hello', cwd: '/project', account: 'default', spawn })).toBeUndefined();
  });
});

describe('cleanTitle', () => {
  it('keeps the first line, without a label, quotes or a closing period', () => {
    expect(cleanTitle('Title: `Fix the flaky login test`.\nBecause…')).toBe('Fix the flaky login test');
    expect(cleanTitle('  \n')).toBeUndefined();
    expect(cleanTitle('a'.repeat(100))).toHaveLength(80);
  });

  it('has no title when the model explained itself instead', () => {
    expect(cleanTitle('This is a greeting with no work yet, so I will name it after the greeting itself')).toBeUndefined();
  });
});
