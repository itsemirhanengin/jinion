import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { git, repo } from '../../test/git.js';
import { sandboxEach } from '../../test/sandbox.js';
import { systemPrompt } from './prompt.js';

const box = sandboxEach();

const gitLine = () => systemPrompt(box.project).split('\n').find((line) => line.startsWith('- Git: '));

describe('systemPrompt', () => {
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

  it('says when there is no repository at all', () => {
    expect(gitLine()).toBe('- Git: not a git repository');
  });
});
