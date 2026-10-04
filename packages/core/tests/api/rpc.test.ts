import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RpcCode, RpcError, RpcPeer } from '../../src/api/rpc.js';
import { inProcessTransports } from '../../src/api/transport.js';

type Calculator = {
  requests: {
    add: { params: { a: number; b: number }; result: number };
    fail: { params: Record<never, never>; result: null };
  };
  notifications: { log: { text: string } };
};

type Caller = { requests: Record<never, never>; notifications: Record<never, never> };

/** Sends what the types would refuse, as a client in another language could. */
type Unchecked = { requests: Record<string, { params: unknown; result: unknown }>; notifications: Record<string, unknown> };

const schemas = { add: z.object({ a: z.number(), b: z.number() }), log: z.object({ text: z.string() }) };

function pair() {
  const [serverSide, clientSide] = inProcessTransports();
  const server = new RpcPeer<Calculator, Caller>(serverSide, schemas);
  const client = new RpcPeer<Caller, Calculator>(clientSide);

  server.handle('add', ({ a, b }) => a + b);

  server.handle('fail', () => {
    throw new Error('Out of paper.');
  });

  return { server, client };
}

describe('RpcPeer', () => {
  it('answers a request with what its handler returns', async () => {
    const { client } = pair();

    await expect(client.request('add', { a: 2, b: 3 })).resolves.toBe(5);
  });

  it('turns params that don’t fit, an unknown method and a failing handler into JSON-RPC errors', async () => {
    const { client } = pair();
    const unchecked = client as unknown as RpcPeer<Caller, Unchecked>;

    await expect(unchecked.request('add', { a: 'two', b: 3 })).rejects.toMatchObject({ code: RpcCode.invalidParams, message: expect.stringContaining('a') });
    await expect(unchecked.request('divide', {})).rejects.toMatchObject({ code: RpcCode.methodNotFound });
    await expect(client.request('fail', {})).rejects.toEqual(new RpcError(RpcCode.internalError, 'Out of paper.'));
  });

  it('hands notifications to their listeners, and drops one whose params don’t fit', async () => {
    const [serverSide, clientSide] = inProcessTransports();
    const server = new RpcPeer<Calculator, Caller>(serverSide, schemas);
    const client = new RpcPeer<Caller, Calculator>(clientSide);
    const listener = vi.fn();

    server.on('log', listener);
    client.notify('log', { text: 'one' });
    (client as unknown as RpcPeer<Caller, Unchecked>).notify('log', { text: 2 });
    client.notify('log', { text: 'three' });

    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    expect(listener.mock.calls).toEqual([[{ text: 'one' }], [{ text: 'three' }]]);
  });

  it('answers what isn’t JSON-RPC with an error, and keeps going', async () => {
    const [serverSide, raw] = inProcessTransports();
    const replies: unknown[] = [];

    new RpcPeer<Calculator, Caller>(serverSide, schemas).handle('add', ({ a, b }) => a + b);
    raw.start({ message: (text) => replies.push(JSON.parse(text)), closed: () => {} });
    raw.send('not json');
    raw.send(JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'add' }]));
    raw.send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'add', params: { a: 1, b: 1 } }));

    await vi.waitFor(() => expect(replies).toHaveLength(3));

    expect(replies).toEqual([
      { jsonrpc: '2.0', id: null, error: { code: RpcCode.parseError, message: expect.any(String) } },
      { jsonrpc: '2.0', id: null, error: { code: RpcCode.invalidRequest, message: expect.any(String) } },
      { jsonrpc: '2.0', id: 2, result: 2 },
    ]);
  });

  it('fails what is still waiting when the connection closes, and refuses what comes after', async () => {
    const [serverSide, clientSide] = inProcessTransports();
    const server = new RpcPeer<Calculator, Caller>(serverSide);
    const client = new RpcPeer<Caller, Calculator>(clientSide);
    const closed = vi.fn();

    server.handle('add', () => new Promise<number>(() => {}));
    client.onClose(closed);

    const waiting = client.request('add', { a: 1, b: 1 });

    server.close();

    await expect(waiting).rejects.toMatchObject({ code: RpcCode.closed });
    await expect(client.request('add', { a: 1, b: 1 })).rejects.toMatchObject({ code: RpcCode.closed });
    expect(closed).toHaveBeenCalledOnce();
  });
});
