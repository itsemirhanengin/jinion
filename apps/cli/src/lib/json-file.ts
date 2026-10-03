import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;

  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Writes through a temporary file, so a crash never leaves half a file behind. */
export function writeJson(path: string, value: unknown) {
  const temporary = `${path}.${process.pid}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}
