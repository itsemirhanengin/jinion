import { Fragment, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useContentWidth, useTheme } from '../runtime/context.js';

export interface Stat {
  label: string;
  value: ReactNode;
  /** Muted, after the value, e.g. `of 76`. */
  detail?: ReactNode;
}

export interface StatGridProps {
  stats: Stat[];
  /** Stats side by side, filled row by row. */
  columns?: number;
}

/**
 * Figures as `label  value` pairs in columns, the labels of each column lined up:
 *
 * ```
 * Sessions     435        Longest session  7d 2h 55m
 * Active days  61 of 76   Current streak   21 days
 * ```
 */
export function StatGrid({ stats, columns = 2 }: StatGridProps) {
  const theme = useTheme();
  const width = useContentWidth();
  const columnWidth = Math.floor(width / columns);
  const rows = Array.from({ length: Math.ceil(stats.length / columns) }, (_, row) => stats.slice(row * columns, row * columns + columns));
  const labelWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...rows.map((row) => row[column]?.label.length ?? 0)),
  );
  return (
    <Box flexDirection="column">
      {rows.map((row, index) => (
        <Box key={index}>
          {row.map((stat, column) => (
            <Fragment key={stat.label}>
              <Box width={column < columns - 1 ? columnWidth : undefined} flexShrink={0}>
                <Text wrap="truncate-end">
                  <Text color={theme.muted}>{stat.label.padEnd(labelWidths[column]! + 2)}</Text>
                  {stat.value}
                  {stat.detail !== undefined && <Text color={theme.muted}> {stat.detail}</Text>}
                </Text>
              </Box>
            </Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}
