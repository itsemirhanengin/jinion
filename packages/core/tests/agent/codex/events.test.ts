import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CodexEvents } from '../../../src/agent/codex/events.js';
import type { Notification } from '../../../src/agent/codex/protocol.js';
import type { AgentEvent } from '../../../src/agent/events.js';
import { started, transcript } from '../../support/transcript.js';

/** Real conversations recorded with `--debug` and made fixtures with `pnpm codex-fixture`; `/project` stands in for the folder. */
describe('CodexEvents replaying recorded conversations', () => {
  for (const name of ['tools', 'plan', 'compact', 'interrupt', 'memory']) {
    it(`maps the ${name} conversation as before`, () => {
      expect(transcript(replay(name).events)).toMatchSnapshot();
    });
  }

  it('shows Codex’s reads as reads, its patch as an edit per file, and a command with what it printed', () => {
    const { events } = replay('tools');
    const calls = started(events);
    const edit = calls.find((call) => call.name === 'edit');
    const command = calls.find((call) => call.name === 'bash' && call.input.command.startsWith('printf'));
    const id = events.find((event) => event.type === 'tool-start' && event.call === command)!;

    expect(calls.map((call) => call.name)).toEqual(expect.arrayContaining(['read', 'edit', 'bash']));
    expect(edit?.input).toEqual({ path: '/project/notes.txt', patch: '@@ -1,2 +1,2 @@\n hello\n-world\n+there' });
    expect(command?.input).toEqual({ command: "printf 'a\\nb\\n' && wc -l notes.txt" });

    expect(events.filter((event) => 'id' in event && event.id === (id as { id: string }).id && event.type !== 'tool-start')).toMatchObject([
      { type: 'tool-output', lines: ['a', 'b', '       2 notes.txt'] },
      { type: 'tool-end', ok: true, result: { exitCode: 0 } },
    ]);
  });

  it('keeps the plan written in plan mode for the user to approve', () => {
    const { events, codex } = replay('plan');
    const plan = started(events).find((call) => call.name === 'plan');

    expect(plan?.input.plan).toMatch(/^# /);
    expect(codex.plan).toBe(plan?.input.plan);
  });

  it('marks a compaction with how full the context was before and after, and whether Jinion asked for it', () => {
    const { events } = replay('compact', { compacting: true });

    expect(events.filter((event) => event.type === 'compaction')).toEqual([
      { type: 'compaction', state: 'running' },
      { type: 'compaction', state: 'done', trigger: 'manual', before: expect.any(Number), after: expect.any(Number) },
    ]);

    const done = events.find((event) => event.type === 'compaction' && event.state === 'done') as { before: number; after: number };

    expect(done.after).toBeLessThan(done.before);
  });

  it('shows Jinion’s note tools as memory calls, worded as Claude’s', () => {
    const calls = started(replay('memory').events);

    expect(calls.filter((call) => call.name === 'memory').map((call) => call.input)).toEqual([
      { action: 'remember', detail: expect.stringMatching(/^project · /) },
      { action: 'recall', detail: 'every note' },
    ]);
  });

  it('shows a command’s output a whole line at a time', () => {
    const codex = new CodexEvents(() => 'thread');
    const item = { type: 'commandExecution', id: 'c1', command: "/bin/zsh -lc 'npm test'", cwd: '/project', status: 'inProgress', commandActions: [], aggregatedOutput: null, exitCode: null, durationMs: null };
    const delta = (text: string) => codex.map(note('item/commandExecution/outputDelta', { itemId: 'c1', delta: text }));

    codex.map(note('item/started', { item }));

    expect(delta('one\ntw')).toEqual([{ type: 'tool-output', id: 'c1', lines: ['one'] }]);
    expect(delta('o\nthree')).toEqual([{ type: 'tool-output', id: 'c1', lines: ['two'] }]);

    expect(codex.map(note('item/completed', { item: { ...item, status: 'completed', exitCode: 2, durationMs: 40 } }))).toEqual([
      { type: 'tool-output', id: 'c1', lines: ['three'] },
      { type: 'tool-end', id: 'c1', ok: false, result: { exitCode: 2, wallMs: 40 } },
    ]);
  });

  it('shows the plan Codex keeps as a task list that replaces the one before', () => {
    const codex = new CodexEvents(() => 'thread');

    const events = codex.map(
      note('turn/plan/updated', {
        turnId: 'turn',
        explanation: null,
        plan: [
          { step: 'Read the code', status: 'completed' },
          { step: 'Fix the bug', status: 'inProgress' },
        ],
      }),
    );

    expect(events).toEqual([
      {
        type: 'tool-start',
        id: 'todo-turn-1',
        call: {
          name: 'todo',
          input: {
            groups: [
              {
                title: 'Plan',
                items: [
                  { text: 'Read the code', status: 'done' },
                  { text: 'Fix the bug', status: 'active' },
                ],
              },
            ],
          },
        },
      },
      { type: 'tool-end', id: 'todo-turn-1', ok: true },
    ]);
  });

  it('shows a subagent’s calls under the call that started it, and none of its messages', () => {
    const codex = new CodexEvents(() => 'thread');
    const spawn = { type: 'collabAgentToolCall', id: 'spawn', tool: 'spawnAgent', status: 'inProgress', receiverThreadIds: ['child'], prompt: 'Find the tests' };
    const read = { type: 'commandExecution', id: 'r1', command: 'cat a.ts', cwd: '/project', status: 'inProgress', commandActions: [{ type: 'read', command: 'cat a.ts', name: 'a.ts', path: '/project/a.ts' }], aggregatedOutput: null, exitCode: null, durationMs: null };

    expect(codex.map(note('item/started', { item: spawn }))).toEqual([
      { type: 'tool-start', id: 'spawn', call: { name: 'agent', input: { description: 'Find the tests' } } },
    ]);

    expect(codex.owns('child')).toBe(true);

    expect(codex.map(note('item/started', { item: read }, 'child'))).toEqual([
      { type: 'tool-start', id: 'r1', call: { name: 'read', input: { files: [{ path: '/project/a.ts' }] } }, parent: 'spawn' },
    ]);

    expect(codex.map(note('item/agentMessage/delta', { itemId: 'm1', delta: 'Found them.' }, 'child'))).toEqual([]);
    expect(codex.map(note('thread/tokenUsage/updated', { tokenUsage: { last: { totalTokens: 9 }, modelContextWindow: 1 } }, 'child'))).toEqual([]);
  });

  it('starts a message that follows another as a paragraph of its own', () => {
    const codex = new CodexEvents(() => 'thread');
    const text = (itemId: string, delta: string) => codex.map(note('item/agentMessage/delta', { itemId, delta }));

    expect([...text('m1', 'Looking.'), ...text('m1', ' Now.'), ...text('m2', 'Done.')]).toEqual([
      { type: 'text', delta: 'Looking.' },
      { type: 'text', delta: ' Now.' },
      { type: 'text', delta: '\n\nDone.' },
    ]);
  });
});

function replay(name: string, { compacting = false } = {}) {
  const messages = readFileSync(join(import.meta.dirname, 'fixtures', `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Notification & { id?: number });

  const thread = messages.find((message) => 'threadId' in message.params)?.params as { threadId: string };
  const codex = new CodexEvents(() => thread.threadId);

  codex.compacting = compacting;

  // Requests Codex made of Jinion come with an id; they become events once answered, through the items they are about.
  const events: AgentEvent[] = messages.filter((message) => message.id === undefined).flatMap((message) => codex.map(message));

  return { events, codex };
}

const note = (method: string, params: object, threadId = 'thread') => ({ method, params: { threadId, turnId: 'turn', ...params } }) as Notification;
