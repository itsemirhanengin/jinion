import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { JinionClient } from '../../src/api/client.js';
import { streamTransport } from '../../src/api/stream-transport.js';
import { serve } from '../support/api.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();
const noop = () => {};

describe('streamTransport', () => {
  it('carries the API a line per message, as over a child process’s stdin and stdout', async () => {
    const { server } = serve(box.project);
    const toServer = new PassThrough();
    const toClient = new PassThrough();
    const written: string[] = [];

    toClient.on('data', (chunk: Buffer) => written.push(chunk.toString()));
    server.connect(streamTransport(toServer, toClient));

    const client = new JinionClient(streamTransport(toClient, toServer), {
      name: 'test',
      version: '0.0.0',
      screen: { view: noop, fillPrompt: noop, notify: noop, expand: noop, exit: noop },
      followAll: true,
    });

    const { id } = (await client.initialize()).sessions[0]!;

    await client.request('session/submit', { session: id, text: 'line one\nline two' });
    await vi.waitFor(() => expect(client.store.get(client.session(id))?.state.entries[1]).toMatchObject({ text: 'line one\nline two' }));
    expect(written.join('').split('\n').filter(Boolean).every((line) => JSON.parse(line).jsonrpc === '2.0')).toBe(true);
  });

  it('closes when the other side ends its stream', async () => {
    const input = new PassThrough();
    const closed = vi.fn();

    streamTransport(input, new PassThrough()).start({ message: noop, closed });
    input.end();

    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
  });
});
