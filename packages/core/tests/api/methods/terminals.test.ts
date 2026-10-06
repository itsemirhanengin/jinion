import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiCode, type TerminalInfo } from '../../../src/api/protocol.js';
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

describe('terminal methods', () => {
  it('opens a shell in the session’s folder, and sends its output to the clients attached', async () => {
    const { server, connect } = serve(box.project);
    const watching = await connect();
    const other = await connect();
    const lists: TerminalInfo[][] = [];
    const seen: string[] = [];
    const elsewhere: string[] = [];

    other.client.on('terminals/changed', ({ terminals }) => lists.push(terminals));
    watching.client.on('terminals/output', ({ data }) => seen.push(data));
    other.client.on('terminals/output', ({ data }) => elsewhere.push(data));

    try {
      const opened = await watching.client.request('terminals/open', { session: watching.session, cols: 80, rows: 10 });

      expect(opened).toMatchObject({ cwd: box.project, agent: false, running: true, title: 'sh' });
      await expect(watching.client.request('terminals/attach', { terminal: opened.id })).resolves.toMatchObject({ seq: expect.any(Number) });

      await watching.client.request('terminals/write', { terminal: opened.id, data: 'echo "in $PWD"\r' });
      await until(() => seen.join('').includes(`in ${box.project}`));
      await watching.client.request('terminals/close', { terminal: opened.id });
      await until(() => lists.at(-1)?.length === 0);

      expect(lists[0]).toEqual([expect.objectContaining({ id: opened.id })]);
      expect(elsewhere).toEqual([]);
    } finally {
      server.app.terminals.closeAll();
    }
  });

  it('refuses a terminal that isn’t open', async () => {
    const { client } = await serve(box.project).connect();

    await expect(client.request('terminals/write', { terminal: 'terminal-9', data: 'ls\r' })).rejects.toMatchObject({ code: ApiCode.unknownTerminal });
    await expect(client.request('terminals/list', {})).resolves.toEqual([]);
  });
});

async function until(check: () => boolean, ms = 5000) {
  const end = Date.now() + ms;

  while (!check()) {
    if (Date.now() > end) throw new Error('Timed out waiting.');

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
