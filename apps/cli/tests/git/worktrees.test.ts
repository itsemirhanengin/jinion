import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorktree, removeWorktree, worktreeWork } from '../../src/git/worktrees.js';
import { git, repo } from '../support/git.js';
import { sandbox, type Sandbox } from '../support/sandbox.js';

let box: Sandbox;

beforeEach(() => {
  box = sandbox();
});

afterEach(() => box.restore());

describe('worktrees', () => {
  it('makes a worktree under ~/.jinion on its own branch, from local HEAD when there is no remote', async () => {
    repo(box.project, (path) => box.write(join(path, 'a.ts'), 'a'));

    const worktree = await createWorktree(box.project);

    expect(worktree.name).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
    expect(worktree.branch).toBe(`worktree-${worktree.name}`);
    expect(worktree.path).toBe(join(box.home, '.jinion', 'projects', box.project.replace(/[^a-zA-Z0-9]/g, '-'), 'worktrees', worktree.name));
    expect(readFileSync(join(worktree.path, 'a.ts'), 'utf8')).toBe('a');
    expect(git(worktree.path, 'branch', '--show-current').trim()).toBe(worktree.branch);
    expect(worktree.base).toBe(git(box.project, 'rev-parse', 'HEAD').trim());
    // The main checkout gets nothing new.
    expect(git(box.project, 'status', '--porcelain')).toBe('');
  });

  it('starts from the remote’s default branch rather than the branch the project is on', async () => {
    const remote = join(box.home, 'remote');

    repo(remote, (path) => box.write(join(path, 'a.ts'), 'from main'));
    git(box.home, 'clone', '-q', remote, box.project);
    git(box.project, 'checkout', '-qb', 'feature');
    box.write(join(box.project, 'a.ts'), 'from feature');
    git(box.project, 'commit', '-qam', 'feature');

    const worktree = await createWorktree(box.project);

    expect(readFileSync(join(worktree.path, 'a.ts'), 'utf8')).toBe('from main');
    // Not tracking origin/main, so a push doesn't go to the default branch.
    expect(git(worktree.path, 'config', '--get-regexp', '^branch\\.')).not.toContain(worktree.branch);
  });

  it('works in the same folder of the worktree when the project is below the repository’s root', async () => {
    repo(box.project, (path) => box.write(join(path, 'apps', 'cli', 'a.ts'), 'a'));

    const worktree = await createWorktree(join(box.project, 'apps', 'cli'));

    expect(worktree.folder).toBe(join(worktree.path, 'apps', 'cli'));
    expect(realpathSync(worktree.repo)).toBe(realpathSync(box.project));
  });

  it('copies the gitignored files .worktreeinclude names, and only those', async () => {
    repo(box.project, (path) => {
      box.write(join(path, '.gitignore'), '.env\nsecrets/\nbuild/\n');
      box.write(join(path, '.worktreeinclude'), '.env\nsecrets/key.json\nREADME.md\n');
      box.write(join(path, 'README.md'), 'tracked');
    });

    box.write(join(box.project, '.env'), 'TOKEN=1');
    box.write(join(box.project, 'secrets', 'key.json'), '{}');
    box.write(join(box.project, 'build', 'out.js'), '');

    const worktree = await createWorktree(box.project);

    expect(readFileSync(join(worktree.path, '.env'), 'utf8')).toBe('TOKEN=1');
    expect(existsSync(join(worktree.path, 'secrets', 'key.json'))).toBe(true);
    expect(existsSync(join(worktree.path, 'build'))).toBe(false);
  });

  it('counts changed files and new commits, and removes the worktree with its branch', async () => {
    repo(box.project, (path) => box.write(join(path, 'a.ts'), 'a'));

    const worktree = await createWorktree(box.project);

    expect(await worktreeWork(worktree)).toEqual({ changed: 0, commits: 0 });

    box.write(join(worktree.path, 'b.ts'), 'b');
    expect(await worktreeWork(worktree)).toEqual({ changed: 1, commits: 0 });

    git(worktree.path, 'add', '-A');
    git(worktree.path, 'commit', '-qm', 'b');
    expect(await worktreeWork(worktree)).toEqual({ changed: 0, commits: 1 });

    await removeWorktree(worktree);

    expect(existsSync(worktree.path)).toBe(false);
    expect(git(box.project, 'branch', '--list', worktree.branch)).toBe('');
  });

  it('needs a repository with a commit', async () => {
    await expect(createWorktree(box.project)).rejects.toThrow('Worktrees need the project to be in a git repository.');

    git(box.project, 'init', '-q');
    await expect(createWorktree(box.project)).rejects.toThrow('Worktrees need a repository with at least one commit.');
  });
});
