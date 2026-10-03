import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { useEffect, useState } from 'react';
import { fuzzyMatch } from '@jinion/tui';
import { mention, type CompletionItem, type CompletionSource } from '@jinion/tui/chat';

/** Skipped when the project isn't a git repository and nothing says what to ignore. */
const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.turbo', '.next', '.cache', '.venv']);
const LIMIT = 50_000;
const SHOWN = 50;

/** Git decides what counts when it can, so ignored files stay out and untracked ones are in. */
export async function listProjectFiles(cwd: string) {
  const files = await gitFiles(cwd).catch(() => walk(cwd));
  const folders = new Set<string>();
  for (const file of files) {
    for (let slash = file.indexOf('/'); slash !== -1; slash = file.indexOf('/', slash + 1)) {
      folders.add(file.slice(0, slash + 1));
    }
  }
  return [...[...folders].sort(), ...files];
}

function gitFiles(cwd: string) {
  return new Promise<string[]>((resolve, reject) => {
    execFile(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout.split('\0').filter(Boolean).slice(0, LIMIT))),
    );
  });
}

async function walk(cwd: string) {
  const files: string[] = [];
  const queue = [''];
  while (queue.length > 0 && files.length < LIMIT) {
    const folder = queue.shift()!;
    const entries = await readdir(join(cwd, folder), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const path = folder + entry.name;
      if (entry.isDirectory()) queue.push(`${path}/`);
      else files.push(path);
    }
  }
  return files.sort();
}

export function useProjectFiles(cwd: string, refresh: unknown) {
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    listProjectFiles(cwd).then(
      (listed) => current && setFiles(listed),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [cwd, refresh]);
  return files;
}

const AT_CURSOR = /(?:^|\s)@([^\s"]*)$/;

/** Claude Code reads `@path` mentions itself. A folder gets no trailing space, so typing on lists what is inside. */
export function fileCompletion(files: string[]): CompletionSource {
  return (value, cursor) => {
    const typed = AT_CURSOR.exec(value.slice(0, cursor));
    if (!typed) return undefined;
    const query = typed[1]!;
    const items: CompletionItem[] = rank(files, query)
      .slice(0, SHOWN)
      .map(({ path, positions }) => {
        const folder = path.endsWith('/');
        return { key: path, label: path, positions, insert: folder ? mention(path) : `${mention(path)} `, tag: folder ? 'dir' : undefined };
      });
    return items.length > 0 ? { from: cursor - query.length - 1, to: cursor, items, submit: false } : undefined;
  };
}

function rank(files: string[], query: string) {
  if (!query) return files.filter((path) => !path.slice(0, -1).includes('/')).map((path) => ({ path, positions: [] }));
  return files
    .flatMap((path) => {
      // The folder typed so far is where the user already is.
      if (path === query) return [];
      const start = path.slice(0, -1).lastIndexOf('/') + 1;
      const inName = fuzzyMatch(path.slice(start), query);
      if (inName) return [{ path, score: inName.score + 10, positions: inName.positions.map((at) => at + start) }];
      const inPath = fuzzyMatch(path, query);
      return inPath ? [{ path, score: inPath.score, positions: inPath.positions }] : [];
    })
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length);
}
