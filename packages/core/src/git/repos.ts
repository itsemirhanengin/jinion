import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { stagedFiles } from './staging.js';
import type { FileChange, Repo, RepoState } from './types.js';

const git = promisify(execFile);

const SKIPPED = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', '.turbo', '.next', '.cache', '.venv']);

const DEPTH = 3;
const MAX_REPOS = 50;

/** For a folder that isn't in one, such as one holding several projects, the repositories in its subfolders. */
export function findRepos(cwd: string): Repo[] {
  try {
    // Relative, so the root is spelled like `cwd` even through a symlink, as the paths the agent edits are.
    const up = execFileSync('git', ['rev-parse', '--show-cdup'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const root = resolve(cwd, up);

    return [{ root, path: '', label: basename(root) }];
  } catch {
  }

  const repos: Repo[] = [];
  let level = [cwd];

  for (let depth = 1; depth <= DEPTH && level.length > 0 && repos.length < MAX_REPOS; depth++) {
    const next: string[] = [];

    for (const folder of level) {
      for (const entry of safeEntries(folder)) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || SKIPPED.has(entry.name)) continue;

        const path = join(folder, entry.name);

        // A repository's own folders belong to it, so the search stops there.
        if (existsSync(join(path, '.git'))) repos.push({ root: path, path: relative(cwd, path), label: relative(cwd, path) });
        else next.push(path);
      }
    }

    level = next;
  }

  return repos.slice(0, MAX_REPOS).sort((a, b) => a.path.localeCompare(b.path));
}

export async function repoState(repo: Repo): Promise<RepoState | undefined> {
  try {
    const { stdout } = await git('git', ['status', '--porcelain=v2', '--branch'], { cwd: repo.root, timeout: 5_000 });

    return parseGitStatus(stdout);
  } catch {
    return undefined;
  }
}

export function parseGitStatus(output: string): RepoState {
  const status: RepoState = { branch: '', changed: 0, ahead: 0, behind: 0 };
  let commit = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) status.branch = line.slice('# branch.head '.length);
    else if (line.startsWith('# branch.oid ')) commit = line.slice('# branch.oid '.length);
    else if (line.startsWith('# branch.ab ')) {
      const counts = /\+(\d+) -(\d+)/.exec(line);

      status.ahead = Number(counts?.[1] ?? 0);
      status.behind = Number(counts?.[2] ?? 0);
    } else if (line && !line.startsWith('#')) status.changed++;
  }

  if (status.branch === '(detached)') status.branch = commit.slice(0, 7);

  return status;
}

/** With `since`, a commit, what the commits after it changed instead, e.g. a branch's own. */
export async function repoChanges(repo: Repo, since?: string): Promise<FileChange[]> {
  const head = await hasCommits(repo);
  const run = (args: string[]) => git('git', args, { cwd: repo.root, maxBuffer: 64 * 1024 * 1024 }).then(({ stdout }) => stdout);
  const range = since ? [since, 'HEAD', '-M'] : head ? ['HEAD', '-M'] : ['--cached'];

  const [numstat, names, untracked, staged] = await Promise.all([
    run(['diff', ...range, '--numstat', '-z']),
    run(['diff', ...range, '--name-status', '-z']),
    since ? '' : run(['ls-files', '--others', '--exclude-standard', '-z']),
    since ? new Map<string, 'all' | 'some'>() : stagedFiles(repo).catch(() => new Map<string, 'all' | 'some'>()),
  ]);

  const kinds = parseNameStatus(names);

  const changes: FileChange[] = parseNumstat(numstat).map(({ file, insertions, deletions, binary }) => ({
    file,
    absolute: join(repo.root, file),
    kind: kinds.get(file) ?? 'modified',
    insertions,
    deletions,
    binary,
    ...(staged.has(file) && { staged: staged.get(file) }),
  }));

  const files = untracked.split('\0').filter(Boolean);
  const counts = await countAll(repo.root, files);

  files.forEach((file, index) => {
    const lines = counts[index];

    changes.push({ file, absolute: join(repo.root, file), kind: 'untracked', insertions: lines ?? 0, deletions: 0, binary: lines === undefined });
  });

  return changes.sort((a, b) => a.file.localeCompare(b.file));
}

export async function fileDiff(repo: Repo, change: FileChange, since?: string): Promise<string> {
  if (change.binary) return '';

  if (change.kind === 'untracked') {
    const lines = (await readFile(change.absolute, 'utf8')).replace(/\n$/, '').split('\n');

    return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join('\n');
  }

  const base = since ? ['diff', since, 'HEAD', '-M'] : (await hasCommits(repo)) ? ['diff', 'HEAD', '-M'] : ['diff', '--cached'];
  const { stdout } = await git('git', [...base, '--', change.file], { cwd: repo.root, maxBuffer: 64 * 1024 * 1024 });

  return stdout;
}

export async function branchBase(repo: Repo): Promise<{ base: string; against: string } | undefined> {
  const run = async (...args: string[]) => {
    try {
      return (await git('git', args, { cwd: repo.root })).stdout.trim();
    } catch {
      return '';
    }
  };

  // origin/HEAD names the default branch; a repository without a remote has main or master.
  const remote = await run('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  const local = (await run('rev-parse', '--verify', '--quiet', 'refs/heads/main')) ? 'main' : 'master';
  const against = remote || local;
  const current = await run('rev-parse', '--abbrev-ref', 'HEAD');
  if (!current || current === against || `origin/${current}` === against) return undefined;

  const base = await run('merge-base', 'HEAD', against);
  const head = await run('rev-parse', 'HEAD');

  return base && base !== head ? { base, against } : undefined;
}

function safeEntries(folder: string) {
  try {
    return readdirSync(folder, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function hasCommits(repo: Repo) {
  try {
    await git('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repo.root });

    return true;
  } catch {
    return false;
  }
}

/** `-z` numstat: `added\tdeleted\tpath\0`, or `added\tdeleted\t\0old\0new\0` for a rename; `-` counts for binaries. */
function parseNumstat(output: string) {
  const fields = output.split('\0');
  const rows: { file: string; insertions: number; deletions: number; binary: boolean }[] = [];

  for (let index = 0; index < fields.length; index++) {
    const match = /^(-|\d+)\t(-|\d+)\t(.*)$/.exec(fields[index]!);
    if (!match) continue;

    let file = match[3]!;

    if (!file) {
      index += 2;
      file = fields[index] ?? '';
    }

    const binary = match[1] === '-';

    rows.push({ file, insertions: binary ? 0 : Number(match[1]), deletions: binary ? 0 : Number(match[2]), binary });
  }

  return rows;
}

/** `-z` name-status: `M\0path\0`, or `R100\0old\0new\0`. */
function parseNameStatus(output: string) {
  const fields = output.split('\0');
  const kinds = new Map<string, FileChange['kind']>();

  for (let index = 0; index < fields.length; index++) {
    const code = fields[index]!;
    if (!code) continue;

    if (code.startsWith('R') || code.startsWith('C')) {
      kinds.set(fields[index + 2] ?? '', 'renamed');
      index += 2;
      continue;
    }

    const kind = code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified';

    kinds.set(fields[index + 1] ?? '', kind);
    index += 1;
  }

  return kinds;
}

/** Larger untracked files count as binary: no lines are counted or shown. */
const MAX_COUNTED = 4 * 1024 * 1024;

/** How many untracked files are read at once, well under the files a process may hold open. */
const READING = 16;

/**
 * Each repository's untracked files' line counts, kept while a file's size and modification time stay the same, so a
 * folder with thousands of them, read again every few seconds, only reads what changed.
 */
const counted = new Map<string, Map<string, { stamp: string; lines: number | undefined }>>();

/** The files' line counts, undefined for a binary or too large one, read without holding up the process. */
async function countAll(root: string, files: string[]) {
  const before = counted.get(root) ?? new Map();
  const now = new Map<string, { stamp: string; lines: number | undefined }>();
  const counts: (number | undefined)[] = [];
  let next = 0;

  const read = async () => {
    while (next < files.length) {
      const index = next++;
      const path = join(root, files[index]!);

      counts[index] = await countLines(path, before, now);
    }
  };

  await Promise.all(Array.from({ length: Math.min(READING, files.length) }, read));
  counted.set(root, now);

  return counts;
}

async function countLines(path: string, before: Map<string, { stamp: string; lines: number | undefined }>, now: typeof before) {
  try {
    const { size, mtimeMs } = await stat(path);
    const stamp = `${size}:${mtimeMs}`;
    const known = before.get(path);
    const lines = known?.stamp === stamp ? known.lines : size > MAX_COUNTED ? undefined : linesOf(await readFile(path, 'utf8'));

    now.set(path, { stamp, lines });

    return lines;
  } catch {
    return undefined;
  }
}

function linesOf(text: string) {
  if (text.includes('\0')) return undefined;

  return text ? text.replace(/\n$/, '').split('\n').length : 0;
}
