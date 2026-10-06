import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { git, repo } from '../../support/git.js';
import { sandboxEach } from '../../support/sandbox.js';
import { systemPrompt } from '../../../src/agent/claude/prompt.js';

const box = sandboxEach();

const gitLine = () => systemPrompt(box.project).split('\n').find((line) => line.startsWith('- Git: '));

describe('systemPrompt', () => {
  it('tells the agent about the project’s terminals only where a client shows them', () => {
    expect(systemPrompt(box.project)).not.toContain('run_in_terminal');
    expect(systemPrompt(box.project, undefined, true)).toContain('with run_in_terminal rather than Bash in the background');
  });

  it('names the project’s branch', () => {
    repo(box.project, (path) => box.write(join(path, 'a.ts'), ''));
    expect(gitLine()).toBe('- Git: on branch main');
  });

  it('lists the repositories in the folders of a project that isn’t one, so git runs in the right one', () => {
    repo(join(box.project, 'api'), (path) => box.write(join(path, 'a.ts'), ''));
    repo(join(box.project, 'web'), (path) => box.write(join(path, 'a.ts'), ''));
    git(join(box.project, 'web'), 'checkout', '-qb', 'redesign');

    expect(gitLine()).toBe(
      "- Git: this folder isn't a repository, but these folders in it are: api/ (on branch main), web/ (on branch redesign). Run git in the repository a change belongs to, e.g. `git -C api status`.",
    );
  });

  it('says when the project is a git worktree, and of which checkout', () => {
    repo(box.project, (path) => box.write(join(path, 'a.ts'), ''));
    const worktree = join(box.home, 'worktree');

    git(box.project, 'worktree', 'add', '-qb', 'worktree-swift-fox', worktree);

    expect(systemPrompt(worktree).split('\n').find((line) => line.startsWith('- Git: '))).toBe(
      `- Git: on branch worktree-swift-fox, in a git worktree of ${realpathSync(box.project)}. Work and commit here; the main checkout is the user's own and stays as it is.`,
    );
  });

  it('says when there is no repository at all', () => {
    expect(gitLine()).toBe('- Git: not a git repository');
  });
});
