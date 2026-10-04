import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { readJson, updateJson } from '../../src/lib/json-file.js';

const run = promisify(execFile);
const JSON_FILE = new URL('../../src/lib/json-file.ts', import.meta.url).pathname;

describe('updateJson', () => {
  it('loses no change when several processes update one file at once', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'jinion-lock-')), 'counter.json');

    const script = `
      import { updateJson } from ${JSON.stringify(JSON_FILE)};
      for (let i = 0; i < 40; i++) updateJson(${JSON.stringify(path)}, { count: 0 }, ({ count }) => ({ count: count + 1 }));
    `;

    await Promise.all(Array.from({ length: 4 }, () => run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script])));

    expect(readJson(path, { count: 0 }).count).toBe(160);
    expect(existsSync(`${path}.lock`)).toBe(false);
  }, 30_000);

  it('breaks a lock left by a process that died holding it', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'jinion-lock-')), 'settings.json');
    const old = Date.now() / 1000 - 60;

    writeFileSync(`${path}.lock`, '');
    utimesSync(`${path}.lock`, old, old);

    expect(updateJson(path, { on: false }, () => ({ on: true }))).toEqual({ on: true });
  });
});
