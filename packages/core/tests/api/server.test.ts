import { describe, expect, it, vi } from 'vitest';
import type { JinionClient } from '../../src/api/client.js';
import { ApiCode, type ClientContract, PROTOCOL_VERSION, type ServerContract } from '../../src/api/protocol.js';
import { RpcPeer } from '../../src/api/rpc.js';
import type { JinionServer } from '../../src/api/server.js';
import { inProcessTransports } from '../../src/api/transport.js';
import { serve } from '../support/api.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

const setup = () => serve(box.project);

/** The conversation as the server holds it, and as the client following it does. */
function both(server: JinionServer, client: JinionClient) {
  const session = server.app.session;

  return { server: server.app.store.get(session.atoms.state), client: client.store.get(client.session(session.id))?.state };
}

describe('JinionServer', () => {
  it('answers initialize with the protocol, the app and its open sessions', async () => {
    const { server, connect } = setup();
    const { client } = await connect();
    const { id } = server.app.session;

    expect(client.store.get(client.sessionsAtom)).toEqual({ sessions: [{ id, title: undefined, working: false }], active: id });
    expect(client.store.get(client.appAtom)).toMatchObject({ skills: [] });
  });

  it('refuses a client of another protocol version, and requests before initialize', async () => {
    const { server } = setup();
    const [serverSide, clientSide] = inProcessTransports();
    const peer = new RpcPeer<ClientContract, ServerContract>(clientSide);

    server.connect(serverSide);

    await expect(peer.request('session/interrupt', { session: server.app.session.id })).rejects.toMatchObject({ code: ApiCode.notInitialized });

    await expect(peer.request('initialize', { protocolVersion: PROTOCOL_VERSION + 1, client: { name: 'future', version: '9' } })).rejects.toMatchObject({
      code: ApiCode.unsupportedVersion,
      data: { supported: [PROTOCOL_VERSION] },
    });
  });

  it('gives a client following a session the same conversation the server holds, through a whole turn', async () => {
    const { server, connect } = setup();
    const { client } = await connect();
    const { id } = server.app.session;

    await client.follow(id);
    await client.request('session/submit', { session: id, text: 'hi there' });

    await vi.waitFor(() => expect(client.store.get(client.session(id))?.fields.working).toBe(false));
    await vi.waitFor(() => expect(both(server, client).client).toEqual(both(server, client).server));

    const held = both(server, client).server;

    expect(held.entries.map((entry) => entry.kind)).toEqual(['banner', 'user', 'thinking', 'text']);
    expect(client.store.get(client.sessionsAtom).sessions).toEqual([{ id, title: held.title, working: false }]);
  });

  it('shows the message as the user typed it, and sends the agent what was pasted in it', async () => {
    const { server, connect } = setup();
    const { client } = await connect();
    const { id } = server.app.session;
    const run = vi.spyOn(server.app.session.agent, 'run');
    const prompt = { text: 'hi, see\nthe log', images: [{ mediaType: 'image/png', data: 'iVBORw0KGgo=' }] };

    await client.follow(id);
    await client.request('session/submit', { session: id, text: 'hi, see [Pasted text #1 +2 lines]', prompt });

    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(prompt, expect.anything()));
    expect(client.store.get(client.session(id))?.state.entries[1]).toMatchObject({ kind: 'user', text: 'hi, see [Pasted text #1 +2 lines]', prompt: prompt.text });
  });

  it('puts a skill typed as a command back in the prompt of the session it was typed in', async () => {
    const { server, connect } = setup();
    const { client, screen } = await connect();
    const { id } = server.app.session;

    server.app.start();
    await vi.waitFor(() => expect(client.store.get(client.appAtom)?.skills).not.toHaveLength(0));
    await client.request('session/submit', { session: id, text: '/review the parser' });

    await vi.waitFor(() => expect(screen.fillPrompt).toHaveBeenCalledWith(id, '$review the parser', 'replace'));
  });

  it('starts a client over from a fresh snapshot when a change goes missing on the way', async () => {
    const { server, connect } = setup();
    let dropped = false;

    const { client } = await connect((transport) => ({
      ...transport,
      start: (receiver) =>
        transport.start({
          message: (text) => {
            if (!dropped && text.includes('"session/action"')) dropped = true;
            else receiver.message(text);
          },
          closed: () => receiver.closed(),
        }),
      send: (text) => transport.send(text),
      close: () => transport.close(),
    }));

    const session = server.app.session;

    await client.follow(session.id);
    session.notice('Lost on the way.');
    session.notice('Arrived.');

    await vi.waitFor(() => expect(both(server, client).client?.entries).toHaveLength(3));
    expect(dropped).toBe(true);
    expect(both(server, client).client).toEqual(both(server, client).server);
  });

  it('shows a dialog to its clients as a field, and takes an answer only for the dialog that is open', async () => {
    const { server, connect } = setup();
    const { client } = await connect();
    const { id } = server.app.session;
    const followed = client.session(id);

    await client.follow(id);
    await client.request('session/submit', { session: id, text: 'add rate limiting to the api' });
    await vi.waitFor(() => expect(client.store.get(followed)?.fields.dialog?.id).toBe('ask'));

    await expect(client.request('dialog/answer', { session: id, dialog: 'permission', answer: { allow: true } })).rejects.toMatchObject({
      code: ApiCode.dialogGone,
    });

    await client.request('dialog/cancel', { session: id });

    await vi.waitFor(() => expect(client.store.get(followed)?.fields.working).toBe(false));
    expect(client.store.get(followed)?.fields.dialog).toBeUndefined();
    expect(client.store.get(followed)?.state.entries.at(-1)).toMatchObject({ kind: 'notice', tone: 'warning' });
    expect(both(server, client).client).toEqual(both(server, client).server);
  });

  it('tells every client as sessions open, become active and close, and stops following one that closed', async () => {
    const { server, saved, connect } = setup();
    const first = await connect();
    const second = await connect();
    const [resumed] = saved.list();

    const { session } = await first.client.request('sessions/open', { resume: resumed!.id });

    await first.client.follow(session);
    await first.client.request('sessions/activate', { session });
    await vi.waitFor(() => expect(second.client.store.get(second.client.sessionsAtom)).toMatchObject({ active: session, sessions: [{}, { id: session }] }));

    await expect(first.client.request('sessions/close', { session })).resolves.toEqual({ closed: true });
    await vi.waitFor(() => expect(second.client.store.get(second.client.sessionsAtom).sessions).toHaveLength(1));
    expect(first.client.store.get(first.client.session(session))).toBeUndefined();
    expect(server.app.sessions.map((open) => open.id)).not.toContain(session);
  });

  it('shows what a command opens on the client that typed it', async () => {
    const { server, connect } = setup();
    const typing = await connect();
    const watching = await connect();

    await typing.client.request('session/submit', { session: server.app.session.id, text: '/help' });

    await vi.waitFor(() => expect(typing.screen.view).toHaveBeenCalledWith({ id: 'help', topic: '' }));
    expect(watching.screen.view).not.toHaveBeenCalled();
  });
});
