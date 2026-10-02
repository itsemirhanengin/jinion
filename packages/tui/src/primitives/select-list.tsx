import { useState, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';

/** Moves a list index by `delta`, wrapping around or stopping at the ends. */
export function stepIndex(index: number, delta: number, count: number, wrap = true) {
  if (count === 0) return 0;
  if (wrap) return (((index + delta) % count) + count) % count;
  return Math.min(count - 1, Math.max(0, index + delta));
}

export interface ListNavigationOptions {
  isActive?: boolean;
  wrap?: boolean;
  /** Enables PageUp and PageDown, moving this many items. */
  pageSize?: number;
}

/** Up/down selection over `count` items. The index stays in range when the list shrinks. */
export function useListNavigation(count: number, { isActive = true, wrap = true, pageSize }: ListNavigationOptions = {}) {
  const [index, setIndex] = useState(0);
  const current = count === 0 ? 0 : Math.min(index, count - 1);

  useInput(
    (_, key) => {
      if (key.upArrow) setIndex(stepIndex(current, -1, count, wrap));
      else if (key.downArrow) setIndex(stepIndex(current, 1, count, wrap));
      else if (pageSize && key.pageUp) setIndex(stepIndex(current, -pageSize, count, false));
      else if (pageSize && key.pageDown) setIndex(stepIndex(current, pageSize, count, false));
    },
    { isActive: isActive && count > 0 },
  );

  return [current, setIndex] as const;
}

export interface SelectListProps<T> {
  items: T[];
  selected: number;
  /** Items shown at once; the window follows the selection. */
  limit?: number;
  renderItem(item: T, state: { selected: boolean; index: number }): ReactNode;
  empty?: string;
}

/** A windowed list with `… n more` markers above and below the visible items. */
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
          {renderItem(item, { selected: start + offset === selected, index: start + offset })}
        </Box>
      ))}
      {end < items.length && <Text color={theme.muted}>  … {items.length - end} more</Text>}
    </Box>
  );
}

export interface ListRowProps {
  selected?: boolean;
  label: ReactNode;
  /** Fixed label column, so descriptions line up across rows. */
  labelWidth?: number;
  description?: ReactNode;
  /** Right-aligned, e.g. a source tag or a timestamp. */
  aside?: ReactNode;
  /** A second, indented line. */
  detail?: ReactNode;
}

/** The standard list row: `> label   description          aside`. */
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
