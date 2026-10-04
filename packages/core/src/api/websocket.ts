import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import type { Receiver, Transport } from './transport.js';

/** A prompt carries its images as base64. */
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

export interface WebSocketOptions {
  /** `127.0.0.1` unless said otherwise, so only this machine reaches it. */
  host?: string;
  /** A free one when left out. */
  port?: number;
  /** What a client sends as `Authorization: Bearer`, or as `?token=` from a web page, which can't set headers. */
  token: string;
  /** The web pages let in, by origin, such as the desktop app's; a client that isn't a page sends no origin. */
  origins?: string[];
}

export interface Listening {
  url: string;
  close(): Promise<void>;
}

/** Serves the API over WebSocket, handing each client that may connect to `connected` as a transport. */
export async function listenWebSocket(options: WebSocketOptions, connected: (transport: Transport) => void): Promise<Listening> {
  const { host = '127.0.0.1', port = 0 } = options;
  const http = createServer((_, response) => response.writeHead(426, { 'content-type': 'text/plain' }).end('jinion speaks WebSocket here.\n'));
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  http.on('upgrade', (request, socket, head) => {
    const refused = refusal(request, options);

    if (refused) {
      socket.end(`HTTP/1.1 ${refused}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);

      return;
    }

    sockets.handleUpgrade(request, socket, head, (client) => connected(socketTransport(client)));
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(port, host, resolve);
  });

  const bound = (http.address() as AddressInfo).port;

  return {
    url: `ws://${host}:${bound}`,
    close: () =>
      new Promise((resolve) => {
        for (const client of sockets.clients) client.close(1001, 'jinion is stopping.');

        sockets.close();
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}

/** A transport to a server `listenWebSocket` started; what is sent before the socket opens waits for it. */
export function connectWebSocket(url: string, token: string): Transport {
  return socketTransport(new WebSocket(url, { headers: { authorization: `Bearer ${token}` }, maxPayload: MAX_MESSAGE_BYTES }));
}

// A web page can reach 127.0.0.1 too, so one from an origin not let in is refused before anything else, as OpenCode's
// open server didn't (CVE-2026-22812).
function refusal(request: IncomingMessage, { token, origins = [] }: WebSocketOptions) {
  const { origin } = request.headers;
  if (origin !== undefined && !origins.includes(origin)) return '403 Forbidden';
  if (!same(sentToken(request), token)) return '401 Unauthorized';

  return undefined;
}

function sentToken(request: IncomingMessage) {
  const { authorization } = request.headers;
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);

  return new URL(request.url ?? '/', 'http://localhost').searchParams.get('token') ?? undefined;
}

/** In constant time, so how long a refusal takes says nothing about the token. */
function same(given: string | undefined, token: string) {
  if (given === undefined) return false;

  const a = Buffer.from(given);
  const b = Buffer.from(token);

  return a.length === b.length && timingSafeEqual(a, b);
}

function socketTransport(socket: WebSocket): Transport {
  let receiver: Receiver | undefined;
  let open = true;
  const early: string[] = [];
  const unsent: string[] = [];

  const end = () => {
    if (!open) return;

    open = false;
    receiver?.closed();
  };

  socket.on('open', () => {
    for (const text of unsent.splice(0)) socket.send(text);
  });

  socket.on('message', (data) => {
    const text = data.toString();

    if (receiver) receiver.message(text);
    else early.push(text);
  });

  socket.on('close', end);
  // A refused or failed connection ends it; `close` follows when the socket had opened.
  socket.on('error', end);

  return {
    start(next) {
      receiver = next;
      for (const text of early.splice(0)) next.message(text);
      if (!open) next.closed();
    },
    send(text) {
      if (!open) throw new Error('The connection is closed.');

      if (socket.readyState === WebSocket.OPEN) socket.send(text);
      else unsent.push(text);
    },
    close() {
      socket.close();
      end();
    },
  };
}
