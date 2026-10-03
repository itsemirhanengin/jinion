import { afterEach, describe, expect, it } from 'vitest';
import { Text } from 'ink';
import { ShellBlock } from '../chat/tool.js';
import { Diff } from '../content/diff.js';
import { Frame } from '../primitives/frame.js';
import { renderTerminal, type TestTerminal } from '../testing/index.js';
import { printable } from './printable.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

const MESSY = ['function f() {', '\tif (a)\t{ return 1; }', '}', 'progress 10%\rprogress 100%', '\x1b[32mok\x1b[0m done', 'windows line\r'];

describe('printable', () => {
  it('lays tabs out to the next stop, keeps what a line was rewritten to, and drops escape sequences', () => {
    expect(MESSY.map((line) => printable(line))).toEqual([
      'function f() {',
      '    if (a)  { return 1; }',
      '}',
      'progress 100%',
      'ok done',
      'windows line',
    ]);

    expect(printable('a\x07b\x1b]8;;https://x.dev\x07link\x1b]8;;\x07')).toBe('ablink');
    expect(printable('plain text')).toBe('plain text');
    // ⚠️ is two columns to Ink and one in many terminals; ⚠ is one in both. ✅ is two everywhere.
    expect(printable('✅ done ⚠️ careful')).toBe('✅ done ⚠ careful');
  });
});

describe('outside text in a frame', () => {
  const aligned = (screen: string) => {
    const rows = screen.split('\n').filter((line) => /^[|+]/.test(line));

    return new Set(rows.map((line) => line.length)).size === 1 && rows.every((line) => /[|+]$/.test(line));
  };

  it('stays drawn where Ink thinks it is, which raw text would not', async () => {
    terminal = renderTerminal(
      <Frame title="raw">
        {MESSY.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Frame>,
      { columns: 50, rows: 12 },
    );

    expect(aligned(await terminal.screen())).toBe(false);
  });

  it('keeps command output and diffs in their frames', async () => {
    terminal = renderTerminal(<ShellBlock command={'cat\tf.js'} output={MESSY} status="done" />, { columns: 50, rows: 14 });
    expect(aligned(await terminal.screen())).toBe(true);
    terminal.unmount();

    terminal = renderTerminal(
      <Frame title="diff">
        <Diff patch={['@@ -1,2 +1,2 @@', '-\tconst a = 1;\r', '+\tconst a = 2;\r', ' \treturn a;\r'].join('\n')} />
      </Frame>,
      { columns: 50, rows: 8 },
    );

    const screen = await terminal.screen();

    expect(aligned(screen)).toBe(true);
    expect(screen).toContain('    const a = 2;');
  });
});
