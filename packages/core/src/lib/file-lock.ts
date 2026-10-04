import { closeSync, mkdirSync, openSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

const RETRY_MS = 5;
const GIVE_UP_MS = 5_000;
// What runs under the lock takes milliseconds, so one this old was left by a process that died holding it.
const STALE_MS = 10_000;

/** Runs `run` while no other Jinion runs it for the same `path`, through a lock file beside it. */
export function withFileLock<T>(path: string, run: () => T): T {
  const lock = `${path}.lock`;
  const started = Date.now();

  mkdirSync(dirname(path), { recursive: true });

  while (!acquire(lock)) {
    if (isStale(lock)) rmSync(lock, { force: true });
    else if (Date.now() - started > GIVE_UP_MS) throw new Error(`${lock} stays locked. If no jinion is running, delete it.`);
    else pause(RETRY_MS);
  }

  try {
    return run();
  } finally {
    rmSync(lock, { force: true });
  }
}

function acquire(lock: string) {
  try {
    closeSync(openSync(lock, 'wx'));

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;

    throw error;
  }
}

function isStale(lock: string) {
  try {
    return Date.now() - statSync(lock).mtimeMs > STALE_MS;
  } catch {
    return false;
  }
}

function pause(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
