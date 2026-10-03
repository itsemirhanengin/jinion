import type { ReactNode } from 'react';
import { Box, Text } from 'ink';

const CELL = '■';

export interface WafflePart {
  label: string;
  value: number;
  color: string;
  text?: ReactNode;
}

export interface WaffleProps {
  parts: WafflePart[];
  columns?: number;
  rows?: number;
  legend?: boolean;
}

export function Waffle({ parts, columns = 10, rows = 10, legend = false }: WaffleProps) {
  const counts = waffleCells(
    parts.map((part) => part.value),
    columns * rows,
  );

  const cells = parts.flatMap((part, index) => Array.from({ length: counts[index]! }, () => part.color));
  const grid = Array.from({ length: rows }, (_, row) => cells.slice(row * columns, row * columns + columns));
  const labelWidth = Math.max(0, ...parts.map((part) => part.label.length)) + 2;

  return (
    <Box>
      <Box flexDirection="column" flexShrink={0}>
        {grid.map((row, index) => (
          <Text key={index}>
            {row.map((color, column) => (
              <Text key={column} color={color}>
                {CELL}
                {column < columns - 1 && ' '}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
      {legend && (
        <Box flexDirection="column" marginLeft={3}>
          {parts.map((part) => (
            <Text key={part.label} wrap="truncate-end">
              <Text color={part.color}>{CELL}</Text> {part.label.padEnd(labelWidth)}
              {part.text}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function waffleCells(values: number[], cells: number) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (Math.max(0, value) / total) * cells);
  const counts = exact.map((share, index) => (values[index]! > 0 ? Math.max(1, Math.floor(share)) : 0));
  let left = cells - counts.reduce((sum, count) => sum + count, 0);
  const byRemainder = exact.map((share, index) => ({ index, rest: share - Math.floor(share) })).sort((a, b) => b.rest - a.rest);

  for (const { index } of byRemainder) {
    if (left <= 0) break;
    if (values[index]! <= 0) continue;

    counts[index]! += 1;
    left--;
  }

  // Parts that took a square for being tiny give it back from the largest.
  while (left < 0) {
    const largest = counts.indexOf(Math.max(...counts));

    counts[largest]! -= 1;
    left++;
  }

  return counts;
}
