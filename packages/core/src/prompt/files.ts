import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Skipped when the project isn't a git repository and nothing says what to ignore. */
const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', '.turbo', '.next', '.cache', '.venv']);
const LIMIT = 50_000;

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
