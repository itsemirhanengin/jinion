import { Box, Text } from 'ink';
import { afterEach, expect, it } from 'vitest';
import { PermissionPanel } from '../../src/chat/permission.js';
import { ScrollView } from '../../src/primitives/scroll-view.js';
import { KEYS, renderTerminal, type TestTerminal } from '../../src/testing/index.js';

let terminal: TestTerminal | undefined;

afterEach(() => terminal?.unmount());

const conversation = (screen: string) => screen.match(/conversation \d+/g) ?? [];

const command = Array.from({ length: 40 }, (_, index) => `echo line-${index + 1}`).join('\n');

function Screen() {
  return (
    <Box flexDirection="column" height={30}>
      <ScrollView>
        {Array.from({ length: 60 }, (_, index) => (
          <Text key={index}>conversation {index}</Text>
        ))}
      </ScrollView>
      <PermissionPanel request={{ title: 'jinion wants to run a command', command }} agent="jinion" onDecide={() => {}} onCancel={() => {}} />
    </Box>
  );
}

it('keeps a long command to a third of the screen, scrolled with shift+up/down or the wheel, and the choices in view', async () => {
  terminal = renderTerminal(<Screen />, { columns: 80, rows: 30 });

  const first = await terminal.waitFor('lines 1-10 of 40');

  expect(first).toContain('echo line-10');
  expect(first).not.toContain('echo line-11');
  expect(first).toContain('1. Yes');

  await terminal.press(KEYS.shiftDown, KEYS.shiftDown);
  expect(await terminal.waitFor('lines 3-12 of 40')).toContain('echo line-12');

  // Over the command the wheel scrolls it, and not the conversation behind.
  const before = conversation(await terminal.screen());

  await terminal.wheel('echo line-5', 'up');
  expect(conversation(await terminal.waitFor('lines 1-10 of 40'))).toEqual(before);

  await terminal.wheel(before.at(-1)!, 'up');
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(conversation(await terminal.screen())).not.toEqual(before);
  expect(await terminal.screen()).toContain('lines 1-10 of 40');
});

it('scrolls one long line the screen wraps over many rows', async () => {
  const long = Array.from({ length: 60 }, (_, index) => `touch step-${index + 1}`).join(' && ');

  terminal = renderTerminal(
    <PermissionPanel request={{ title: 'jinion wants to run a command', command: long }} agent="jinion" onDecide={() => {}} onCancel={() => {}} />,
    { columns: 80, rows: 30 },
  );

  const shown = await terminal.waitFor(/lines 1-10 of \d+/);

  expect(shown).toContain('1. Yes');

  await terminal.press(KEYS.shiftDown);
  await terminal.waitFor(/lines 2-11 of \d+/);
});

it('shows a short command whole, without a scroll line', async () => {
  terminal = renderTerminal(
    <PermissionPanel request={{ title: 'jinion wants to run a command', command: 'pnpm test' }} agent="jinion" onDecide={() => {}} onCancel={() => {}} />,
    { columns: 80, rows: 30 },
  );

  expect(await terminal.waitFor('$ pnpm test')).not.toContain('lines 1-');
});
