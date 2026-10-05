import { expect, test } from 'vitest';
import { diffLines } from '../../src/renderer/lib/diff.js';

test('reads a unified patch into lines, a gap between hunks as an empty line', () => {
  const patch = ['@@ -1,2 +1,2 @@', ' keep', '-old', '+new', '@@ -9,1 +9,2 @@', ' later', '+added', '\\ No newline at end of file'].join('\n');

  expect(diffLines(patch)).toEqual([
    { kind: 'context', text: 'keep' },
    { kind: 'removed', text: 'old' },
    { kind: 'added', text: 'new' },
    { kind: 'context', text: '' },
    { kind: 'context', text: 'later' },
    { kind: 'added', text: 'added' },
  ]);
});
