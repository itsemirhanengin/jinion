import { newToken, removeServerFile, writeServerFile } from '@jinion/core/api/server-file';
import type { JinionServer } from '@jinion/core/api/server';
import { streamTransport } from '@jinion/core/api/stream-transport';
import { listenWebSocket } from '@jinion/core/api/websocket';
import { tildify } from '@jinion/core/lib/paths';

export interface ServeOptions {
  cwd: string;
  version: string;
  port?: number;
  /** One client over stdin and stdout, such as the process that started this one. */
  stdio?: boolean;
  /** Web pages let in, by origin. */
  origins?: string[];
}

/**
 * `jinion serve`: the core without a screen, for clients to drive. Resolves once it has stopped, on ctrl+c or when the
 * stdio client goes; what it says goes to stderr, since stdout may carry the API.
 */
export async function serve(server: JinionServer, options: ServeOptions) {
  const { cwd, version, stdio } = options;

  if (stdio) {
    const transport = streamTransport(process.stdin, process.stdout);
    const connection = server.connect(transport);

    await new Promise<void>((resolve) => {
      connection.peer.onClose(resolve);
      stopOnSignal(() => transport.close());
    });

    return server.app.quit();
  }

  const token = newToken();
  const listening = await listenWebSocket({ port: options.port, token, origins: options.origins }, (transport) => server.connect(transport));
  const file = writeServerFile({ url: listening.url, token, cwd, pid: process.pid, version });

  console.error(`jinion serves ${tildify(cwd)} at ${listening.url}`);
  console.error(`Clients find its token in ${tildify(file)}, which only you can read. jinion --attach shows it here; ctrl+c stops it.`);

  await new Promise<void>((resolve) => stopOnSignal(resolve));

  try {
    await server.app.quit();
    await listening.close();
  } finally {
    removeServerFile(file);
  }
}

function stopOnSignal(stop: () => void) {
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
