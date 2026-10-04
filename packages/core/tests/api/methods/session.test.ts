import { describe, expect, it, vi } from 'vitest';
import { ScriptedBackend } from '../../../src/agent/demo/agent.js';
import type { Scenario } from '../../../src/agent/demo/types.js';
import { serve } from '../../support/api.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

describe('session methods', () => {
  it('changes the model, and says so when the backend has no such mode', async () => {
    const { server, connect } = serve(box.project);
    const { client, session } = await connect();
    const { store } = server.app;
    const { atoms } = server.app.session;

    await client.request('session/model', { session, selection: { model: 'scripted-demo', effort: 'high' } });
    await client.request('session/mode', { session, mode: 'plan' });

    expect(store.get(atoms.selection)).toEqual({ model: 'scripted-demo', effort: 'high' });
    expect(store.get(atoms.mode)).toBe('edits');
    expect(store.get(atoms.entries).at(-1)).toMatchObject({ kind: 'notice', text: 'Demo has no Plan mode.', tone: 'warning' });
  });

  it('moves the conversation to a model of another backend, which gets it handed over with the next prompt', async () => {
    const prompts: string[] = [];

    const echo: Scenario = {
      title: 'Echo',
      async *play(script, prompt) {
        prompts.push(prompt);
        yield* script.say(`answered ${prompts.length}`);
      },
    };

    const { server, connect } = serve(box.project, { backends: [new ScriptedBackend([echo], [], 0), new ScriptedBackend([echo], [], 0, 'Other')] });
    const { client, session } = await connect();
    const { store } = server.app;
    const { atoms } = server.app.session;
    const idle = () => vi.waitFor(() => expect(store.get(atoms.working)).toBe(false));

    server.app.start();
    await client.follow(session);
    await client.request('session/submit', { session, text: '/model' });
    await vi.waitFor(() => expect(client.store.get(client.appAtom)?.models.Other).toHaveLength(1));
    await client.request('session/submit', { session, text: 'first question' });
    await idle();
    await client.request('session/model', { session, selection: { model: 'scripted-demo' }, agent: 'Other' });

    expect(server.app.session.backend.name).toBe('Other');
    expect(store.get(atoms.state)).toMatchObject({ agent: 'Other', handover: true });
    expect(store.get(atoms.entries).find((entry) => entry.kind === 'user')).not.toHaveProperty('promptId');

    expect(store.get(atoms.entries).at(-1)).toMatchObject({
      kind: 'notice',
      text: 'Switched to Scripted demo on Other. It reads the conversation so far with your next message.',
    });

    await client.request('session/submit', { session, text: 'second question' });
    await idle();

    expect(prompts[0]).toBe('first question');
    expect(prompts[1]).toContain('User: first question\n\nAgent: answered 1');
    expect(prompts[1]).toMatch(/\n\nsecond question$/);
    expect(store.get(atoms.state).handover).toBeUndefined();
    expect(client.store.get(client.session(session))?.fields.agent).toBe('Other');
    expect(client.store.get(client.session(session))?.state).toEqual(store.get(atoms.state));
  });

  it('says a model picked during a turn applies from the next message, on a backend that switches only between turns', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));

    const waiting: Scenario = {
      title: 'Wait',
      async *play(script) {
        await gate;
        yield* script.say('done');
      },
    };

    const { server, connect } = serve(box.project, { backends: [new ScriptedBackend([waiting], [], 0)] });
    const { client, session } = await connect();
    const { store } = server.app;
    const { atoms, agent } = server.app.session;
    const notices = () => store.get(atoms.entries).flatMap((entry) => (entry.kind === 'notice' ? [entry.text] : []));

    Object.assign(agent, { modelPerTurn: true });
    await client.request('session/submit', { session, text: 'go' });
    await client.request('session/model', { session, selection: { model: 'scripted-demo', effort: 'high' } });

    await vi.waitFor(() =>
      expect(notices()).toContain('Switched to scripted-demo · high. The running turn finishes on scripted-demo; your next message uses scripted-demo · high.'),
    );

    release();
    await vi.waitFor(() => expect(store.get(atoms.working)).toBe(false));
    await client.request('session/model', { session, selection: { model: 'scripted-demo' } });
    await vi.waitFor(() => expect(notices().at(-1)).toBe('Switched to scripted-demo.'));
  });

  it('turns worktrees on for new sessions and for this one while it hasn’t started', async () => {
    const { server, connect } = serve(box.project);
    const { client, session } = await connect();

    await client.request('session/worktree', { session, on: true });

    expect(client.store.get(client.appAtom)?.worktrees).toBe(true);
    expect(server.app.store.get(server.app.session.atoms.wantsWorktree)).toBe(true);
  });

  it('sends a queued message at once when nothing runs, and adds a line from the client', async () => {
    const { server, connect } = serve(box.project);
    const { client, session } = await connect();
    const { store } = server.app;
    const { atoms } = server.app.session;

    await client.request('session/notice', { session, text: 'There is no image on the clipboard.', tone: 'muted' });
    await client.request('session/queue', { session, text: 'hi' });

    expect(store.get(atoms.entries).map((entry) => entry.kind)).toEqual(['banner', 'notice', 'user']);
    await vi.waitFor(() => expect(store.get(atoms.working)).toBe(false));
  });

  it('opens the rewind on the client that asked, or says there is nothing to go back to', async () => {
    const { server, connect } = serve(box.project);
    const { client, screen, session } = await connect();
    const { store } = server.app;
    const { atoms } = server.app.session;

    await client.request('session/open-rewind', { session });

    expect(store.get(atoms.entries).at(-1)).toMatchObject({ kind: 'notice', text: 'There is nothing to rewind yet.' });

    await client.request('session/submit', { session, text: 'hi' });
    await vi.waitFor(() => expect(store.get(atoms.working)).toBe(false));
    await client.request('session/open-rewind', { session });

    await vi.waitFor(() => expect(screen.view).toHaveBeenCalledWith({ id: 'rewind', points: [expect.objectContaining({ text: 'hi' })] }));
    await expect(client.request('session/rewind-preview', { session, prompt: 'prompt_1' })).resolves.toBeNull();
  });

  it('reads what a task wrote by its id, and nothing for a task it doesn’t know', async () => {
    const { server, connect } = serve(box.project);
    const { client, session } = await connect();
    const { store } = server.app;
    const { atoms } = server.app.session;

    await client.request('session/submit', { session, text: 'start the dev server' });
    await vi.waitFor(() => expect(store.get(atoms.tasks).find((task) => task.output)).toBeDefined());

    const task = store.get(atoms.tasks).find((candidate) => candidate.output)!;

    await vi.waitFor(async () => expect(await client.request('session/task-output', { session, task: task.id })).not.toEqual([]));
    await expect(client.request('session/task-output', { session, task: 'gone' })).resolves.toBeNull();
    await client.request('session/stop-task', { session, task: task.id });
  });

  it('tells what fills the context', async () => {
    const { client, session } = await serve(box.project).connect();

    await expect(client.request('session/context', { session })).resolves.toMatchObject({ window: expect.any(Number) });
  });
});
