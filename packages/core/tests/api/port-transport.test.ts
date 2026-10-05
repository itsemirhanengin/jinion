import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JinionClient } from '../../src/api/client.js';
import { type Port, portTransport } from '../../src/api/port-transport.js';
import { serve } from '../support/api.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();
const noop = () => {};
const opened: MessagePort[] = [];

afterEach(() => {
  for (const port of opened.splice(0)) port.close();
});

/** Node's ports, in the shape the desktop app gives Electron's and the page's. */
function wrap(port: MessagePort): Port {
  opened.push(port);

  return {
    post: (text) => port.postMessage(text),
    onMessage: (listener) => port.on('message', listener),
    onClose: (listener) => port.on('close', listener),
    close: () => port.close(),
  };
}

describe('portTransport', () => {
  it('carries the API over a message channel, as between the desktop app’s page and its core', async () => {
    const { server } = serve(box.project);
    const { port1, port2 } = new MessageChannel();

    server.connect(portTransport(wrap(port1)));

    const client = new JinionClient(portTransport(wrap(port2)), {
      name: 'test',
      version: '0.0.0',
      screen: { view: noop, fillPrompt: noop, notify: noop, expand: noop, exit: noop },
      followAll: true,
    });

    const { id } = (await client.initialize()).sessions[0]!;

    await client.request('session/submit', { session: id, text: 'hello' });
    await vi.waitFor(() => expect(client.store.get(client.session(id))?.state.entries[1]).toMatchObject({ text: 'hello' }));
  });

  it('closes when the other end does', async () => {
    const { port1, port2 } = new MessageChannel();
    const closed = vi.fn();

    portTransport(wrap(port1)).start({ message: noop, closed });
    port2.close();

    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
  });
});
