import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { JinionClient } from '../../src/api/client.js';
import { RpcCode } from '../../src/api/rpc.js';
import type { Transport } from '../../src/api/transport.js';
import { connectWebSocket, type Listening, listenWebSocket } from '../../src/api/websocket.js';
import { serve } from '../support/api.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();
const TOKEN = 'a-token-only-the-user-has';
const noop = () => {};
const screen = { view: noop, fillPrompt: noop, notify: noop, expand: noop, exit: noop };

let listening: Listening | undefined;

afterEach(async () => {
  await listening?.close();
  listening = undefined;
});

async function start(origins: string[] = []) {
  const { server } = serve(box.project);

  listening = await listenWebSocket({ token: TOKEN, origins }, (transport) => server.connect(transport));

  return { server, url: listening.url };
}

const client = (transport: Transport) => new JinionClient(transport, { name: 'test', version: '0.0.0', screen, followAll: true });

/** Resolves with the status the server answered the upgrade with, or 101 once the socket opened. */
const handshake = (url: string, headers: Record<string, string> = {}) =>
  new Promise<number>((resolve) => {
    const socket = new WebSocket(url, { headers });

    socket.on('open', () => {
      socket.close();
      resolve(101);
    });

    socket.on('unexpected-response', (_, response) => resolve(response.statusCode ?? 0));
    socket.on('error', noop);
  });

describe('WebSocket', () => {
  it('serves on this machine only, and a client with the token follows a whole turn', async () => {
    const { server, url } = await start();

    expect(url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);

    const remote = client(connectWebSocket(url, TOKEN));
    const { id } = (await remote.initialize()).sessions[0]!;

    await remote.request('session/submit', { session: id, text: 'hi there' });
    await vi.waitFor(() => expect(remote.store.get(remote.session(id))?.state.entries.at(-1)?.kind).toBe('text'));
    await vi.waitFor(() => expect(remote.store.get(remote.session(id))?.state).toEqual(server.app.store.get(server.app.session.atoms.state)));
  });

  it('refuses a client without the token, with another one, or from a web page not let in', async () => {
    const { url } = await start(['app://jinion']);

    expect(await handshake(url)).toBe(401);
    expect(await handshake(url, { authorization: 'Bearer guessed' })).toBe(401);
    expect(await handshake(url, { authorization: `Bearer ${TOKEN}`, origin: 'https://evil.example' })).toBe(403);
    expect(await handshake(`${url}/?token=${TOKEN}`, { origin: 'app://jinion' })).toBe(101);
  });

  it('fails what a refused client asks, as a closed connection', async () => {
    const { url } = await start();

    await expect(client(connectWebSocket(url, 'wrong')).initialize()).rejects.toMatchObject({ code: RpcCode.closed });
  });

  it('closes its clients as it stops', async () => {
    const { url } = await start();
    const remote = client(connectWebSocket(url, TOKEN));

    await remote.initialize();
    await listening!.close();
    listening = undefined;

    await expect(remote.request('saved/list', {})).rejects.toMatchObject({ code: RpcCode.closed });
  });
});
