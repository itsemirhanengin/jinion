import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiCode } from '../../../src/api/protocol.js';
import { serve } from '../../support/api.js';
import { repo } from '../../support/git.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

describe('git methods', () => {
  it('reads the status, the changes and a changed file’s diff in the session’s folder', async () => {
    repo(box.project, (path) => writeFileSync(join(path, 'app.ts'), 'one\n'));
    writeFileSync(join(box.project, 'app.ts'), 'two\n');

    const { client, session } = await serve(box.project).connect();

    await expect(client.request('git/status', { session })).resolves.toMatchObject({ repos: [{ branch: 'main' }] });

    const [changes] = await client.request('git/changes', { session });

    expect(changes?.changes).toEqual([expect.objectContaining({ file: 'app.ts', kind: 'modified' })]);
    await expect(client.request('git/diff', { session, file: join(box.project, 'app.ts') })).resolves.toContain('+two');
    await expect(client.request('files/list', { session })).resolves.toContain('app.ts');
  });

  it('reads a file in the session’s folder, and refuses any path that leaves it', async () => {
    writeFileSync(join(box.project, 'app.ts'), 'one\n');
    mkdirSync(join(box.project, 'src'));
    writeFileSync(join(box.project, 'src', 'index.ts'), 'two\n');
    writeFileSync(join(box.home, 'secret.txt'), 'nope\n');
    symlinkSync(join(box.home, 'secret.txt'), join(box.project, 'link.txt'));

    const { client, session } = await serve(box.project).connect();

    await expect(client.request('files/read', { session, path: 'app.ts' })).resolves.toBe('one\n');
    await expect(client.request('files/read', { session, path: 'src/index.ts' })).resolves.toBe('two\n');

    for (const path of ['../secret.txt', join(box.home, 'secret.txt'), 'link.txt', 'src', 'missing.ts']) {
      await expect(client.request('files/read', { session, path })).rejects.toMatchObject({ code: ApiCode.unknownFile });
    }
  });

  it('reads no file but those with changes, whatever path a client sends', async () => {
    repo(box.project, (path) => writeFileSync(join(path, 'app.ts'), 'one\n'));

    const { client, session } = await serve(box.project).connect();

    await expect(client.request('git/diff', { session, file: '/etc/passwd' })).rejects.toMatchObject({ code: ApiCode.unknownFile });
  });
});
