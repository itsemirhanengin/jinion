import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeSays, FakeClaude, settle } from '../../support/fake-claude.js';
import { sandboxEach } from '../../support/sandbox.js';
import type { AgentPrompt, RunContext } from '../../../src/agent/agent.js';
import type { AgentEvent } from '../../../src/agent/events.js';
import { McpConfig } from '../../../src/mcp/config.js';
import { ClaudeBackend } from '../../../src/agent/claude/backend.js';
import type { ClaudeSession } from '../../../src/agent/claude/session.js';

const box = sandboxEach();
let fake: FakeClaude;
let backend: ClaudeBackend;
let agent: ClaudeSession;
let transcript: string[];

beforeEach(() => {
  fake = new FakeClaude();
  transcript = [];

  backend = new ClaudeBackend({
    cwd: box.project,
    spawn: fake.spawn,
    sessionMessages: (async () => transcript.map((uuid) => ({ uuid }))) as never,
    mcp: new McpConfig(box.project),
  });

  agent = backend.session({ selection: { model: 'haiku' } });
});

afterEach(() => backend.close());

describe('ClaudeBackend', () => {
  it('asks what sessions share through one that runs, gives each conversation a process of its own, and restarts them all for new MCP servers', async () => {
    await turn('hello', (uuid) => [claudeSays.init('session-1'), claudeSays.result(uuid)]);

    const other = backend.session({ resume: { sessionId: 'session-2', cost: 0 } });

    await backend.commands();
    expect(fake.processes).toHaveLength(1);

    const received = fake.nextPrompt();

    const running = (async () => {
      for await (const _ of other.run({ text: 'in the other one' }, context()));
    })();

    const sent = await received;

    fake.reply(claudeSays.result(sent.uuid!));
    await running;
    expect(fake.processes.map((spawned) => spawned.options.resume)).toEqual([undefined, 'session-2']);

    await backend.mcp!.setEnabled({ 'claude.ai Gmail': false });
    await turn('again', (uuid) => [claudeSays.result(uuid)]);
    expect(fake.current.options.resume).toBe('session-1');
    expect(fake.processes).toHaveLength(3);
  });
});

describe('ClaudeSession', () => {
  it('tells subscribers what comes between turns, and runs mentions by the new commands', async () => {
    const heard: AgentEvent[] = [];

    agent.subscribe((event) => heard.push(event));
    await backend.commands();

    fake.reply(claudeSays.commands('user:design', 'vercel:nextjs'));
    await settle();
    expect(heard).toEqual([{ type: 'commands', commands: [expect.objectContaining({ name: 'design' }), expect.objectContaining({ name: 'nextjs' })] }]);

    const { sent } = await turn('$design the login page', (uuid) => [claudeSays.result(uuid)]);

    expect(sent.message.content).toBe('/user:design the login page');
  });

  it('maps a turn, and fails it when Claude Code reports an error', async () => {
    const { events } = await turn('hello', (uuid) => [claudeSays.init(), claudeSays.text('Hi there'), claudeSays.result(uuid)]);

    expect(events).toContainEqual({ type: 'text', delta: 'Hi there' });
    await expect(turn('again', (uuid) => [claudeSays.result(uuid, 'Rate limited')])).rejects.toThrow('Rate limited');
  });

  it('sends images after the text, which keeps a skill at the start working', async () => {
    const image = { mediaType: 'image/png', data: 'aGk=' };
    const { sent } = await turn({ text: 'what is wrong in [Image #1]?', images: [image] }, (uuid) => [claudeSays.result(uuid)]);

    expect(sent.message.content).toEqual([
      { type: 'text', text: 'what is wrong in [Image #1]?' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGk=' } },
    ]);
  });

  it('steers messages into a turn in progress, and only then', async () => {
    expect(agent.steer({ text: 'too early' })).toBeUndefined();

    const first = fake.nextPrompt();
    const events: AgentEvent[] = [];

    const running = (async () => {
      for await (const event of agent.run({ text: 'fix the tests' }, context())) events.push(event);
    })();

    const { uuid } = await first;
    const second = fake.nextPrompt();
    const id = agent.steer({ text: 'also the docs' });
    const steered = await second;

    expect(steered).toMatchObject({ uuid: id, priority: 'next', message: { content: 'also the docs' } });

    fake.reply(claudeSays.text('Both done'), { ...claudeSays.result(uuid!), user_message_uuids: [uuid!, steered.uuid!] } as never);
    await running;

    expect(events).toContainEqual({ type: 'text', delta: 'Both done' });
  });

  it('names each prompt with the id Claude Code knows it by', async () => {
    const { events, sent } = await turn('hello', (uuid) => [claudeSays.result(uuid)]);

    expect(events[0]).toEqual({ type: 'sent', id: sent.uuid });
  });

  it('restores files from Claude Code’s checkpoints and previews what would change', async () => {
    const { sent } = await turn('add a function', (uuid) => [claudeSays.init(), claudeSays.result(uuid)]);

    expect(await agent.rewindPreview(sent.uuid!)).toEqual({ files: ['/project/a.ts'], insertions: 2, deletions: 1 });

    await agent.rewind(sent.uuid!, { code: true, conversation: false });
    expect(fake.rewound).toEqual([sent.uuid]);
    expect(fake.processes).toHaveLength(1);
  });

  it('takes the conversation back to the transcript entry before a prompt, or starts over before the first', async () => {
    const first = await turn('one', (uuid) => [claudeSays.init('session-3'), claudeSays.result(uuid)]);
    const second = await turn('two', (uuid) => [claudeSays.result(uuid)]);

    transcript = [first.sent.uuid!, 'answer-1', second.sent.uuid!, 'answer-2'];
    await agent.rewind(second.sent.uuid!, { code: false, conversation: true });
    await turn('two, again', (uuid) => [claudeSays.result(uuid)]);
    expect(fake.current.options).toMatchObject({ resume: 'session-3', resumeSessionAt: 'answer-1' });

    transcript = [first.sent.uuid!];
    await agent.rewind(first.sent.uuid!, { code: false, conversation: true });
    await turn('fresh', (uuid) => [claudeSays.result(uuid)]);
    expect(fake.current.options.resume).toBeUndefined();
  });

  it('keeps the conversation it resumed when it restarts before its first turn', async () => {
    agent.close();
    agent = backend.session({ resume: { sessionId: 'session-9', cost: 0 } });
    await backend.commands();

    await backend.mcp!.setEnabled({ 'claude.ai Gmail': false });
    await backend.commands();

    expect(fake.processes.map((spawned) => spawned.options.resume)).toEqual(['session-9', 'session-9']);
  });

  it('carries on in the folder it moved to, through restarts, while the next conversation starts in the project', async () => {
    const worktree = join(box.home, 'worktree');

    await backend.commands();
    agent.moveTo(worktree);
    await turn('hello', (uuid) => [claudeSays.init('session-4'), claudeSays.result(uuid)]);
    fake.exit();
    await settle();
    await turn('still there?', (uuid) => [claudeSays.result(uuid)]);

    expect(fake.processes.map((spawned) => spawned.options.cwd)).toEqual([box.project, worktree, worktree]);
    expect(fake.current.options.resume).toBe('session-4');
    expect(fake.current.options.systemPrompt).toMatchObject({ prompt: expect.stringContaining(`Working directory: ${worktree}`) });

    agent.close();
    agent = backend.session();
    await turn('new one', (uuid) => [claudeSays.result(uuid)]);

    expect(fake.current.options.cwd).toBe(box.project);
  });

  it('continues the conversation in a new process after Claude Code exits on its own', async () => {
    await turn('hello', (uuid) => [claudeSays.init('session-7'), claudeSays.result(uuid)]);

    fake.exit();
    await settle();
    await turn('still there?', (uuid) => [claudeSays.result(uuid)]);

    expect(fake.processes).toHaveLength(2);
    expect(fake.current.options.resume).toBe('session-7');
  });

  it('follows a background task to its end and the turn Claude Code starts to look at it, and stops tasks', async () => {
    const heard: AgentEvent[] = [];

    agent.subscribe((event) => heard.push(event));
    await turn('start the server', (uuid) => [claudeSays.taskStarted('b1', 'toolu_1', 'Start the server'), claudeSays.result(uuid)]);
    expect(fake.current.options).toMatchObject({ perTaskStopAffordance: true });
    expect(fake.current.options.env?.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS).toBeUndefined();

    fake.reply(claudeSays.taskEnded('b1', 'failed', 'exit code 1'), claudeSays.init(), claudeSays.text('The server crashed.'), claudeSays.ownResult());
    await settle();
    expect(heard.map((event) => event.type)).toEqual(['tasks', 'task-end', 'turn-start']);

    const events: AgentEvent[] = [];

    for await (const event of agent.join(context())) events.push(event);
    expect(events).toContainEqual({ type: 'text', delta: 'The server crashed.' });

    await agent.stopTask('b1');
    expect(fake.stopped).toEqual(['b1']);
  });

  it('marks running background tasks stopped when their process ends', async () => {
    const heard: AgentEvent[] = [];

    agent.subscribe((event) => heard.push(event));
    await turn('start the server', (uuid) => [claudeSays.taskStarted('b1', 'toolu_1', 'Start the server'), claudeSays.result(uuid)]);

    agent.close();
    expect(heard.at(-1)).toMatchObject({ type: 'tasks', tasks: [{ id: 'b1', status: 'stopped' }] });
  });
});

const context = (): RunContext => ({
  signal: new AbortController().signal,
  ask: async () => [],
  approve: async () => ({ allow: true }),
  approvePlan: async () => ({ approve: false }),
});

async function turn(prompt: string | AgentPrompt, reply: (uuid: string) => Parameters<FakeClaude['reply']>) {
  const received = fake.nextPrompt();
  const events: AgentEvent[] = [];

  const running = (async () => {
    for await (const event of agent.run(typeof prompt === 'string' ? { text: prompt } : prompt, context())) events.push(event);
  })();

  const sent = await received;

  fake.reply(...reply(sent.uuid!));
  await running;

  return { events, sent };
}
