import type { Receiver, Transport } from './transport.js';

/**
 * One end of a message channel, whatever kind: a page's `MessagePort`, Electron's `MessagePortMain` or Node's, each
 * wrapped to this shape where it is made, since their events differ.
 */
export interface Port {
  post(text: string): void;
  onMessage(listener: (text: string) => void): void;
  onClose(listener: () => void): void;
  close(): void;
}

/** A transport over a message channel, as the desktop app's page talks to its core; no socket, so no port to guard. */
export function portTransport(port: Port): Transport {
  let receiver: Receiver | undefined;
  let open = true;
  const early: string[] = [];

  const end = () => {
    if (!open) return;

    open = false;
    receiver?.closed();
  };

  port.onMessage((text) => {
    if (receiver) receiver.message(text);
    else early.push(text);
  });

  port.onClose(end);

  return {
    start(next) {
      receiver = next;
      for (const text of early.splice(0)) next.message(text);
      if (!open) next.closed();
    },
    send(text) {
      if (!open) throw new Error('The connection is closed.');

      port.post(text);
    },
    close() {
      port.close();
      end();
    },
  };
}
