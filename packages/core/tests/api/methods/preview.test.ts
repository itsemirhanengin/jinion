import { writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serve } from '../../support/api.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

let shell: string | undefined;

beforeEach(() => {
  shell = process.env.SHELL;
  process.env.SHELL = '/bin/sh';
});

afterEach(() => {
  process.env.SHELL = shell;
});

describe('preview methods', () => {
  it('lists the addresses the terminals printed whose server answers', async () => {
    const { server, connect } = serve(box.project);
    const { client } = await connect();
    const listening = await listen();
    const port = (listening.address() as { port: number }).port;
    const stopped = await listen();
    const gone = (stopped.address() as { port: number }).port;

    await new Promise((resolve) => stopped.close(resolve));

    try {
      const command = `printf "Local: http://localhost:${port}/\\nOld: http://localhost:${gone}\\n"`;
      const opened = await server.app.terminals.open({ cwd: box.project, command });

      await until(async () => (await client.request('terminals/list', {}))[0]?.urls?.length === 2);

      await expect(client.request('preview/servers', {})).resolves.toEqual([{ url: `http://localhost:${port}`, terminal: opened.id, title: command }]);
    } finally {
      server.app.terminals.closeAll();
      listening.close();
    }
  });

  it('lists the scripts of the project that start a server', async () => {
    writeFileSync(join(box.project, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' } }));

    const { client } = await serve(box.project).connect();

    await expect(client.request('preview/scripts', {})).resolves.toEqual([{ name: 'dev', script: 'vite', command: 'npm run dev' }]);
  });
});

function listen() {
  return new Promise<Server>((resolve) => {
    const server = createServer((socket) => socket.end());

    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function until(check: () => Promise<boolean>, ms = 5000) {
  const end = Date.now() + ms;

  while (!(await check())) {
    if (Date.now() > end) throw new Error('Timed out waiting.');

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
