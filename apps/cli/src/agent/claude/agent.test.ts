import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeSays, FakeClaude } from '../../test/fake-claude.js';
import { sandbox, type Sandbox } from '../../test/sandbox.js';
import type { AgentEvent, RunContext } from '../types.js';
import { ClaudeAgent } from './agent.js';

let box: Sandbox;
let fake: FakeClaude;
let agent: ClaudeAgent;

beforeEach(() => {
  box = sandbox();
  fake = new FakeClaude();
  agent = new ClaudeAgent({ cwd: box.project, selection: { model: 'haiku' }, spawn: fake.spawn });
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
async function turn(prompt: string, reply: (uuid: string) => Parameters<FakeClaude['reply']>) {
  const received = fake.nextPrompt();
  const events: AgentEvent[] = [];
  const running = (async () => {
    for await (const event of agent.run(prompt, context())) events.push(event);
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

  it('steers messages into a turn in progress, and only then', async () => {
    expect(agent.steer('too early')).toBe(false);
    const first = fake.nextPrompt();
    const events: AgentEvent[] = [];
    const running = (async () => {
      for await (const event of agent.run('fix the tests', context())) events.push(event);
    })();
    const { uuid } = await first;
    const second = fake.nextPrompt();
    expect(agent.steer('also the docs')).toBe(true);
    const steered = await second;
    expect(steered).toMatchObject({ priority: 'next', message: { content: 'also the docs' } });
    fake.reply(claudeSays.text('Both done'), { ...claudeSays.result(uuid!), user_message_uuids: [uuid!, steered.uuid!] } as never);
    await running;
    expect(events).toContainEqual({ type: 'text', delta: 'Both done' });
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
