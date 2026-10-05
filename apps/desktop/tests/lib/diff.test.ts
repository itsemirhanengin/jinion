import { expect, test } from 'vitest';
import { diffLines } from '../../src/renderer/lib/diff.js';

test('reads a unified patch into numbered lines, a gap between hunks as an empty line', () => {
  const patch = ['@@ -1,2 +1,2 @@', ' keep', '-old', '+new', '@@ -9,1 +9,2 @@', ' later', '+added', '\\ No newline at end of file'].join('\n');

  expect(diffLines(patch)).toEqual([
    { kind: 'context', text: 'keep', number: 1 },
    { kind: 'removed', text: 'old', number: 2 },
    { kind: 'added', text: 'new', number: 2 },
    { kind: 'context', text: '' },
    { kind: 'context', text: 'later', number: 9 },
    { kind: 'added', text: 'added', number: 10 },
  ]);
});

test('skips the headers git writes before the first hunk', () => {
  const patch = ['diff --git a/app.ts b/app.ts', 'index 5626abf..f719efd 100644', '--- a/app.ts', '+++ b/app.ts', '@@ -1 +1 @@', '-one', '+two'].join('\n');

  expect(diffLines(patch)).toEqual([
    { kind: 'removed', text: 'one', number: 1 },
    { kind: 'added', text: 'two', number: 1 },
  ]);
});

test('leaves the numbers out of a patch without hunk headers', () => {
  expect(diffLines([' keep', '+new'].join('\n'))).toEqual([
    { kind: 'context', text: 'keep', number: undefined },
    { kind: 'added', text: 'new', number: undefined },
  ]);
});
