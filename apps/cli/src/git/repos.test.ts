import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git, repo } from '../test/git.js';
import { sandbox, type Sandbox } from '../test/sandbox.js';
import { branchBase, fileDiff, findRepos, repoChanges, repoState } from './repos.js';

let box: Sandbox;

beforeEach(() => {
  box = sandbox();
});

afterEach(() => box.restore());

describe('findRepos', () => {
  it('finds the repositories in the folders of a project that isn’t one', () => {
    for (const name of ['api', 'web', 'libs/shared']) repo(join(box.project, name), (path) => box.write(join(path, 'README.md'), name));
    repo(join(box.project, 'node_modules', 'pkg'), (path) => box.write(join(path, 'index.js'), ''));
    repo(join(box.project, 'a', 'b', 'c', 'deep'), (path) => box.write(join(path, 'x'), ''));
    repo(join(box.project, 'api', 'nested'), (path) => box.write(join(path, 'x'), ''));

    expect(findRepos(box.project).map((found) => found.label)).toEqual(['api', 'libs/shared', 'web']);
  });

  it('takes the repository the project is in, also from a folder inside it', () => {
    repo(box.project, (path) => box.write(join(path, 'src', 'a.ts'), ''));

    const [found, ...rest] = findRepos(join(box.project, 'src'));

    expect(rest).toEqual([]);
    // As the project is spelled, though the temporary folder is a symlink on macOS.
    expect(found).toEqual({ root: box.project, path: '', label: 'project' });
  });

  it('finds nothing in a folder without repositories', () => {
    expect(findRepos(box.project)).toEqual([]);
  });
});

describe('repoChanges', () => {
  it('lists what changed since the last commit, new files included, with their lines', async () => {
    const root = join(box.project, 'api');

    repo(root, (path) => {
      box.write(join(path, 'a.ts'), 'one\ntwo\n');
      box.write(join(path, 'gone.ts'), 'bye\n');
      box.write(join(path, 'old.ts'), 'moving\nalong\n');
    });

    box.write(join(root, 'a.ts'), 'one\nTWO\nthree\n');
    git(root, 'rm', '-q', 'gone.ts');
    git(root, 'mv', 'old.ts', 'new.ts');
    box.write(join(root, 'fresh.ts'), 'a\nb\nc\n');
    const [api] = findRepos(box.project);

    const changes = await repoChanges(api!);

    expect(changes.map(({ file, kind, insertions, deletions }) => `${file} ${kind} +${insertions} -${deletions}`)).toEqual([
      'a.ts modified +2 -1',
      'fresh.ts untracked +3 -0',
      'gone.ts deleted +0 -1',
      'new.ts renamed +0 -0',
    ]);

    expect(await repoState(api!)).toMatchObject({ branch: 'main', changed: 4 });

    const modified = await fileDiff(api!, changes[0]!);

    expect(modified).toContain('-two\n+TWO\n+three');
    expect(await fileDiff(api!, changes[1]!)).toBe('@@ -0,0 +1,3 @@\n+a\n+b\n+c');
  });
});

describe('branchBase', () => {
  it('finds what a branch adds on top of the default branch, and nothing on the default branch itself', async () => {
    const root = join(box.project, 'api');

    repo(root, (path) => box.write(join(path, 'a.ts'), 'one\n'));
    const [api] = findRepos(box.project);

    expect(await branchBase(api!)).toBeUndefined();

    git(root, 'checkout', '-qb', 'limits');
    expect(await branchBase(api!)).toBeUndefined();

    box.write(join(root, 'limit.ts'), 'export const limit = 100;\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'limit');
    const since = await branchBase(api!);

    expect(since).toMatchObject({ against: 'main' });

    const changes = await repoChanges(api!, since!.base);

    expect(changes.map(({ file, kind, insertions }) => `${file} ${kind} +${insertions}`)).toEqual(['limit.ts added +1']);
    expect(await fileDiff(api!, changes[0]!, since!.base)).toContain('+export const limit = 100;');
  });
});
