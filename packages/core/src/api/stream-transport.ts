import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { Receiver, Transport } from './transport.js';

/**
 * One JSON message per line, as MCP and Codex's app-server speak over stdio; JSON holds no raw newline, so a line is a
 * message. The streams stay open on `close`: whoever owns them ends them, e.g. a child's stdin to stop it.
 */
export function streamTransport(input: Readable, output: Writable): Transport {
  let receiver: Receiver | undefined;
  let open = true;

  const end = () => {
    if (!open) return;

    open = false;
    receiver?.closed();
  };

  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  const early: string[] = [];

  lines.on('line', (line) => {
    if (!line.trim()) return;

    if (receiver) receiver.message(line);
    else early.push(line);
  });

  lines.on('close', end);

  return {
    start(next) {
      receiver = next;
      for (const line of early.splice(0)) next.message(line);
      if (!open) next.closed();
    },
    send(text) {
      if (!open) throw new Error('The connection is closed.');

      output.write(`${text}\n`);
    },
    close() {
      lines.close();
      end();
    },
  };
}
