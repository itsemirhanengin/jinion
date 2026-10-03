import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeSays, FakeClaude } from '../../test/fake-claude.js';
import { sandbox, type Sandbox } from '../../test/sandbox.js';
import type { AgentEvent, AgentPrompt, RunContext } from '../types.js';
import { McpConfig } from '../../mcp/config.js';
import { ClaudeAgent } from './agent.js';

let box: Sandbox;
let fake: FakeClaude;
let agent: ClaudeAgent;
/** Claude Code's transcript of the conversation, as rewinding reads it. */
let transcript: string[];

beforeEach(() => {
  box = sandbox();
  fake = new FakeClaude();
  transcript = [];
  agent = new ClaudeAgent({
    cwd: box.project,
    selection: { model: 'haiku' },
    spawn: fake.spawn,
    sessionMessages: (async () => transcript.map((uuid) => ({ uuid }))) as never,
    mcp: new McpConfig(box.project),
  });
});

afterEach(() => {
  agent.close();
  box.restore();
});

const context = (): RunContext => ({
  signal: new AbortController().signal,
  ask: async () => [],
  approve: async () => ({ allow: true }),
  approvePlan: async () => ({ approve: false }),
});

/** Runs a prompt, answering it with `reply` once Claude Code receives it. */
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('ClaudeAgent', () => {
  it('tells subscribers what comes between turns, and runs mentions by the new commands', async () => {
    const heard: AgentEvent[] = [];
    agent.subscribe((event) => heard.push(event));
    await agent.commands();
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
    agent.reset({ sessionId: 'session-9', cost: 0 });
    await agent.commands();
    await agent.mcp!.setEnabled({ 'claude.ai Gmail': false });
    await agent.commands();
    expect(fake.processes.map((spawned) => spawned.options.resume)).toEqual(['session-9', 'session-9']);
  });

  it('continues the conversation in a new process after Claude Code exits on its own', async () => {
    await turn('hello', (uuid) => [claudeSays.init('session-7'), claudeSays.result(uuid)]);
    fake.exit();
    await settle();
    await turn('still there?', (uuid) => [claudeSays.result(uuid)]);
    expect(fake.processes).toHaveLength(2);
    expect(fake.current.options.resume).toBe('session-7');
  });
});
