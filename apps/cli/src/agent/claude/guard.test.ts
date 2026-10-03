import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountsDir } from './accounts.js';
import { guardReason, isPlanFile } from './guard.js';

const cwd = '/work/project';
const bash = (command: string) => guardReason('Bash', { command }, cwd);

describe('guardReason', () => {
  it('asks before commits, wherever they sit in a command line', () => {
    for (const command of [
      'git commit -m "x"',
      'pnpm test && git commit -am fix',
      'FOO=1 sudo git -C repo commit',
      'echo $(git commit -m x)',
    ]) {
      expect(bash(command), command).toBe('Jinion asks before every commit.');
    }
  });

  it('lets other git commands through', () => {
    expect(bash('git status && git log --oneline')).toBeUndefined();
    expect(bash('echo "commit"')).toBeUndefined();
  });

  it('asks before file tools change files outside the project', () => {
    expect(guardReason('Write', { file_path: '/etc/hosts' }, cwd)).toBe('Jinion asks before changing files outside the project.');
    expect(guardReason('Edit', { file_path: '../other/a.ts' }, cwd)).toBeDefined();
  });

  it('lets changes inside the project and Claude Code’s plans through', () => {
    expect(guardReason('Edit', { file_path: 'src/a.ts' }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: `${cwd}/notes.md` }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: join(homedir(), '.claude', 'plans', 'plan.md') }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: join(accountsDir(), 'work', 'plans', 'plan.md') }, cwd)).toBeUndefined();
    expect(guardReason('Read', { file_path: '/etc/hosts' }, cwd)).toBeUndefined();
  });
});

describe('isPlanFile', () => {
  it('knows the plans of Claude Code’s own login and of every account', () => {
    expect(isPlanFile(join(homedir(), '.claude', 'plans', 'a.md'))).toBe(true);
    expect(isPlanFile(join(accountsDir(), 'work', 'plans', 'a.md'))).toBe(true);
    expect(isPlanFile(join(accountsDir(), 'work', 'settings.json'))).toBe(false);
    expect(isPlanFile(join(homedir(), '.claude', 'settings.json'))).toBe(false);
    expect(isPlanFile('/work/project/plans/a.md')).toBe(false);
  });
});
