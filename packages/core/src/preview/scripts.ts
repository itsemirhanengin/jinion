import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DevScript } from './types.js';

const SERVES = /^(dev|start|serve|preview)(:|$)/;

/** The scripts of the folder's `package.json` that start a server, `dev` ones first, as its package manager runs them. */
export async function devScripts(folder: string): Promise<DevScript[]> {
  const scripts = await readScripts(join(folder, 'package.json'));
  const run = runner(folder);

  return Object.entries(scripts)
    .filter(([name, script]) => SERVES.test(name) && typeof script === 'string')
    .sort(([a], [b]) => Number(!a.startsWith('dev')) - Number(!b.startsWith('dev')))
    .map(([name, script]) => ({ name, script: script as string, command: run(name) }));
}

async function readScripts(path: string): Promise<Record<string, unknown>> {
  try {
    const manifest = JSON.parse(await readFile(path, 'utf8'));

    return typeof manifest?.scripts === 'object' && manifest.scripts ? manifest.scripts : {};
  } catch {
    return {};
  }
}

/** Told by the lock file, as the project's own tools tell it. */
function runner(folder: string) {
  if (existsSync(join(folder, 'pnpm-lock.yaml'))) return (name: string) => `pnpm ${name}`;
  if (existsSync(join(folder, 'yarn.lock'))) return (name: string) => `yarn ${name}`;
  if (existsSync(join(folder, 'bun.lock')) || existsSync(join(folder, 'bun.lockb'))) return (name: string) => `bun run ${name}`;

  return (name: string) => `npm run ${name}`;
}
