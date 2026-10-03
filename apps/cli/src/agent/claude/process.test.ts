import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { claudeSays, FakeClaude } from '../../test/fake-claude.js';
import { ClaudeProcess } from './process.js';

function start(fake: FakeClaude) {
  const idle: SDKMessage[] = [];
  const onExit = vi.fn();
  const claude = new ClaudeProcess({ options: {}, cwd: '/project', spawn: fake.spawn, onIdle: (message) => idle.push(message), onExit });
  return { claude, idle, onExit };
}

const collect = async (turn: AsyncGenerator<SDKMessage>) => {
  const messages: SDKMessage[] = [];
  for await (const message of turn) messages.push(message);
  return messages;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('ClaudeProcess', () => {
  it('reads what comes while no turn runs as idle', async () => {
    const fake = new FakeClaude();
    const { idle } = start(fake);
    fake.reply(claudeSays.commands('user:design'));
    await settle();
    expect(idle.map((message) => message.type)).toEqual(['system']);
  });

  it('gives a turn what comes until the result that answers its prompt, and the rest to idle', async () => {
    const fake = new FakeClaude();
    const { claude, idle } = start(fake);
    const prompt = fake.nextPrompt();
    const turn = collect(claude.send('hello'));
    const { uuid, message } = await prompt;
    expect(message.content).toBe('hello');

    fake.reply(claudeSays.init(), claudeSays.text('Hi'), claudeSays.result('another prompt'), claudeSays.result(uuid!), claudeSays.commands('x'));
    expect((await turn).map((item) => item.type)).toEqual(['system', 'assistant', 'result', 'result']);
    await settle();
    expect(idle).toHaveLength(1);
  });

  it('keeps a turn open until the messages steered into it are answered too', async () => {
    const fake = new FakeClaude();
    const { claude, idle } = start(fake);
    const first = fake.nextPrompt();
    const turn = collect(claude.send('fix the tests'));
    const { uuid } = await first;
    const second = fake.nextPrompt();
    expect(claude.steer('keep the old API')).toBe(true);
    const steered = await second;
    expect(steered.priority).toBe('next');

    // Claude Code answered the first prompt before it read the second, so the second gets a turn of its own.
    fake.reply(claudeSays.text('Fixed'), claudeSays.result(uuid!), claudeSays.text('Kept it'), claudeSays.result(steered.uuid!));
    expect((await turn).map((item) => item.type)).toEqual(['assistant', 'result', 'assistant', 'result']);
    expect(idle).toEqual([]);
    expect(claude.steer('too late')).toBe(false);
  });

  it('ends an interrupted turn at its next result, whatever was steered into it', async () => {
    const fake = new FakeClaude();
    const { claude } = start(fake);
    const first = fake.nextPrompt();
    const turn = collect(claude.send('fix the tests'));
    const { uuid } = await first;
    claude.steer('and the docs');
    claude.interrupt();
    fake.reply(claudeSays.result(uuid!, 'interrupted'));
    expect(await turn).toHaveLength(1);
  });

  it('takes one prompt at a time', async () => {
    const fake = new FakeClaude();
    const { claude } = start(fake);
    const first = claude.send('first').next();
    await settle();
    await expect(claude.send('second').next()).rejects.toThrow('still answering');
    claude.close();
    await expect(first).rejects.toThrow('Claude Code exited');
  });

  it('fails the turn with what Claude Code printed when it exits, and every turn after', async () => {
    const fake = new FakeClaude();
    const { claude, onExit } = start(fake);
    const turn = collect(claude.send('hello'));
    await settle();
    fake.stderr('Error: not logged in\n');
    fake.exit();
    await expect(turn).rejects.toThrow('Claude Code exited:\nError: not logged in');
    expect(onExit).toHaveBeenCalledOnce();
    await expect(claude.send('again').next()).rejects.toThrow('Claude Code exited');
  });
});
