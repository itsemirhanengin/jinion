import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiCode } from '../../../src/api/protocol.js';
import { serve } from '../../support/api.js';
import { git, repo } from '../../support/git.js';
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

  it('stages, unstages and commits in each repository of a folder that holds several', async () => {
    const api = join(box.project, 'api');
    const web = join(box.project, 'web');

    repo(api, (path) => writeFileSync(join(path, 'server.ts'), 'one\n'));
    repo(web, (path) => writeFileSync(join(path, 'page.tsx'), 'one\n'));

    // The core commits with the user's own config, which a CI runner doesn't have.
    for (const [key, value] of [
      ['user.name', 'Jinion'],
      ['user.email', 'tests@jinion.co'],
      ['commit.gpgsign', 'false'],
    ]) {
      git(api, 'config', key!, value!);
    }

    writeFileSync(join(api, 'server.ts'), 'two\n');
    writeFileSync(join(api, 'limits.ts'), 'new\n');
    writeFileSync(join(web, 'page.tsx'), 'two\n');

    const { client, session } = await serve(box.project).connect();
    const read = async () => Object.fromEntries((await client.request('git/changes', { session, uncommitted: true })).map((each) => [each.repo.label, each]));

    expect(Object.keys(await read())).toEqual(['api', 'web']);

    await client.request('git/stage', { session, files: [join(api, 'server.ts'), join(api, 'limits.ts'), join(web, 'page.tsx')] });

    let repos = await read();

    expect(repos.api?.changes.map((each) => [each.file, each.staged])).toEqual([
      ['limits.ts', 'all'],
      ['server.ts', 'all'],
    ]);

    expect(repos.web?.changes[0]?.staged).toBe('all');

    await client.request('git/unstage', { session, files: [join(web, 'page.tsx')] });
    writeFileSync(join(api, 'server.ts'), 'three\n');
    repos = await read();

    expect(repos.web?.changes[0]?.staged).toBeUndefined();
    expect(repos.api?.changes.find((each) => each.file === 'server.ts')?.staged).toBe('some');

    const { commit } = await client.request('git/commit', { session, repo: repos.api!.repo.root, message: 'feat: limits' });

    expect(commit).toMatch(/^[0-9a-f]{7,}$/);
    repos = await read();
    expect(repos.api?.changes.map((each) => [each.file, each.staged])).toEqual([['server.ts', undefined]]);
    expect(repos.web?.changes).toHaveLength(1);
  });

  it('stages no file but those with changes, and commits only in the folder’s repositories', async () => {
    repo(box.project, (path) => writeFileSync(join(path, 'app.ts'), 'one\n'));

    const { client, session } = await serve(box.project).connect();

    await expect(client.request('git/stage', { session, files: ['/etc/passwd'] })).rejects.toMatchObject({ code: ApiCode.unknownFile });
    await expect(client.request('git/commit', { session, repo: box.home, message: 'nope' })).rejects.toMatchObject({ code: ApiCode.unknownFile });
  });

  it('reads no file but those with changes, whatever path a client sends', async () => {
    repo(box.project, (path) => writeFileSync(join(path, 'app.ts'), 'one\n'));

    const { client, session } = await serve(box.project).connect();

    await expect(client.request('git/diff', { session, file: '/etc/passwd' })).rejects.toMatchObject({ code: ApiCode.unknownFile });
  });
});
