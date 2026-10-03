import { Fragment, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { useContentWidth } from '../runtime/width.js';

export interface Stat {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

export interface StatGridProps {
  stats: Stat[];
  columns?: number;
}

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
