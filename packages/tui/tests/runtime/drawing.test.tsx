import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { afterEach, expect, it } from 'vitest';
import { renderTerminal, type TestTerminal } from '../../src/testing/index.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

function Ticking() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), 30);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column">
      <Text>the conversation</Text>
      <Box height={4} />
      <Text>working {tick % 4}</Text>
    </Box>
  );
}

it('clears what landed where Ink didn’t draw it within a frame, on rows that didn’t change', async () => {
  terminal = renderTerminal(<Ticking />, { columns: 30, rows: 8 });
  await terminal.waitFor('working');
  await terminal.scribble('\x1b[3;1HWriting… 2m 8s');
  await new Promise((resolve) => setTimeout(resolve, 150));
  const screen = await terminal.screen();

  expect(screen).toContain('the conversation');
  expect(screen).not.toContain('Writing');
});
