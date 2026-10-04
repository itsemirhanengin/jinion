import { appendFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { sandboxEach } from '../../support/sandbox.js';
import { readHistory } from '../../../src/agent/claude/history.js';

const box = sandboxEach();
let config: string;

beforeEach(() => {
  config = join(box.home, '.claude');
});

describe('readHistory', () => {
  it('counts each response once, though written a line per block, and a subagent’s work in its session', async () => {
    transcript('s1.jsonl', user(), response('m1', { blocks: ['thinking', 'text', 'tool_use', 'tool_use'] }), response('m2', { at: '2026-09-21T18:00:00' }));
    transcript('s1/subagents/agent-a.jsonl', response('m3', { model: 'claude-haiku-4-5-20251001', blocks: ['tool_use'] }));
    transcript('s2.jsonl', response('m4', { session: 's2', at: '2026-09-22T09:00:00' }), response('x', { model: '<synthetic>' }));

    const history = await readHistory(undefined, [config]);

    expect(history.days).toEqual([
      {
        date: '2026-09-21',
        messages: 3,
        sessions: 1,
        toolCalls: 3,
        models: {
          'Opus 5.5': { input: 200, output: 400, cacheRead: 2000, cacheWrite: 600 },
          'Haiku 4.5': { input: 100, output: 200, cacheRead: 1000, cacheWrite: 300 },
        },
      },
      { date: '2026-09-22', messages: 1, sessions: 1, toolCalls: 0, models: { 'Opus 5.5': { input: 100, output: 200, cacheRead: 1000, cacheWrite: 300 } } },
    ]);

    expect(history.sessions.find((session) => session.id === 's1')).toMatchObject({ end: new Date('2026-09-21T18:00:00').getTime() });
  });

  it('reads only what was added since, and keeps days whose transcripts Claude Code deleted', async () => {
    const path = transcript('s1.jsonl', response('m1', { blocks: ['text', 'tool_use'] }));
    let progress: [number, number] | undefined;

    await readHistory(undefined, [config]);
    // The second block of a response can come in a later read.
    appendFileSync(path, `${response('m1', { blocks: ['tool_use'] })}\n${response('m2')}\n`);

    const history = await readHistory((done, total) => (progress = [done, total]), [config]);

    expect(progress).toEqual([1, 1]);
    expect(history.days[0]).toMatchObject({ messages: 2, toolCalls: 2 });

    rmSync(path);
    expect((await readHistory(undefined, [config])).days[0]).toMatchObject({ date: '2026-09-21', messages: 2 });
  });

  it('reads a transcript that was rewritten from the start again', async () => {
    transcript('s1.jsonl', response('m1'), response('m2'), response('m3'));
    await readHistory(undefined, [config]);

    transcript('s1.jsonl', response('m9'));
    expect((await readHistory(undefined, [config])).days[0]).toMatchObject({ messages: 1 });
  });

  it('takes the days before the first transcript from Claude Code’s summary, scaled to the days both have', async () => {
    transcript('s1.jsonl', response('m1', { blocks: ['tool_use'] }));

    box.write(join(config, 'stats-cache.json'), {
      version: 5,
      dailyActivity: [
        { date: '2026-07-21', messageCount: 622, sessionCount: 5, toolCallCount: 208 },
        // It counts twice the responses, and four times the tool calls and tokens, the transcript has on this day.
        { date: '2026-09-21', messageCount: 2, sessionCount: 1, toolCallCount: 4 },
      ],
      dailyModelTokens: [
        { date: '2026-07-21', tokensByModel: { 'claude-opus-4-8': 8000 } },
        { date: '2026-09-21', tokensByModel: { 'claude-opus-5-5': 6400 } },
      ],
    });

    const history = await readHistory(undefined, [config]);

    expect(history.days.map((day) => `${day.date} ${day.messages} ${day.toolCalls} ${day.sessions}`)).toEqual([
      '2026-07-21 311 52 5',
      '2026-09-21 1 1 1',
    ]);

    expect(history.days[0]!.models).toEqual({ 'Opus 4.8': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, summarized: 2000 } });
  });

  it('reads transcripts linked from several logins once', async () => {
    const account = join(box.home, '.jinion', 'accounts', 'claude', 'work');

    transcript('s1.jsonl', response('m1'));
    mkdirSync(account, { recursive: true });
    symlinkSync(join(config, 'projects'), join(account, 'projects'));

    expect((await readHistory(undefined, [config, account])).days[0]).toMatchObject({ messages: 1 });
  });
});

/** A response as Claude Code writes it: a line per content block, each with the whole response's usage. */
function response(id: string, { session = 's1', at = '2026-09-21T10:00:00', model = 'claude-opus-5-5', blocks = ['text'], tokens = 100 } = {}) {
  const usage = { input_tokens: tokens, output_tokens: tokens * 2, cache_read_input_tokens: tokens * 10, cache_creation_input_tokens: tokens * 3 };

  return blocks
    .map((type) =>
      JSON.stringify({
        type: 'assistant',
        sessionId: session,
        timestamp: new Date(at).toISOString(),
        message: { id, model, usage, content: [{ type }] },
      }),
    )
    .join('\n');
}

const transcript = (name: string, ...lines: string[]) => box.write(join(config, 'projects', '-work-api', name), `${lines.join('\n')}\n`);
const user = (at = '2026-09-21T10:00:00') => JSON.stringify({ type: 'user', sessionId: 's1', timestamp: new Date(at).toISOString(), message: { content: 'hi' } });
