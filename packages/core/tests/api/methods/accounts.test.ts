import { describe, expect, it, vi } from 'vitest';
import type { AgentAccounts } from '../../../src/agent/accounts.js';
import { ScriptedBackend } from '../../../src/agent/demo/agent.js';
import { scenarios } from '../../../src/agent/demo/scenarios/index.js';
import { serve } from '../../support/api.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

/** Signs in after showing a link and asking for the code from the browser, which must be `1234`. */
function accounts(): AgentAccounts {
  return {
    current: 'Claude',
    active: async () => ({ name: 'Claude', signedIn: true }),
    list: async () => [{ name: 'Claude', signedIn: true }],
    use: async () => {},
    remove: async () => {},
    signIn: (name, { onLink, onPrompt }) =>
      new Promise((resolve) => {
        onLink('https://claude.ai/oauth');

        const ask = (problem?: string) =>
          onPrompt('Paste the code', (code) => (code === '1234' ? resolve({ name, signedIn: true, email: 'me@jinion.co' }) : ask("That code didn't work.")), problem);

        ask();
      }),
  };
}

describe('account methods', () => {
  it('signs in through the client that asked: the link and what to type go to it, its answers come back', async () => {
    const backend = Object.assign(new ScriptedBackend(scenarios, [], 0), { accounts: accounts() });
    const { client } = await serve(box.project, { backends: [backend] }).connect();
    const link = vi.fn();
    const prompts = vi.fn();

    client.on('accounts/sign-in-link', link);
    client.on('accounts/sign-in-prompt', prompts);

    const signing = client.request('accounts/sign-in', { name: 'Work' });

    await vi.waitFor(() => expect(prompts).toHaveBeenCalledTimes(1));
    await client.request('accounts/sign-in-answer', { name: 'Work', text: '0000' });
    await vi.waitFor(() => expect(prompts).toHaveBeenLastCalledWith({ name: 'Work', prompt: 'Paste the code', problem: "That code didn't work." }));
    await client.request('accounts/sign-in-answer', { name: 'Work', text: '1234' });

    await expect(signing).resolves.toEqual({ signedIn: true });
    expect(link).toHaveBeenCalledWith({ name: 'Work', url: 'https://claude.ai/oauth' });
  });

  it('stops signing in when the client cancels', async () => {
    const backend = Object.assign(new ScriptedBackend(scenarios, [], 0), { accounts: accounts() });
    const { client } = await serve(box.project, { backends: [backend] }).connect();
    const prompts = vi.fn();

    backend.accounts.signIn = (_, { signal, onPrompt }) =>
      new Promise((_, reject) => {
        onPrompt('Paste the code', () => {});
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    client.on('accounts/sign-in-prompt', prompts);

    const signing = client.request('accounts/sign-in', { name: 'Work' });

    await vi.waitFor(() => expect(prompts).toHaveBeenCalled());
    await client.request('accounts/sign-in-cancel', { name: 'Work' });

    await expect(signing).resolves.toEqual({ signedIn: false });
  });
});
