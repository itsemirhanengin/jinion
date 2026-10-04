import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import { ClaudeEvents } from '../../../src/agent/claude/events.js';
import { started, transcript } from '../../support/transcript.js';

/** Real conversations recorded with `--debug` and made fixtures with `pnpm fixture`; `/project` and `/home/user` stand in for real folders. */
beforeAll(() => {
  process.env.HOME = '/home/user';
  process.env.JINION_HOME = '/home/user/.jinion';
});

describe('ClaudeEvents replaying recorded conversations', () => {
  for (const name of ['tools', 'plan', 'skills', 'interrupt', 'subagent', 'background', 'compact']) {
    it(`maps the ${name} conversation as before`, () => {
      expect(transcript(replay(name))).toMatchSnapshot();
    });
  }

  it('shows tasks, reads, edits with real line numbers, commands and answers', () => {
    const events = replay('tools');
    const calls = started(events);
    const todos = calls.filter((call) => call.name === 'todo').at(-1);
    const edits = events.flatMap((event) => (event.type === 'tool-end' && event.result && 'patch' in event.result ? [event.result.patch] : []));
    const answer = events.find((event) => event.type === 'tool-end' && event.result && 'answers' in event.result);

    expect(todos!.input.groups[0]!.items.map((item) => item.status)).toEqual(['done', 'done']);
    expect(calls.map((call) => call.name)).toEqual(expect.arrayContaining(['read', 'edit', 'bash', 'ask']));
    expect(edits[0]).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(answer).toMatchObject({ result: { answers: [{ options: [0] }] } });
  });

  it('shows the plan from Claude Code’s plan file, without showing the file being written', () => {
    const calls = started(replay('plan'));
    const plan = calls.find((call) => call.name === 'plan');

    expect(plan?.input.plan).toMatch(/^# Plan/);
    expect(calls.some((call) => call.name === 'edit' && call.input.path.includes('/.claude/plans/'))).toBe(false);
  });

  it('names skills, tool loading and MCP tools the way the user reads them', () => {
    const events = replay('skills');
    const calls = started(events);
    const titles = calls.flatMap((call) => (call.name === 'other' ? [`${call.input.title}: ${call.input.detail}`] : []));
    const mcp = calls.find((call) => call.name === 'mcp');

    expect(titles).toEqual(expect.arrayContaining(['Skill: explain-math', 'Load tools: context7:resolve-library-id']));
    expect(mcp?.input).toEqual({ server: 'context7', tool: 'resolve-library-id', arguments: 'libraryName: "React", query: "React library overview"' });
    expect(events.find((event) => event.type === 'tool-output')).toMatchObject({ lines: expect.arrayContaining(['Available Libraries:']) });
  });

  it('shows what a fetch received, and the answer it read from the page', () => {
    const events = call('WebFetch', { url: 'https://example.com', prompt: 'What is the title?' }, 'The title is "Example Domain".', {
      bytes: 1256,
      code: 200,
      codeText: 'OK',
      result: 'The title is "Example Domain".\n',
      durationMs: 812,
      url: 'https://example.com',
    });

    expect(transcript(events)).toEqual([
      'start t1 fetch {"url":"https://example.com","prompt":"What is the title?"}',
      'output t1 ["The title is \\"Example Domain\\"."]',
      'end t1 ok {"bytes":1256,"code":200,"codeText":"OK"}',
    ]);
  });

  it('shows why a fetch failed', () => {
    const events = call('WebFetch', { url: 'https://example.com/missing', prompt: 'p' }, 'Request failed with status code 404', undefined, true);

    expect(transcript(events).slice(1)).toEqual(['output t1 ["Request failed with status code 404"]', 'end t1 failed {}']);
  });

  it('lists a web search’s hits across its searches, without the model’s remarks between them', () => {
    const hit = (title: string) => ({ title, url: `https://${title.toLowerCase()}.dev/guide` });

    const events = call('WebSearch', { query: 'vitest snapshots' }, 'Web search results for query: "vitest snapshots"', {
      query: 'vitest snapshots',
      results: [{ tool_use_id: 'srvtoolu_1', content: [hit('Vitest'), hit('Jest')] }, 'Here is what I found.', { tool_use_id: 'srvtoolu_2', content: [hit('Vite')] }],
      durationSeconds: 3.2,
      searchCount: 2,
    });

    expect(events.find((event) => event.type === 'tool-end')).toMatchObject({
      result: { hits: [hit('Vitest'), hit('Jest'), hit('Vite')], searches: 2, durationMs: 3200 },
    });
  });

  it('puts a subagent’s tool calls under its agent call, without its text', () => {
    const events = replay('subagent');
    const agent = events.find((event) => event.type === 'tool-start' && event.call.name === 'agent');
    const children = events.filter((event) => (event.type === 'tool-start' || event.type === 'tool-end') && event.parent);

    expect(agent).toMatchObject({ call: { input: { kind: 'general-purpose' } } });
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((event) => 'parent' in event && event.parent === (agent as { id: string }).id)).toBe(true);
    expect(events.some((event) => event.type === 'tool-output')).toBe(false);
  });

  it('follows background tasks from start to end: commands, one that fails, one stopped, a subagent and ctrl+b', () => {
    const events = replay('background');
    const lists = events.flatMap((event) => (event.type === 'tasks' ? [event.tasks] : []));

    expect(lists.at(-1)!.map(({ kind, title, status }) => `${kind} ${status} ${title}`)).toEqual([
      'shell completed for i in 1 2 3; do echo tick $i; sleep 1; done',
      'shell failed sleep 2; echo boom >&2; exit 3',
      'shell stopped sleep 120',
      'agent completed List files in current directory',
      'shell completed sleep 10; echo slept',
    ]);

    const running = lists.flatMap((tasks) => tasks.filter((task) => task.kind === 'shell' && task.status === 'running' && !task.foreground));

    for (const title of new Set(running.map((task) => task.title))) {
      expect(running.find((task) => task.title === title && task.output)?.output, title).toMatch(/\/tasks\/\w+\.output$/);
    }

    // The foreground command shows once ctrl+b sent it to the background, not while it ran where it started.
    expect(lists.some((tasks) => tasks.some((task) => task.title.startsWith('sleep 10') && task.status === 'running'))).toBe(true);

    const ends = events.flatMap((event) => (event.type === 'tool-end' && !event.parent ? [event.result] : []));
    const summaries = events.flatMap((event) => (event.type === 'task-end' ? [`${event.task.status}: ${event.summary}`] : []));

    expect(ends.filter((result) => result && 'background' in result)).toHaveLength(5);
    expect(summaries).toContain('failed: Background command "sleep 2; echo boom >&2; exit 3" failed with exit code 3');
  });

  it('follows /compact from running to its summary, and takes the context down to what is left', () => {
    const events = replay('compact');
    const compaction = events.filter((event) => event.type === 'compaction');
    const after = events.slice(events.indexOf(compaction[1]!));

    expect(compaction.map((event) => event.state)).toEqual(['running', 'done']);
    expect(compaction[1]).toMatchObject({ trigger: 'manual', before: 23669, after: 7440, summary: expect.stringMatching(/^1\. Primary Request and Intent:/) });
    expect(after.find((event) => event.type === 'usage')).toMatchObject({ usage: { contextTokens: 7440 } });
    // Claude Code's echo of the command isn't taken for anything.
    expect(events.some((event) => event.type === 'text' && event.delta.includes('Compacted'))).toBe(false);
  });

  it('keeps waiting for a compaction’s summary past bookkeeping that comes in between', () => {
    const events = new ClaudeEvents('/project');

    const messages = [
      { type: 'system', subtype: 'compact_boundary', compact_metadata: { trigger: 'auto', pre_tokens: 160_000, post_tokens: 20_000 } },
      { type: 'command_lifecycle', command_uuid: 'c1', state: 'completed' },
      { type: 'system', subtype: 'status', status: null },
      {
        type: 'user',
        parent_tool_use_id: null,
        message: {
          role: 'user',
          content:
            'This session is being continued from a previous conversation.\n\nSummary:\nWhat was done.\n\nIf you need specific details from before compaction, read the transcript.\nContinue the conversation from where it left off.',
        },
      },
    ] as unknown as SDKMessage[];

    const done = messages.flatMap((message) => [...events.map(message)]).find((event) => event.type === 'compaction');

    expect(done).toMatchObject({ state: 'done', trigger: 'auto', before: 160_000, after: 20_000, summary: 'What was done.' });
  });

  it('ends an interrupted turn without a result of its own and carries on with the next', () => {
    const lines = transcript(replay('interrupt'));

    expect(lines.filter((line) => line === 'session')).toHaveLength(2);
    expect(lines.filter((line) => line.startsWith('text: ')).at(-1)).toMatch(/OK/);
  });
});

function replay(name: string) {
  const events = new ClaudeEvents('/project');

  return readFileSync(join(import.meta.dirname, 'fixtures', `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => [...events.map(JSON.parse(line) as SDKMessage)]);
}

function call(name: string, input: object, output: string, data?: object, error = false) {
  const events = new ClaudeEvents('/project');

  const messages = [
    { type: 'assistant', parent_tool_use_id: null, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name, input }] } },
    {
      type: 'user',
      parent_tool_use_id: null,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: output, is_error: error }] },
      tool_use_result: data,
    },
  ] as unknown as SDKMessage[];

  return messages.flatMap((message) => [...events.map(message)]);
}
