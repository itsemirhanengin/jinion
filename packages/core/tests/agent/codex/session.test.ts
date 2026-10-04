import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AgentMode, RunContext } from '../../../src/agent/agent.js';
import { CodexBackend } from '../../../src/agent/codex/backend.js';
import type { AgentEvent } from '../../../src/agent/events.js';
import { MemoryStore } from '../../../src/memory/store.js';
import { FakeCodex, type FakeCodexOptions } from '../../support/fake-codex.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

function setup(fixture: string, { mode = 'edits', fake: options, resume }: { mode?: AgentMode; fake?: FakeCodexOptions; resume?: string } = {}) {
  const fake = new FakeCodex(fixture, options);
  const memory = new MemoryStore(box.project);
  const backend = new CodexBackend({ cwd: box.project, version: '1.2.3', memory, start: fake.start });
  const session = backend.session({ selection: { model: 'gpt-5.5', effort: 'low' }, mode, resume: resume ? { sessionId: resume, cost: 0 } : undefined });

  return { fake, memory, backend, session };
}

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    signal: new AbortController().signal,
    ask: vi.fn(async () => []),
    approve: vi.fn(async () => ({ allow: true as const })),
    approvePlan: vi.fn(async () => ({ approve: true as const, mode: 'edits' as const })),
    asksBeforeCommits: () => true,
    ...overrides,
  };
}

async function collect(events: AsyncIterable<AgentEvent>) {
  const all: AgentEvent[] = [];

  for await (const event of events) all.push(event);

  return all;
}

describe('CodexSession', () => {
  it('starts a thread on the first prompt, in the mode’s sandbox, with Jinion’s instructions and note tools', async () => {
    const { fake, session } = setup('memory');

    const events = await collect(session.run({ text: 'Save a note' }, context()));

    expect(events.slice(0, 2)).toEqual([
      { type: 'session', id: fake.thread },
      { type: 'sent', id: expect.any(String) },
    ]);

    const [start] = fake.sent('thread/start');

    expect(start?.params).toMatchObject({
      cwd: box.project,
      model: 'gpt-5.5',
      sandbox: 'workspace-write',
      developerInstructions: expect.stringContaining('# Memory'),
      dynamicTools: [{ type: 'namespace', name: 'jinion', tools: expect.arrayContaining([expect.objectContaining({ name: 'remember' })]) }],
    });

    expect(fake.sent('turn/start')[0]?.params).toMatchObject({
      threadId: fake.thread,
      input: [{ type: 'text', text: 'Save a note' }],
      model: 'gpt-5.5',
      effort: 'low',
      summary: 'auto',
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      sandboxPolicy: { type: 'workspaceWrite', networkAccess: true },
      collaborationMode: { mode: 'default' },
    });
  });

  it('runs Jinion’s note tools for Codex and answers with what they return', async () => {
    const { fake, memory, session } = setup('memory');

    await collect(session.run({ text: 'Save a note' }, context()));

    const calls = fake.received.filter((message) => message.method === undefined);

    expect(memory.list().map((note) => `${note.scope}/${note.id}`)).toEqual(['project/project-notes-location']);

    expect(calls.map((answer) => answer.result)).toEqual([
      { contentItems: [{ type: 'inputText', text: 'Saved project/project-notes-location.' }], success: true },
      { contentItems: [{ type: 'inputText', text: expect.stringContaining('project/project-notes-location') }], success: true },
    ]);
  });

  it('asks the user before an edit in manual mode, which writes nowhere unasked', async () => {
    const approve = vi.fn(async () => ({ allow: true as const, always: true }));
    const { fake, session } = setup('tools', { mode: 'manual' });

    await collect(session.run({ text: 'Change it' }, context({ approve })));

    expect(fake.sent('turn/start')[0]?.params).toMatchObject({ sandboxPolicy: { type: 'readOnly', networkAccess: true } });

    expect(approve).toHaveBeenCalledWith(
      { title: 'jinion wants to change a file', subject: `/project/notes.txt`, always: 'edits in this conversation' },
      // The edit on screen, so it shows as waiting.
      expect.stringMatching(/#0$/),
    );

    expect([...fake.answers.values()]).toContainEqual({ decision: 'acceptForSession' });
  });

  it('interrupts the turn when Jinion’s is, and ends with the abort', async () => {
    const { fake, session } = setup('interrupt', { fake: { holdUntilInterrupt: true } });
    const abort = new AbortController();
    const running = collect(session.run({ text: 'Sleep' }, context({ signal: abort.signal })));

    await vi.waitFor(() => expect(fake.sent('turn/start')).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    abort.abort();

    await expect(running).rejects.toThrow('aborted');
    expect(fake.sent('turn/interrupt')[0]?.params).toEqual({ threadId: fake.thread, turnId: expect.any(String) });
  });

  it('asks to approve a plan once its turn ends, then carries it out in the chosen mode within the same run', async () => {
    const approvePlan = vi.fn(async () => ({ approve: true as const, mode: 'auto' as const }));
    const { fake, session } = setup('plan', { mode: 'plan' });

    const events = await collect(session.run({ text: 'Plan it' }, context({ approvePlan })));

    expect(approvePlan).toHaveBeenCalledWith(['auto', 'edits', 'manual']);
    expect(events).toContainEqual({ type: 'mode', mode: 'auto' });
    expect(session.mode).toBe('auto');

    const [planned, implemented] = fake.sent('turn/start');

    expect(planned?.params.collaborationMode).toMatchObject({ mode: 'plan' });

    expect(implemented?.params).toMatchObject({
      input: [{ type: 'text', text: 'Implement the plan.' }],
      collaborationMode: { mode: 'default' },
      approvalsReviewer: 'auto_review',
    });

    expect(events.filter((event) => event.type === 'sent')).toHaveLength(2);
  });

  it('compacts as a turn of its own, marked as asked for', async () => {
    const { fake, session } = setup('compact');

    await collect(session.run({ text: 'Hello' }, context()));
    const events = await collect(session.compact(undefined, context()));

    expect(fake.sent('thread/compact/start')[0]?.params).toEqual({ threadId: fake.thread });
    expect(events).toContainEqual(expect.objectContaining({ type: 'compaction', state: 'done', trigger: 'manual' }));
    expect((await session.context()).used).toBeLessThan(10_000);
  });

  it('fails a turn when Codex stops, and carries the thread on in a new app-server', async () => {
    const { fake, session } = setup('interrupt', { fake: { holdUntilInterrupt: true } });
    const running = collect(session.run({ text: 'Sleep' }, context()));

    await vi.waitFor(() => expect(fake.sent('turn/start')).toHaveLength(1));
    fake.crash();

    await expect(running).rejects.toThrow('Codex stopped (exit code 1): it crashed.');

    void collect(session.run({ text: 'Again' }, context())).catch(() => {});
    await vi.waitFor(() => expect(fake.sent('thread/resume')).toHaveLength(1));
    expect(fake.sent('thread/resume')[0]?.params).toMatchObject({ threadId: fake.thread, excludeTurns: true });
  });

  it('rewinds from Codex’s history: the files from its patches, the conversation through thread/revert', async () => {
    const notes = join(box.project, 'notes.txt');
    const change = { path: notes, kind: { type: 'update', move_path: null }, diff: '@@ -1,2 +1,2 @@\n hello\n-world\n+there\n' };
    const history = [{ id: 'turn-1', status: 'completed', error: null, items: [{ type: 'fileChange', id: 'patch', status: 'completed', changes: [change] }] }];
    const { fake, session } = setup('compact', { fake: { history } });

    box.write(notes, 'hello\nthere\n');

    expect(await session.rewindPreview('turn-1')).toEqual({ files: [notes], insertions: 1, deletions: 1 });
    await session.rewind('turn-1', { code: true, conversation: true });

    expect(readFileSync(notes, 'utf8')).toBe('hello\nworld\n');
    expect(fake.sent('thread/start')[0]?.params).toMatchObject({ historyMode: 'paginated' });
    expect(fake.sent('thread/revert')[0]?.params).toEqual({ threadId: fake.thread, beforeTurnId: 'turn-1' });
  });

  it('names a conversation in a thread that isn’t kept, told only to name it', async () => {
    const { fake, backend } = setup('title');

    expect(await backend.titleFor('First message: fix the flaky login test in auth.test.ts')).toBe('Fix flaky auth.test.ts login test');

    expect(fake.sent('thread/start')[0]?.params).toMatchObject({
      model: 'gpt-6-luna',
      ephemeral: true,
      baseInstructions: expect.stringContaining('You name conversations'),
      sandbox: 'read-only',
    });

    expect(fake.sent('turn/start')[0]?.params.input[0].text).toBe('The conversation:\nFirst message: fix the flaky login test in auth.test.ts');
  });

  it('carries on a saved thread', async () => {
    const { fake, session } = setup('compact', { resume: 'saved-thread' });

    await collect(session.run({ text: 'Hello' }, context()));

    expect(fake.sent('thread/start')).toHaveLength(0);
    expect(fake.sent('thread/resume')[0]?.params).toMatchObject({ threadId: 'saved-thread' });
  });

  it('steers a running turn, and has nothing to steer between turns', async () => {
    const { fake, session } = setup('interrupt', { fake: { holdUntilInterrupt: true } });
    const abort = new AbortController();
    const running = collect(session.run({ text: 'Sleep' }, context({ signal: abort.signal }))).catch(() => {});

    expect(session.steer({ text: 'too early' })).toBeUndefined();
    await vi.waitFor(() => expect(fake.sent('turn/start')).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(session.steer({ text: 'and say ok twice' })).toEqual(expect.any(String));
    await vi.waitFor(() => expect(fake.sent('turn/steer')).toHaveLength(1));

    expect(fake.sent('turn/steer')[0]?.params).toMatchObject({
      threadId: fake.thread,
      input: [{ type: 'text', text: 'and say ok twice' }],
      expectedTurnId: expect.any(String),
    });

    abort.abort();
    await running;
  });
});
