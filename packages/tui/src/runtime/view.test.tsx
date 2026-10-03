import { Box, Text } from 'ink';
import { afterEach, expect, it } from 'vitest';
import { Expandable } from '../primitives/expandable.js';
import { ScrollView } from '../primitives/scroll-view.js';
import { renderTerminal, type TestTerminal } from '../testing/index.js';
import { useView } from './view.js';

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

const NAMES = ['first', 'second', 'third'];
const renders = new Map<string, number>();
const count = (name: string) => renders.set(name, (renders.get(name) ?? 0) + 1);

function Item({ name }: { name: string }) {
  const { expanded } = useView();
  count(name);
  return (
    <Text>
      {name} {expanded ? 'open' : 'closed'}
    </Text>
  );
}

function App() {
  useView();
  count('app');
  return (
    <Box flexDirection="column" height={12}>
      <ScrollView>
        {NAMES.map((name) => (
          <Expandable key={name} id={name}>
            <Item name={name} />
          </Expandable>
        ))}
      </ScrollView>
    </Box>
  );
}

it('draws again only the item opened on its own, not the others or the app around them', async () => {
  terminal = renderTerminal(<App />, { columns: 40, rows: 12 });
  await terminal.waitFor('third closed');
  await new Promise((resolve) => setTimeout(resolve, 60));
  const before = new Map(renders);

  await terminal.click('second closed');
  await terminal.waitFor('second open');
  expect(renders.get('second')).toBeGreaterThan(before.get('second')!);
  expect(renders.get('first')).toBe(before.get('first'));
  expect(renders.get('third')).toBe(before.get('third'));
  expect(renders.get('app')).toBe(before.get('app'));
});
