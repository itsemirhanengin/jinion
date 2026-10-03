import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../src/app/shortcuts.js';

const PAGE = join(import.meta.dirname, '../../../docs/content/docs/reference/(commands)/keyboard-shortcuts.mdx');

describe('SHORTCUTS', () => {
  it('are all on the docs’ keyboard shortcuts page', () => {
    const page = readFileSync(PAGE, 'utf8').replaceAll('`', '').replaceAll(' + ', '+');
    const keys = SHORTCUTS.flatMap(([keys]) => expand(keys));

    // The page writes mouse actions as words, such as `Drag`.
    const listed = (key: string) => new RegExp(`(?<![\\w+])${key.replace(/[$+]/g, '\\$&')}(?![\\w+])`, 'i').test(page);

    expect(keys.filter((key) => !listed(key))).toEqual([]);
  });
});

// `ctrl+a/e` in /help is `ctrl+a` and `ctrl+e` on the page.
function expand(keys: string) {
  const [first = '', ...rest] = keys.split('/');
  const modifiers = first.slice(0, first.lastIndexOf('+') + 1);

  return [first, ...rest.map((key) => (key.includes('+') ? key : modifiers + key))];
}
