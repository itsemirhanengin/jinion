import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { guardReason, readsRepositories } from '../../../src/agent/claude/guard.js';
import { accountsDir } from '../../../src/agent/claude/paths.js';

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

  it('lets commits through when the user turned asking off, but still asks about changes outside the project', () => {
    expect(guardReason('Bash', { command: 'git commit -m x' }, cwd, false)).toBeUndefined();
    expect(guardReason('Bash', { command: 'git commit -m x > ~/log.txt' }, cwd, false)).toBe('Jinion asks before changing files outside the project.');
  });

  it('lets other git commands through', () => {
    expect(bash('git status && git log --oneline')).toBeUndefined();
    expect(bash('echo "commit"')).toBeUndefined();
  });

  it('asks before file tools change files outside the project', () => {
    expect(guardReason('Write', { file_path: '/etc/hosts' }, cwd)).toBe('Jinion asks before changing files outside the project.');
    expect(guardReason('Edit', { file_path: '../other/a.ts' }, cwd)).toBeDefined();
  });

  it('asks before commands that change files outside the project', () => {
    for (const command of [
      'echo hi > ~/notes.txt',
      'pnpm build >> ../build.log',
      'cat a | tee -a /etc/hosts',
      'rm -rf ../other',
      'cp dist/cli.js /usr/local/bin/cli',
      'mv src $HOME/backup',
      "sed -i '' s/a/b/ ~/.zshrc",
      'cd .. && touch elsewhere.txt',
      'dd if=image.iso of=/dev/disk2',
      'chmod 600 ~/.ssh/config',
    ]) {
      expect(bash(command), command).toBe('Jinion asks before changing files outside the project.');
    }
  });

  it('lets commands through that only read outside the project, or write to it, to scratch space or a stream', () => {
    for (const command of [
      'echo hi > notes.txt',
      'ls > /dev/null 2>&1',
      'pnpm test &> /tmp/test.log',
      'cp ~/templates/a.ts src/a.ts',
      'cat ~/.zshrc | grep PATH',
      'echo "> ~/notes.txt"',
      'rm -rf node_modules dist',
      'rm $TARGET',
      "sed 's/a/b/' ~/.zshrc",
      'cd packages && mkdir new',
    ]) {
      expect(bash(command), command).toBeUndefined();
    }
  });

  it('lets changes inside the project and Claude Code’s plans through', () => {
    expect(guardReason('Edit', { file_path: 'src/a.ts' }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: `${cwd}/notes.md` }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: join(homedir(), '.claude', 'plans', 'plan.md') }, cwd)).toBeUndefined();
    expect(guardReason('Write', { file_path: join(accountsDir(), 'work', 'plans', 'plan.md') }, cwd)).toBeUndefined();
    expect(guardReason('Read', { file_path: '/etc/hosts' }, cwd)).toBeUndefined();
  });
});

describe('readsRepositories', () => {
  const reads = (command: string) => readsRepositories('Bash', { command });

  it('takes git reading repositories in folders with -C, one or several', () => {
    for (const command of [
      'git -C api status',
      'git -C api branch --show-current && git -C "web app" branch -vv; git -C libs/shared log --oneline -5',
      'git -C web diff HEAD -- src/a.ts',
      'git -C web show',
      'git -C web branch',
    ]) {
      expect(reads(command), command).toBe(true);
    }
  });

  it('leaves anything else to be asked', () => {
    for (const command of [
      'git -C api push origin status',
      'git -C api branch -D main',
      'git -C api status && rm -rf api',
      'git -C api log > log.txt',
      'git -C api log | head',
      'git -C api commit -m status',
      'git status',
    ]) {
      expect(reads(command), command).toBe(false);
    }

    expect(readsRepositories('Write', { command: 'git -C api status' })).toBe(false);
  });
});
