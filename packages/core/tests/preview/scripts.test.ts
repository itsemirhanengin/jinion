import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { devScripts } from '../../src/preview/scripts.js';

test("lists the scripts that start a server, dev ones first, as the lock file's package manager runs them", async () => {
  const folder = project({ build: 'vite build', start: 'node server.js', 'dev:docs': 'next dev', dev: 'vite', test: 'vitest' });

  writeFileSync(join(folder, 'pnpm-lock.yaml'), '');

  expect(await devScripts(folder)).toEqual([
    { name: 'dev:docs', script: 'next dev', command: 'pnpm dev:docs' },
    { name: 'dev', script: 'vite', command: 'pnpm dev' },
    { name: 'start', script: 'node server.js', command: 'pnpm start' },
  ]);
});

test('runs them with npm without a lock file, and finds none without a package.json', async () => {
  expect(await devScripts(project({ dev: 'vite' }))).toEqual([{ name: 'dev', script: 'vite', command: 'npm run dev' }]);
  expect(await devScripts(mkdtempSync(join(tmpdir(), 'jinion-scripts-')))).toEqual([]);
});

function project(scripts: Record<string, string>) {
  const folder = mkdtempSync(join(tmpdir(), 'jinion-scripts-'));

  writeFileSync(join(folder, 'package.json'), JSON.stringify({ name: 'site', scripts }));

  return folder;
}
