import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';

export interface SelectListProps<T> {
  items: T[];
  selected: number;
  limit?: number;
  renderItem(item: T, state: { selected: boolean; index: number; first: boolean }): ReactNode;
  empty?: string;
}

export function SelectList<T>({ items, selected, limit = 8, renderItem, empty = 'No matches' }: SelectListProps<T>) {
  const theme = useTheme();
  if (items.length === 0) return <Text color={theme.muted}>{empty}</Text>;

  const start = Math.min(Math.max(0, selected - Math.floor(limit / 2)), Math.max(0, items.length - limit));
  const end = Math.min(items.length, start + limit);

  return (
    <Box flexDirection="column">
      {start > 0 && <Text color={theme.muted}>  … {start} more above</Text>}
      {items.slice(start, end).map((item, offset) => (
        <Box key={start + offset} flexDirection="column">
          {renderItem(item, { selected: start + offset === selected, index: start + offset, first: offset === 0 })}
        </Box>
      ))}
      {end < items.length && <Text color={theme.muted}>  … {items.length - end} more</Text>}
    </Box>
  );
}

export interface ListRowProps {
  selected?: boolean;
  label: ReactNode;
  labelWidth?: number;
  description?: ReactNode;
  aside?: ReactNode;
  detail?: ReactNode;
}

export function ListRow({ selected = false, label, labelWidth, description, aside, detail }: ListRowProps) {
  const theme = useTheme();
  const color = selected ? theme.selection : undefined;

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexShrink={0}>
          <Text color={color}>{selected ? '> ' : '  '}</Text>
        </Box>
        <Box flexShrink={0} width={labelWidth} marginRight={description === undefined ? 0 : 2}>
          <Text color={color} bold={selected} wrap="truncate-end">
            {label}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          {description !== undefined && (
            <Text color={theme.muted} wrap="truncate-end">
              {description}
            </Text>
          )}
        </Box>
        {aside !== undefined && (
          <Box flexShrink={0} marginLeft={2}>
            <Text color={theme.muted}>{aside}</Text>
          </Box>
        )}
      </Box>
      {detail !== undefined && (
        <Box paddingLeft={4}>
          <Text color={theme.muted} wrap="truncate-end">
            {detail}
          </Text>
        </Box>
      )}
    </Box>
  );
}
