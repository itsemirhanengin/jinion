import { connect } from 'node:net';
import type { TerminalInfo } from '../terminals/types.js';
import type { DevServer } from './types.js';

const PROBE_MS = 500;

/** The addresses the terminals printed whose server answers now; one stopped with ctrl+c in a shell left open doesn't. */
export async function liveServers(terminals: TerminalInfo[]): Promise<DevServer[]> {
  const found = terminals.flatMap((terminal) => (terminal.urls ?? []).map((url) => ({ url, terminal: terminal.id, title: terminal.title })));
  const live = await Promise.all(found.map((server) => answers(server.url)));

  return found.filter((_, index) => live[index]);
}

function answers(address: string) {
  const url = new URL(address);
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));

  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: url.hostname.replace(/^\[|\]$/g, ''), port, timeout: PROBE_MS });

    const end = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };

    socket.once('connect', () => end(true));
    socket.once('timeout', () => end(false));
    socket.once('error', () => end(false));
  });
}
