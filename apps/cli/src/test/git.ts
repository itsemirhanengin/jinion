import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

export function git(cwd: string, ...args: string[]) {
  return execFileSync(
    'git',
    ['-c', 'user.name=Jinion', '-c', 'user.email=tests@jinion.co', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

export function repo(path: string, write: (path: string) => void) {
  mkdirSync(path, { recursive: true });
  git(path, 'init', '-q');
  write(path);
  git(path, 'add', '-A');
  git(path, 'commit', '-qm', 'first');
}
