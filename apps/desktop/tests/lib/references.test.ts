import { expect, test } from 'vitest';
import { fileReference } from '../../src/renderer/lib/references.js';

const files = ['apps/cli/src/files.ts', 'apps/cli/src/main.tsx', 'packages/core/src/main.tsx', 'README.md'];

test('finds a file by its path, with a line or a range', () => {
  expect(fileReference('apps/cli/src/files.ts', files)).toEqual({ path: 'apps/cli/src/files.ts', lines: undefined });
  expect(fileReference('./README.md', files)).toEqual({ path: 'README.md', lines: undefined });
  expect(fileReference('apps/cli/src/files.ts:27', files)).toEqual({ path: 'apps/cli/src/files.ts', lines: '27-27' });
  expect(fileReference('apps/cli/src/files.ts:27-40', files)).toEqual({ path: 'apps/cli/src/files.ts', lines: '27-40' });
});

test('finds a file by its name alone only when a single file has it', () => {
  expect(fileReference('files.ts:70', files)).toEqual({ path: 'apps/cli/src/files.ts', lines: '70-70' });
  expect(fileReference('main.tsx', files)).toBeUndefined();
});

test('leaves code that names no file of the project alone', () => {
  for (const code of ['missing.ts', 'useProjectFiles', 'git ls-files --cached', 'a.b()', '@sorgu']) expect(fileReference(code, files)).toBeUndefined();
});
