import { Box, Text, useInput } from 'ink';
import { afterEach, expect, it } from 'vitest';
import { useView } from '../runtime/view.js';
import { darkTheme, hoverColor } from '../theme/themes.js';
import { renderTerminal, type TestTerminal } from '../testing/index.js';
import { Expandable } from './expandable.js';
import { ScrollView } from './scroll-view.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

function Item({ name }: { name: string }) {
  const { expanded } = useView();

  return (
    <Box flexDirection="column">
      <Text>
        {name} {expanded ? 'open' : 'closed'}
      </Text>
      {expanded && <Text>{name} details</Text>}
    </Box>
  );
}

function Items() {
  const { toggleExpanded } = useView();

  useInput((input, key) => {
    if (key.ctrl && input === 'o') toggleExpanded();
  });

  return (
    <Box flexDirection="column" height={12}>
      <ScrollView>
        {['first', 'second', 'third'].map((name) => (
          <Expandable key={name} id={name}>
            <Item name={name} />
          </Expandable>
        ))}
      </ScrollView>
    </Box>
  );
}

it('opens and closes one item with a click, and ctrl+o opens all of them, forgetting the clicks', async () => {
  terminal = renderTerminal(<Items />, { columns: 40, rows: 12 });
  await terminal.waitFor('third closed');

  await terminal.click('second closed');
  let screen = await terminal.waitFor('second open');

  expect(screen).toContain('second details');
  expect(screen).toContain('first closed');
  expect(screen).toContain('third closed');

  await terminal.click('second details');
  screen = await terminal.waitFor('second closed');
  expect(screen).not.toContain('details');

  await terminal.click('first closed');
  await terminal.waitFor('first open');

  await terminal.press('\x0f');
  screen = await terminal.waitFor('third open');
  expect(screen).toContain('first open');
  expect(screen).toContain('second open');

  await terminal.press('\x0f');
  screen = await terminal.waitFor('first closed');
  expect(screen).toContain('second closed');
});

it('takes a press and release on different cells for a drag, not a click', async () => {
  terminal = renderTerminal(<Items />, { columns: 40, rows: 12 });
  const screen = await terminal.waitFor('first closed');
  const y = screen.split('\n').findIndex((line) => line.includes('first closed')) + 1;

  await terminal.press(`\x1b[<0;1;${y}M`, `\x1b[<32;4;${y}M`, `\x1b[<0;4;${y}m`);
  await new Promise((resolve) => setTimeout(resolve, 60));

  expect(await terminal.screen()).toContain('first closed');
});

function Many() {
  return (
    <Box flexDirection="column" height={12}>
      <ScrollView>
        {Array.from({ length: 30 }, (_, index) => (
          <Expandable key={index} id={String(index)}>
            <Item name={`item ${index}`} />
          </Expandable>
        ))}
      </ScrollView>
    </Box>
  );
}

const rowOf = (screen: string, text: string) => screen.split('\n').findIndex((line) => line.includes(text));

it('keeps a clicked item under the pointer while following the bottom, and follows it again once it closes', async () => {
  terminal = renderTerminal(<Many />, { columns: 40, rows: 12 });
  const before = await terminal.waitFor('item 29 closed');
  const row = rowOf(before, 'item 25 closed');

  await terminal.click('item 25 closed');
  const opened = await terminal.waitFor('item 25 details');

  expect(rowOf(opened, 'item 25 open')).toBe(row);
  expect(opened).toContain('Jump to bottom');

  await terminal.click('item 25 details');
  // Following the bottom again takes the items being measured again, a frame or two later.
  const closed = await terminal.waitFor(/item 25 closed[\s\S]*item 29 closed/);

  expect(closed).not.toContain('Jump to bottom');
});

it('lights up the item under the pointer, with the hand pointer, and nothing over empty space', async () => {
  terminal = renderTerminal(<Items />, { columns: 40, rows: 12 });
  await terminal.waitFor('third closed');
  expect(await terminal.backgroundOf('second closed')).toBeUndefined();

  await terminal.hover('second closed');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(await terminal.backgroundOf('second closed')).toBe(hoverColor(darkTheme));
  expect(await terminal.backgroundOf('first closed')).toBeUndefined();
  expect(terminal.pointer()).toBe('pointer');

  // Below the items, where nothing is.
  await terminal.press('\x1b[<35;1;10M');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(await terminal.backgroundOf('second closed')).toBeUndefined();
  expect(terminal.pointer()).toBe('default');
});

it('moves the light to what scrolls under a still pointer', async () => {
  terminal = renderTerminal(<Many />, { columns: 40, rows: 12 });
  await terminal.waitFor('item 29 closed');

  await terminal.hover('item 25 closed');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(await terminal.backgroundOf('item 25 closed')).toBe(hoverColor(darkTheme));

  const screen = await terminal.screen();
  const y = rowOf(screen, 'item 25 closed') + 1;

  await terminal.press(`\x1b[<64;1;${y}M`);
  await terminal.waitFor('Jump to bottom');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(await terminal.backgroundOf('item 25 closed')).toBeUndefined();
  expect(await terminal.backgroundOf('item 22 closed')).toBe(hoverColor(darkTheme));
});

it('lights up a line that fits its text only as far as the text goes', async () => {
  terminal = renderTerminal(
    <Box flexDirection="column" height={6}>
      <ScrollView>
        <Expandable key="line" id="line" fit>
          <Text>Thought for 3s</Text>
        </Expandable>
      </ScrollView>
    </Box>,
    { columns: 40, rows: 6 },
  );

  await terminal.waitFor('Thought for 3s');
  await terminal.hover('Thought for 3s');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(await terminal.backgroundOf('Thought for 3s', 13)).toBe(hoverColor(darkTheme));
  expect(await terminal.backgroundOf('Thought for 3s', 14)).toBeUndefined();
});
