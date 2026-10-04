import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../../src/agent/events.js';
import { editTurns } from '../../src/conversation/edits.js';
import type { Entry } from '../../src/conversation/entries.js';
import { type Action, reduce as reduceAt } from '../../src/conversation/reducer.js';
import { createSessionState, inRunningTurn, type SessionState } from '../../src/conversation/session.js';
import { conversationDigest, titleDue } from '../../src/conversation/titles.js';

const NOW = Date.UTC(2026, 9, 4, 12);

const reduce = (session: SessionState, action: Action) => reduceAt(session, action, NOW);

const events = (session: SessionState, ...list: AgentEvent[]) =>
  list.reduce((current, event) => reduce(current, { type: 'event', event }), session);

const kinds = (session: SessionState) => session.entries.map((entry) => (entry.kind === 'tool' ? `tool:${entry.status}` : entry.kind));

describe('reduce', () => {
  it('gives the same conversation each time it replays the same actions, as a client following one does', () => {
    const start = createSessionState(200_000);

    const actions: Action[] = [
      { type: 'submit', text: 'fix the build' },
      { type: 'event', event: { type: 'thinking', delta: 'hmm' } },
      { type: 'event', event: { type: 'text', delta: 'Fixed.' } },
      { type: 'notice', text: 'Saved.' },
      { type: 'finish', outcome: 'interrupted' },
    ];

    const replay = () => actions.reduce(reduce, structuredClone(start));

    expect(replay()).toEqual(replay());
    expect(replay().entries.map((entry) => entry.id)).toEqual(['banner', 'e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('starts a turn with the user’s text, titled after it', () => {
    const session = reduce(createSessionState(200_000), { type: 'submit', text: 'fix the build', prompt: 'fix the build\nfully' });

    expect(session.entries.at(-1)).toMatchObject({ kind: 'user', text: 'fix the build', prompt: 'fix the build\nfully' });
    expect(session.title).toBe('fix the build');
    expect(session.busySince).toBeTypeOf('number');
  });

  it('joins streamed text into one entry until something else comes in between', () => {
    const session = events(
      createSessionState(200_000),
      { type: 'text', delta: '  Hello' },
      { type: 'text', delta: ' there' },
      { type: 'thinking', delta: 'hmm' },
      { type: 'text', delta: 'Done' },
    );

    expect(session.entries.slice(-3).map((entry) => ('text' in entry ? entry.text : ''))).toEqual(['Hello there', 'hmm', 'Done']);
  });

  it('times thinking from its first text until something follows it, or until the turn ends', () => {
    const turn = reduce(createSessionState(200_000), { type: 'submit', text: 'go' });
    const thinking = events(turn, { type: 'thinking', delta: 'hmm' }, { type: 'thinking', delta: ' and more' });

    expect(thinking.entries.at(-1)).toMatchObject({ kind: 'thinking', text: 'hmm and more', startedAt: expect.any(Number) });
    expect(thinking.entries.at(-1)).not.toHaveProperty('endedAt');

    const followed = events(thinking, { type: 'tool-start', id: 't1', call: { name: 'bash', input: { command: 'ls', timeoutMs: 1000 } } });

    expect(followed.entries.at(-2)).toMatchObject({ kind: 'thinking', endedAt: expect.any(Number) });

    const ended = reduce(thinking, { type: 'finish', outcome: 'done' });

    expect(ended.entries.at(-1)).toMatchObject({ kind: 'thinking', endedAt: expect.any(Number) });
  });

  it('tells the entries of the turn still running from earlier ones, which fold', () => {
    const bash = (id: string): AgentEvent => ({ type: 'tool-start', id, call: { name: 'bash', input: { command: 'ls', timeoutMs: 1000 } } });
    const first = reduce(events(reduce(createSessionState(200_000), { type: 'submit', text: 'one' }), bash('t1')), { type: 'finish', outcome: 'done' });
    const earlier = first.entries.length - 1;

    expect(inRunningTurn(first, earlier)).toBe(false);

    const second = events(reduce(first, { type: 'submit', text: 'two' }), bash('t2'));

    expect(inRunningTurn(second, second.entries.length - 1)).toBe(true);
    expect(inRunningTurn(second, earlier)).toBe(false);
  });

  it('runs tools from start to end, with their output', () => {
    const session = events(
      createSessionState(200_000),
      { type: 'tool-start', id: 't1', call: { name: 'bash', input: { command: 'ls', timeoutMs: 1000 } } },
      { type: 'tool-output', id: 't1', lines: ['a.ts'] },
      { type: 'tool-end', id: 't1', ok: true, result: { exitCode: 0, wallMs: 5 } },
    );

    expect(session.entries.at(-1)).toMatchObject({ status: 'done', output: ['a.ts'], run: { result: { exitCode: 0 } } });
  });

  it('marks a call that waits for permission, and times it from when it was allowed', () => {
    const started = events(createSessionState(200_000), { type: 'tool-start', id: 't1', call: { name: 'bash', input: { command: 'rm a', timeoutMs: 1000 } } });
    const waiting = reduce(started, { type: 'approval', id: 't1', waiting: true });

    expect(waiting.entries.at(-1)).toMatchObject({ waiting: true });

    const allowed = reduce(waiting, { type: 'approval', id: 't1', waiting: false });

    expect(allowed.entries.at(-1)).not.toHaveProperty('waiting');
    expect(allowed.entries.at(-1)).toMatchObject({ approvedAt: expect.any(Number) });
  });

  it('marks the conversation compacting, then where it was compacted, or why it couldn’t be', () => {
    const running = events(createSessionState(200_000), { type: 'compaction', state: 'running' });

    expect(running.compacting).toBe(true);

    const done = events(running, { type: 'compaction', state: 'done', trigger: 'auto', before: 160_000, after: 20_000, summary: 'So far' });

    expect(done.compacting).toBeUndefined();
    expect(done.entries.at(-1)).toMatchObject({ kind: 'compaction', trigger: 'auto', before: 160_000, after: 20_000, summary: 'So far' });

    const failed = events(running, { type: 'compaction', state: 'failed', error: 'Not enough messages' });

    expect(failed.entries.at(-1)).toMatchObject({ kind: 'notice', tone: 'error', text: "Couldn't compact the conversation: Not enough messages" });
  });

  it('groups the agent’s edits by turn, newest first, with what joined a turn in it and only edits that went through', () => {
    const edit = (id: string, path: string, ok = true): AgentEvent[] => [
      { type: 'tool-start', id, call: { name: 'edit', input: { path, patch: '@@ -1 +1 @@\n-a\n+b' } } },
      { type: 'tool-end', id, ok, result: {} },
    ];

    let session = reduce(createSessionState(200_000), { type: 'submit', text: 'fix the build' });

    session = events(session, ...edit('e1', 'src/a.ts'), ...edit('e2', 'src/b.ts', false));
    session = reduce(session, { type: 'steer', text: 'and the docs', id: 's1' });
    session = events(session, ...edit('e3', 'README.md'));
    session = reduce(session, { type: 'submit', text: 'just explain it' });
    session = reduce(session, { type: 'submit', text: 'add a test' });

    session = events(
      session,
      { type: 'tool-start', id: 'agent', call: { name: 'agent', input: { description: 'Write the test' } } },
      { type: 'tool-start', id: 'e4', call: { name: 'edit', input: { path: 'src/a.test.ts', patch: '@@ -0,0 +1 @@\n+x', created: true } }, parent: 'agent' },
      { type: 'tool-end', id: 'e4', ok: true, result: {}, parent: 'agent' },
    );

    expect(editTurns(session.entries).map((turn) => [turn.prompt, turn.edits.map((change) => change.path)])).toEqual([
      ['add a test', ['src/a.test.ts']],
      ['fix the build', ['src/a.ts', 'README.md']],
    ]);
  });

  it('ends a turn that changed files with what it changed, counted per file, and one that changed none without', () => {
    const edit = (id: string, path: string, patch: string, created?: boolean): AgentEvent[] => [
      { type: 'tool-start', id, call: { name: 'edit', input: { path, patch, created } } },
      { type: 'tool-end', id, ok: true, result: {} },
    ];

    let session = reduce(createSessionState(200_000), { type: 'submit', text: 'add the limiter' });
    const prompt = session.entries.at(-1)!.id;

    session = events(
      session,
      ...edit('e1', 'src/limit.ts', '@@ -0,0 +1,2 @@\n+a\n+b', true),
      ...edit('e2', 'src/server.ts', '@@ -1 +1 @@\n-old\n+new'),
      ...edit('e3', 'src/limit.ts', '@@ -1 +1 @@\n-a\n+c'),
      { type: 'text', delta: 'Done.' },
    );

    session = reduce(session, { type: 'finish', outcome: 'done' });

    expect(session.entries.at(-1)).toMatchObject({
      kind: 'changes',
      turn: prompt,
      files: [
        { path: 'src/limit.ts', created: true, added: 3, removed: 1 },
        { path: 'src/server.ts', created: false, added: 1, removed: 1 },
      ],
    });

    session = reduce(reduce(session, { type: 'submit', text: 'explain it' }), { type: 'finish', outcome: 'done' });
    expect(session.entries.at(-1)!.kind).toBe('user');
  });

  it('replaces consecutive todo updates and keeps the list', () => {
    const todo = (text: string): AgentEvent => ({
      type: 'tool-start',
      id: text,
      call: { name: 'todo', input: { groups: [{ title: 'Tasks', items: [{ text, status: 'pending' }] }] } },
    });

    const session = events(createSessionState(200_000), todo('one'), todo('two'));

    expect(kinds(session).filter((kind) => kind.startsWith('tool'))).toHaveLength(1);
    expect(session.todos[0]!.items[0]!.text).toBe('two');
  });

  it('names the newest message the agent sent, and goes back to before a message with its task list', () => {
    const todo = (text: string): AgentEvent => ({
      type: 'tool-start',
      id: text,
      call: { name: 'todo', input: { groups: [{ title: 'Tasks', items: [{ text, status: 'pending' }] }] } },
    });

    let session = reduce(createSessionState(200_000), { type: 'submit', text: 'first' });

    session = events(session, { type: 'sent', id: 'p1' }, todo('one'));
    session = reduce(session, { type: 'submit', text: 'second' });
    session = events(session, { type: 'sent', id: 'p2' }, todo('two'));
    const [first, second] = session.entries.filter((entry) => entry.kind === 'user');

    expect([first, second].map((entry) => entry?.kind === 'user' && entry.promptId)).toEqual(['p1', 'p2']);

    session = reduce(session, { type: 'rewind', entry: second!.id });
    expect(session.entries.at(-1)).toMatchObject({ kind: 'tool', run: { name: 'todo' } });
    expect(session.todos[0]!.items[0]!.text).toBe('one');

    session = reduce(session, { type: 'rewind', entry: first!.id });
    expect(kinds(session)).toEqual(['banner']);
    expect(session.todos).toEqual([]);
  });

  it('keeps a subagent’s tool calls under its agent call, and cancels them with the turn', () => {
    let session = reduce(createSessionState(200_000), { type: 'submit', text: 'look around' });

    session = events(
      session,
      { type: 'tool-start', id: 'a1', call: { name: 'agent', input: { description: 'Map the code' } } },
      { type: 'tool-start', id: 'c1', call: { name: 'glob', input: { pattern: '*.ts' } }, parent: 'a1' },
      { type: 'tool-end', id: 'c1', ok: true, result: { files: ['a.ts'] }, parent: 'a1' },
      { type: 'tool-start', id: 'c2', call: { name: 'read', input: { files: [{ path: 'a.ts' }] } }, parent: 'a1' },
    );

    expect(kinds(session).slice(-1)).toEqual(['tool:running']);

    const agent = () => session.entries.at(-1) as Extract<Entry, { kind: 'tool' }>;

    expect(agent().children?.map((child) => `${child.run.name}:${child.status}`)).toEqual(['glob:done', 'read:running']);

    session = reduce(session, { type: 'finish', outcome: 'interrupted' });
    expect(session.entries.at(-2)).toMatchObject({ status: 'cancelled', children: [{ status: 'done' }, { status: 'cancelled' }] });
  });

  it('cancels tools still running when the turn ends, and says why it ended', () => {
    let session = reduce(createSessionState(200_000), { type: 'submit', text: 'go' });

    session = events(session, { type: 'tool-start', id: 't1', call: { name: 'glob', input: { pattern: '*' } } });
    session = reduce(session, { type: 'finish', outcome: 'interrupted' });
    expect(kinds(session).slice(-2)).toEqual(['tool:cancelled', 'notice']);
    expect(session.busySince).toBeUndefined();

    session = reduce(session, { type: 'finish', outcome: 'failed', message: 'Rate limited' });
    expect(session.entries.at(-1)).toMatchObject({ kind: 'notice', text: 'Rate limited', tone: 'error' });
  });
});

describe('titles', () => {
  const sent = (...prompts: string[]) =>
    prompts.reduce((session, text) => reduce(reduce(session, { type: 'submit', text }), { type: 'finish', outcome: 'done' }), createSessionState(200_000));

  const titled = (session: SessionState, by: 'agent' | 'user', title = 'Fix the build') =>
    reduce(session, { type: 'retitle', session: session.id, title, by, turns: session.entries.filter((entry) => entry.kind === 'user').length });

  it('names a conversation after its first message, again when its messages double or after a while, never over the user’s name', () => {
    expect(titleDue(createSessionState(200_000), NOW)).toBe(false);

    const first = sent('hello');

    expect(titleDue(first, NOW)).toBe(true);

    const named = titled(first, 'agent');

    expect(titleDue(named, NOW)).toBe(false);

    const second = reduce(reduce(named, { type: 'submit', text: 'fix the build' }), { type: 'finish', outcome: 'done' });

    expect(titleDue(second, NOW)).toBe(true);

    const atTwo = titled(second, 'agent');
    const third = reduce(atTwo, { type: 'submit', text: 'and the docs' });

    expect(titleDue(third, NOW)).toBe(false);
    expect(titleDue(third, NOW + 20 * 60_000)).toBe(true);
    expect(titleDue(atTwo, NOW + 20 * 60_000)).toBe(false);

    expect(titleDue(titled(first, 'user'), NOW + 60 * 60_000)).toBe(false);
  });

  it('takes a title only for the conversation it was asked for, keeping who gave it', () => {
    const session = sent('hello');

    expect(reduce(session, { type: 'retitle', session: 'another', title: 'Other', by: 'agent', turns: 1 })).toBe(session);

    const named = titled(session, 'user', 'Release prep');

    expect(named.title).toBe('Release prep');
    expect(named.titled).toMatchObject({ by: 'user', turns: 1 });
  });

  it('describes the conversation by its first and latest messages, the plan, the files changed and the last reply', () => {
    let session = sent('hello', ...Array.from({ length: 6 }, (_, index) => `step ${index + 1}`));

    session = events(
      session,
      { type: 'tool-start', id: 'p1', call: { name: 'plan', input: { plan: 'Add a limiter\nto the API' } } },
      { type: 'tool-end', id: 'p1', ok: true, result: {} },
      { type: 'tool-start', id: 'e1', call: { name: 'edit', input: { path: 'src/api.ts', patch: '@@ -1 +1 @@\n-a\n+b' } } },
      { type: 'tool-end', id: 'e1', ok: true, result: {} },
      { type: 'text', delta: 'Added   the limiter.' },
    );

    expect(conversationDigest(session.entries).split('\n')).toEqual([
      'First message: hello',
      'Later message: step 2',
      'Later message: step 3',
      'Later message: step 4',
      'Later message: step 5',
      'Later message: step 6',
      'Plan: Add a limiter to the API',
      'Files changed: src/api.ts',
      "Agent's latest reply: Added the limiter.",
    ]);
  });
});
