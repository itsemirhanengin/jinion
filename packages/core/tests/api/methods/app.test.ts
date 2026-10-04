import { describe, expect, it } from 'vitest';
import { ApiCode } from '../../../src/api/protocol.js';
import { serve } from '../../support/api.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

describe('app methods', () => {
  it('tells a client on initialize what the backend can do and which commands there are, once', async () => {
    const { client, initialized } = await serve(box.project).connect();
    const { agent, commands } = initialized;

    await expect(client.initialize()).rejects.toMatchObject({ message: 'The client is already initialized.' });

    expect(agent).toEqual({
      name: 'Demo',
      modes: ['edits'],
      features: { accounts: false, mcp: false, usage: true, history: true, steer: false, rewind: true, context: true, background: false, compact: true },
    });

    expect(commands).toContainEqual(expect.objectContaining({ name: 'clear', description: expect.any(String) }));
    expect(commands.every((command) => !('run' in command))).toBe(true);
  });

  it('lists saved conversations as summaries rather than whole', async () => {
    const { connect, saved } = serve(box.project);
    const { client } = await connect();
    const [first] = saved.list();

    const summaries = await client.request('saved/list', {});

    expect(summaries).toHaveLength(saved.list().length);
    expect(summaries[0]).toEqual({ id: first!.id, title: first!.title, updatedAt: first!.updatedAt, messages: expect.any(Number), worktree: undefined });
    expect(summaries[0]).not.toHaveProperty('entries');
  });

  it('lists memory notes with where they are, and forgets one, saying so in the conversation', async () => {
    const { server, memory, connect } = serve(box.project);
    const { client } = await connect();
    const note = memory.save({ scope: 'project', title: 'Use pnpm', description: 'Not npm', type: 'preference', content: 'Use pnpm.' });

    await expect(client.request('memory/list', {})).resolves.toEqual([{ ...note, path: memory.path(note) }]);
    await client.request('memory/forget', { scope: 'project', id: note.id });

    expect(memory.list()).toEqual([]);
    expect(server.app.store.get(server.app.session.atoms.entries).at(-1)).toMatchObject({ kind: 'notice', text: expect.stringContaining('Use pnpm') });
  });

  it('refuses what the backend can’t do with an error that says so', async () => {
    const { client } = await serve(box.project).connect();

    await expect(client.request('mcp/servers', {})).rejects.toMatchObject({ code: ApiCode.unsupported, message: "Demo can't list MCP servers." });
    await expect(client.request('usage/limits', { drivers: false })).resolves.toMatchObject({ session: { cost: expect.any(Number) } });
  });
});
