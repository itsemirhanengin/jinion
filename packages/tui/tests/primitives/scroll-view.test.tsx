import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { KEYS, renderTerminal, type TestTerminal } from '../../src/testing/index.js';
import { ScrollView } from '../../src/primitives/scroll-view.js';

const ROWS = 20;
let terminal: TestTerminal | undefined;
const mounted = new Set<number>();
let add: (count: number) => void = () => {};

beforeEach(() => mounted.clear());
afterEach(() => terminal?.unmount());

// One to three lines, so items differ in height.
function Item({ index }: { index: number }) {
  useEffect(() => {
    mounted.add(index);

    return () => void mounted.delete(index);
  }, [index]);

  return (
    <Box flexDirection="column">
      {Array.from({ length: (index % 3) + 1 }, (_, line) => (
        <Text key={line}>
          item {index} line {line}
        </Text>
      ))}
    </Box>
  );
}

function Items({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);

  add = (more) => setCount((current) => current + more);

  return (
    <Box flexDirection="column" height={ROWS}>
      <ScrollView>
        {Array.from({ length: count }, (_, index) => (
          <Item key={index} index={index} />
        ))}
      </ScrollView>
    </Box>
  );
}

const position = (index: number, line: number) => {
  const whole = Math.floor(index / 3);

  return whole * 6 + [0, 1, 3][index % 3]! + line;
};

const shown = (screen: string) =>
  [...screen.matchAll(/item (\d+) line (\d+)/g)].map((match) => position(Number(match[1]), Number(match[2])));

// Ink draws at most every frame, and an item drawn for the first time takes two.
async function settled() {
  let last = '';

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const screen = await terminal!.screen();
    if (screen === last) return screen;

    last = screen;
  }
}

it('mounts only the items in and around the view', async () => {
  terminal = renderTerminal(<Items initial={1_000} />, { columns: 40, rows: ROWS });
  await terminal.waitFor('item 999 line 0');
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(mounted.size).toBeGreaterThan(5);
  expect(mounted.size).toBeLessThan(60);
});

it('goes up a page at a time to the first line without skipping or repeating one, as items are drawn on the way', async () => {
  terminal = renderTerminal(<Items initial={150} />, { columns: 40, rows: ROWS });
  await terminal.waitFor('item 149 line 0');
  let lines = shown(await terminal.screen());

  while (lines[0] !== 0) {
    await terminal.press(KEYS.pageUp);
    const next = shown(await settled());

    expect(next).toEqual(next.map((_, at) => next[0]! + at));
    expect(next[0]).toBe(Math.max(0, lines[0]! - (lines.length - 2)));
    lines = next;
  }

  expect(await terminal.screen()).toContain('Jump to bottom');
}, 30_000);

it('stays put while items come in below, and follows them again at the bottom', async () => {
  terminal = renderTerminal(<Items initial={100} />, { columns: 40, rows: ROWS });
  await terminal.waitFor('item 99 line 0');
  await terminal.press(KEYS.pageUp, KEYS.pageUp);
  const before = shown(await settled());

  add(50);
  expect(shown(await settled())).toEqual(before);

  for (let page = 0; page < 30 && (await settled()).includes('Jump to bottom'); page++) {
    await terminal.press(KEYS.pageDown);
  }

  expect(await settled()).toContain('item 149 line 0');

  add(1);
  await terminal.waitFor('item 150 line 0');
}, 30_000);
