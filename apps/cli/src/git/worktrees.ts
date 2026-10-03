import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';
import { errorMessage } from '../lib/errors.js';
import { projectDir } from '../lib/paths.js';
import { findRepos } from './repos.js';

const exec = promisify(execFile);

export interface Worktree {
  name: string;
  branch: string;
  /** The worktree's root. */
  path: string;
  /** The project's folder in it, deeper than `path` when Jinion was started below the repository's root. */
  folder: string;
  /** The checkout it was made from, which runs the commands that remove it. */
  repo: string;
  /** The commit it started from, to tell the commits made in it. */
  base: string;
}

export interface WorktreeWork {
  changed: number;
  commits: number;
}

// Fetches never wait for a password or a new host's confirmation, as in Claude Code.
const QUIET = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' };

const FETCH_TIMEOUT = 5_000;
const FETCH_AGE = 24 * 60 * 60 * 1000;

export class WorktreeError extends Error {}

export async function createWorktree(cwd: string): Promise<Worktree> {
  const [repo, ...others] = findRepos(cwd);
  if (!repo || repo.path !== '' || others.length > 0) throw new WorktreeError('Worktrees need the project to be in a git repository.');

  const run = (...args: string[]) => git(repo.root, ...args);
  if (!(await run('rev-parse', '--verify', '--quiet', 'HEAD'))) throw new WorktreeError('Worktrees need a repository with at least one commit.');

  const name = await freeName(cwd, repo.root);
  const path = join(projectDir(cwd), 'worktrees', name);
  const branch = `worktree-${name}`;
  const start = await baseRef(repo.root);

  mkdirSync(dirname(path), { recursive: true });

  try {
    await exec('git', ['worktree', 'add', '--quiet', '--no-track', '-b', branch, path, start], { cwd: repo.root });
  } catch (error) {
    throw new WorktreeError(`git worktree add failed: ${gitMessage(error)}`);
  }

  await copyIncluded(repo.root, path);

  return { name, branch, path, folder: join(path, relative(repo.root, cwd)), repo: repo.root, base: await git(path, 'rev-parse', 'HEAD') };
}

/** Undefined when it can't be told, which counts as work: nothing is removed that may hold some. */
export async function worktreeWork(worktree: Worktree): Promise<WorktreeWork | undefined> {
  if (!existsSync(worktree.path)) return { changed: 0, commits: 0 };

  try {
    const [status, count] = await Promise.all([
      exec('git', ['status', '--porcelain'], { cwd: worktree.path }),
      exec('git', ['rev-list', '--count', `${worktree.base}..HEAD`], { cwd: worktree.path }),
    ]);

    return { changed: status.stdout.split('\n').filter(Boolean).length, commits: Number(count.stdout.trim()) };
  } catch {
    return undefined;
  }
}

export async function removeWorktree(worktree: Worktree) {
  if (existsSync(worktree.path)) await exec('git', ['worktree', 'remove', '--force', worktree.path], { cwd: worktree.repo });

  await git(worktree.repo, 'worktree', 'prune');
  await git(worktree.repo, 'branch', '-D', worktree.branch);
}

export const worktreeExists = (worktree: Worktree) => existsSync(worktree.folder);

/** The remote's default branch, fetched when it is a day old, so the worktree starts from a clean tree; local HEAD without one. */
async function baseRef(root: string) {
  let remote = await git(root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');

  if (!remote && (await git(root, 'remote', 'get-url', 'origin'))) {
    await git(root, 'remote', 'set-head', 'origin', '--auto');
    remote = await git(root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  }

  if (!remote) return 'HEAD';

  if (fetchedAgo(root) > FETCH_AGE) await git(root, 'fetch', '--quiet', 'origin', remote.slice('origin/'.length));

  return (await git(root, 'rev-parse', '--verify', '--quiet', remote)) ? remote : 'HEAD';
}

function fetchedAgo(root: string) {
  try {
    return Date.now() - statSync(join(root, '.git', 'FETCH_HEAD')).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** As Claude Code does: the gitignored files `.worktreeinclude` names, such as `.env`, go along into the fresh checkout. */
async function copyIncluded(root: string, path: string) {
  if (!existsSync(join(root, '.worktreeinclude'))) return;

  const listed = await git(root, 'ls-files', '--others', '--ignored', '--exclude-from=.worktreeinclude', '-z');
  const files = listed.split('\0').filter(Boolean);
  if (files.length === 0) return;

  const ignored = await gitInput(root, files.join('\0'), 'check-ignore', '--stdin', '-z');

  for (const file of ignored.split('\0').filter(Boolean)) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    cpSync(join(root, file), join(path, file));
  }
}

async function freeName(cwd: string, root: string) {
  for (;;) {
    const name = randomName();
    const taken = existsSync(join(projectDir(cwd), 'worktrees', name)) || (await git(root, 'rev-parse', '--verify', '--quiet', `refs/heads/worktree-${name}`));

    if (!taken) return name;
  }
}

const ADJECTIVES = ['bright', 'calm', 'eager', 'gentle', 'quiet', 'swift', 'bold', 'clever', 'steady', 'lucky', 'brave', 'merry'];
const VERBS = ['running', 'jumping', 'singing', 'drifting', 'climbing', 'dancing', 'humming', 'roaming', 'gliding', 'leaping'];
const NOUNS = ['fox', 'otter', 'falcon', 'badger', 'heron', 'lynx', 'panda', 'sparrow', 'tiger', 'whale', 'koala', 'raven'];

const pick = (words: string[]) => words[Math.floor(Math.random() * words.length)]!;

export const randomName = () => `${pick(ADJECTIVES)}-${pick(VERBS)}-${pick(NOUNS)}`;

/** Its output, trimmed, or `''` when it fails. */
async function git(cwd: string, ...args: string[]) {
  try {
    return (await exec('git', args, { cwd, env: QUIET, timeout: FETCH_TIMEOUT })).stdout.trim();
  } catch {
    return '';
  }
}

function gitInput(cwd: string, input: string, ...args: string[]) {
  return new Promise<string>((resolve) => {
    const child = execFile('git', args, { cwd }, (_error, stdout) => resolve(stdout));

    child.stdin?.end(input);
  });
}

const gitMessage = (error: unknown) => (error as { stderr?: string }).stderr?.trim() || errorMessage(error);
