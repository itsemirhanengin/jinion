import { describe, expect, it, vi } from 'vitest';
import { ApiCode } from '../../../src/api/protocol.js';
import { serve } from '../../support/api.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

describe('sessions methods', () => {
  it('replaces a session with a saved conversation, as /resume does, and with a new one, as /clear does', async () => {
    const { server, saved, connect } = serve(box.project);
    const { client, session } = await connect();
    const [resumed] = saved.list();

    await client.request('sessions/replace', { session, resume: resumed!.id });

    expect(server.app.sessions.map((open) => open.id)).toEqual([resumed!.id]);
    expect(server.app.session.id).toBe(resumed!.id);

    await client.request('sessions/replace', { session: resumed!.id });

    expect(server.app.sessions).toHaveLength(1);
    expect(server.app.session.id).not.toBe(resumed!.id);
  });

  it('opens a saved conversation beside the one shown and shows it, and brings back the tab that has it open', async () => {
    const { server, saved, connect } = serve(box.project);
    const { client, session: first } = await connect();
    const [resumed] = saved.list();

    await client.request('sessions/open', { resume: resumed!.id, activate: true });

    expect(server.app.sessions.map((open) => open.id)).toEqual([first, resumed!.id]);
    expect(server.app.session.id).toBe(resumed!.id);

    await client.request('sessions/activate', { session: first });
    await client.request('sessions/open', { resume: resumed!.id, activate: true });

    expect(server.app.sessions).toHaveLength(2);
    expect(server.app.session.id).toBe(resumed!.id);
  });

  it('opens a tab with /tab and closes the one shown with /close, leaving a new conversation after the last', async () => {
    const { server, connect } = serve(box.project);
    const { client, session: first } = await connect();

    await client.request('session/submit', { session: first, text: '/tab' });

    const second = server.app.session.id;

    expect(server.app.sessions.map((open) => open.id)).toEqual([first, second]);

    await client.request('session/submit', { session: second, text: '/close' });
    await vi.waitFor(() => expect(server.app.sessions.map((open) => open.id)).toEqual([first]));
    expect(server.app.session.id).toBe(first);

    await client.request('session/submit', { session: first, text: '/close' });
    await vi.waitFor(() => expect(server.app.sessions).toHaveLength(1));
    expect(server.app.session.id).not.toBe(first);
  });

  it('refuses a saved conversation or a session that isn’t there', async () => {
    const { client, session } = await serve(box.project).connect();

    await expect(client.request('sessions/replace', { session, resume: 'gone' })).rejects.toMatchObject({ code: ApiCode.unknownSession });
    await expect(client.request('sessions/activate', { session: 'gone' })).rejects.toMatchObject({ code: ApiCode.unknownSession });
  });
});
