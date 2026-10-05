import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Repo } from './types.js';

const execute = promisify(execFile);

/** Per file, by its path in the repository, whether the index holds all of its change or only some. */
export async function stagedFiles(repo: Repo) {
  return parseStaged(await run(repo, ['status', '--porcelain=v2', '-z', '--untracked-files=no']));
}

export async function stage(repo: Repo, files: string[]) {
  await run(repo, ['add', '-A', '--', ...files]);
}

export async function unstage(repo: Repo, files: string[]) {
  // A repository without a commit has no HEAD to restore the index from.
  const head = await run(repo, ['rev-parse', '--verify', 'HEAD']).then(
    () => true,
    () => false,
  );

  await run(repo, head ? ['restore', '--staged', '--', ...files] : ['rm', '--cached', '-q', '--', ...files]);
}

/** Commits what is staged, with the user's own git config and hooks; the new commit, short. */
export async function commit(repo: Repo, message: string) {
  await run(repo, ['commit', '-m', message]);

  return (await run(repo, ['rev-parse', '--short', 'HEAD'])).trim();
}

/** `-z` porcelain v2: `1 XY sub mH mI mW hH hI path\0`, `2 XY sub mH mI mW hH hI score path\0orig\0`; X is the index. */
export function parseStaged(output: string) {
  const staged = new Map<string, 'all' | 'some'>();
  const fields = output.split('\0');

  for (let index = 0; index < fields.length; index++) {
    const line = fields[index]!;
    const kind = line[0];
    if (kind !== '1' && kind !== '2') continue;

    const parts = line.split(' ');
    const [inIndex, inTree] = parts[1] ?? '..';
    const path = parts.slice(kind === '1' ? 8 : 9).join(' ');

    if (kind === '2') index++;
    if (inIndex !== '.') staged.set(path, inTree === '.' ? 'all' : 'some');
  }

  return staged;
}

// Git's own words, such as a hook's output or "nothing to commit", rather than the command line that failed.
async function run(repo: Repo, args: string[]) {
  try {
    const { stdout } = await execute('git', args, { cwd: repo.root, maxBuffer: 64 * 1024 * 1024 });

    return stdout;
  } catch (error) {
    const { stderr, stdout } = error as { stderr?: string; stdout?: string };

    throw new Error(stderr?.trim() || stdout?.trim() || (error as Error).message);
  }
}
