import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Clickable } from '../primitives/clickable.js';
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

export interface TodoPanelProps {
  groups: TodoGroup[];
  /** One line: how many are done, and the item being worked on. */
  folded?: boolean;
  /** Clicking the title folds the panel or opens it. */
  onToggle?(): void;
  /** How many of the last done items stay listed; the ones before go into a count, so a long list stays short. */
  keepDone?: number;
}

/** The group being worked on; done items beyond `keepDone` fold into a count. */
export function TodoPanel({ groups, folded = false, onToggle, keepDone = Number.POSITIVE_INFINITY }: TodoPanelProps) {
  const theme = useTheme();

  const current = groups.findIndex((group) => !isComplete(group));
  const index = current === -1 ? groups.length - 1 : current;
  const group = groups[index];
  if (!group) return null;

  const all = groups.reduce((sum, each) => ({ done: sum.done + progress(each).done, total: sum.total + progress(each).total }), { done: 0, total: 0 });
  const { done, total } = progress(group);
  const doing = group.items.find((item) => item.status === 'active') ?? group.items.find((item) => item.status === 'pending');

  const title = (
    <Text wrap={folded ? 'truncate-end' : 'wrap'}>
      <Text bold color={theme.success}>
        {folded ? '+' : '-'} TODO
      </Text>
      <Text color={theme.muted}> · {all.done}/{all.total}</Text>
      {folded && doing && (
        <Text>
          <Text color={theme.muted}> · </Text>
          <TodoText item={doing} />
        </Text>
      )}
    </Text>
  );

  if (folded) {
    return (
      <Box paddingX={1}>
        <Toggle onToggle={onToggle}>{title}</Toggle>
      </Box>
    );
  }

  const doneItems = group.items.filter((item) => item.status === 'done');
  const shownDone = new Set(doneItems.slice(Math.max(0, doneItems.length - keepDone)));
  const tucked = doneItems.length - shownDone.size;
  const rows = group.items.filter((item) => item.status !== 'done' || shownDone.has(item));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Toggle onToggle={onToggle}>{title}</Toggle>
      <TreeRow
        prefix=" |-- "
        label={
          <Text color={theme.code}>
            {roman(index + 1)}. {group.title} <Text color={theme.muted}>· {done}/{total}</Text>
          </Text>
        }
      />
      {tucked > 0 && <TreeRow prefix={rows.length === 0 ? " |  '-- " : ' |  |-- '} label={<Text color={theme.muted}>[x] {tucked} done</Text>} />}
      {rows.map((item, itemIndex) => (
        <TreeRow key={itemIndex} prefix={itemIndex === rows.length - 1 ? " |  '-- " : ' |  |-- '} label={<TodoText item={item} />} />
      ))}
      <Text color={theme.border}> `-----</Text>
    </Box>
  );
}

function Toggle({ onToggle, children }: { onToggle?: () => void; children: ReactNode }) {
  if (!onToggle) return <Box>{children}</Box>;

  return (
    <Clickable id="todo" fit onClick={onToggle}>
      <Box>{children}</Box>
    </Clickable>
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
