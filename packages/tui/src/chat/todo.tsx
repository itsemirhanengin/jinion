import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Frame } from '../primitives/frame.js';
import { StatusMark, toneOf, type Status } from '../primitives/spinner.js';
import { TreeRow } from '../primitives/tree.js';

export type TodoStatus = 'pending' | 'active' | 'done';

export interface TodoItem {
  text: string;
  status: TodoStatus;
}

export interface TodoGroup {
  title: string;
  items: TodoItem[];
}

export function TodoBlock({ groups, status = 'done' }: { groups: TodoGroup[]; status?: Status }) {
  const theme = useTheme();

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Frame
      tone={toneOf(status)}
      title={
        <Text>
          <StatusMark status={status} /> Todo {total} tasks
        </Text>
      }
    >
      {groups.map((group, index) => {
        const { done, total: count } = progress(group);

        return (
          <Box key={index} flexDirection="column">
            <Text>
              {roman(index + 1)}. {group.title} <Text color={theme.muted}> {done}/{count}</Text>
            </Text>
            {!isComplete(group) &&
              group.items.map((item, itemIndex) => (
                <TreeRow
                  key={itemIndex}
                  prefix={itemIndex === group.items.length - 1 ? "  '-- " : '  |-- '}
                  label={<TodoText item={item} />}
                />
              ))}
          </Box>
        );
      })}
    </Frame>
  );
}

export function TodoPanel({ groups }: { groups: TodoGroup[] }) {
  const theme = useTheme();

  const current = groups.findIndex((group) => !isComplete(group));
  const index = current === -1 ? groups.length - 1 : current;
  const group = groups[index];
  if (!group) return null;

  const { done, total } = progress(group);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={theme.success}>
        TODO
      </Text>
      <TreeRow
        prefix=" |-- "
        label={
          <Text color={theme.code}>
            {roman(index + 1)}. {group.title} <Text color={theme.muted}>· {done}/{total}</Text>
          </Text>
        }
      />
      {group.items.map((item, itemIndex) => (
        <TreeRow
          key={itemIndex}
          prefix={itemIndex === group.items.length - 1 ? " |  '-- " : ' |  |-- '}
          label={<TodoText item={item} />}
        />
      ))}
      <Text color={theme.border}> `-----</Text>
    </Box>
  );
}

function TodoText({ item }: { item: TodoItem }) {
  const theme = useTheme();

  switch (item.status) {
    case 'done':
      return (
        <Text color={theme.muted}>
          [x] <Text strikethrough>{item.text}</Text>
        </Text>
      );

    case 'active':
      return (
        <Text color={theme.accent}>
          [/] <Text bold>{item.text}</Text>
        </Text>
      );

    case 'pending':
      return <Text>[ ] {item.text}</Text>;
  }
}

const progress = (group: TodoGroup) => ({
  done: group.items.filter((item) => item.status === 'done').length,
  total: group.items.length,
});

const isComplete = (group: TodoGroup) => group.items.every((item) => item.status === 'done');

const NUMERALS: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function roman(value: number) {
  let rest = value;
  let result = '';

  for (const [amount, numeral] of NUMERALS) {
    while (rest >= amount) {
      result += numeral;
      rest -= amount;
    }
  }

  return result;
}
