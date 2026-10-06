import { afterEach, describe, expect, it, vi } from 'vitest';
import { Diff } from '../../src/content/diff.js';
import { renderTerminal, type TestTerminal } from '../../src/testing/index.js';
import { darkTheme } from '../../src/theme/themes.js';

const PATCH = ['@@ -1,4 +1,4 @@', ' /* a comment', '    over two lines */', '-const size = 1;', '+const size = 2;', ' export { size };'].join('\n');

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

describe('Diff', () => {
  it('colors the code by its language, across lines, keeping the changed span marked', async () => {
    terminal = renderTerminal(<Diff patch={PATCH} language="ts" />, { columns: 60, rows: 12 });

    await terminal.waitFor('export');

    await vi.waitFor(async () => expect((await terminal!.colorOf('export'))?.toLowerCase()).toBe('#c678dd'), { timeout: 5000 });

    expect(await terminal.colorOf('over two lines')).toBe(await terminal.colorOf('a comment'));
    expect(await terminal.colorOf('over two lines')).not.toBe(await terminal.colorOf('export'));
    expect(await terminal.backgroundOf('size = 2', 7)).toBe(darkTheme.diff.addedHighlight);
    expect(await terminal.backgroundOf('size = 2')).toBe(darkTheme.diff.addedBg);
  });

  it('keeps the diff colors for a language it does not know', async () => {
    terminal = renderTerminal(<Diff patch={PATCH} language="nothing-like-it" />, { columns: 60, rows: 12 });

    await terminal.waitFor('export');
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(await terminal.colorOf('const size = 2')).toBe(darkTheme.diff.added);
  });
});
