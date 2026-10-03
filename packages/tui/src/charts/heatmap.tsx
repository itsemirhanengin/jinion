import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { useContentWidth } from '../runtime/width.js';
import { addDays, dayKey, parseDay } from '../utils/dates.js';

/** Quartiles of the days that had anything, as GitHub does, so a few big days don't wash the rest out. */
export function heatLevels(values: number[]): (value: number) => number {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const quartile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const [first, second, third] = [quartile(0.25), quartile(0.5), quartile(0.75)];
  return (value) => (value <= 0 ? 0 : value <= first ? 1 : value <= second ? 2 : value <= third ? 3 : 4);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const LABEL_WIDTH = 4;
const CELL_WIDTH = 2;
const CELL = '■';

export interface HeatmapProps {
  values: Readonly<Record<string, number>>;
  end?: Date;
  weeks?: number;
  /** Marked in the accent color, not inverse, which would fill the cell taller than the squares around it. */
  selected?: string;
  legend?: boolean;
}

export function Heatmap({ values, end = new Date(), weeks = 53, selected, legend = false }: HeatmapProps) {
  const theme = useTheme();
  const width = useContentWidth();
  // A month's name over the last week runs a column past it.
  const shown = Math.max(1, Math.min(weeks, Math.floor((width - LABEL_WIDTH - 1) / CELL_WIDTH)));
  const last = dayKey(end);
  const first = addDays(last, -end.getDay() - (shown - 1) * 7);
  // Memoized: a moving cursor redraws the grid, but the days and their levels stay.
  const { columns, level } = useMemo(() => {
    const days = Array.from({ length: shown }, (_, week) => Array.from({ length: 7 }, (__, day) => addDays(first, week * 7 + day)));
    return { columns: days, level: heatLevels(days.flat().map((day) => (day <= last ? (values[day] ?? 0) : 0))) };
  }, [values, first, last, shown]);

  const months = Array.from({ length: LABEL_WIDTH + shown * CELL_WIDTH + 1 }, () => ' ');
  let free = 0;
  columns.forEach((days, week) => {
    const starts = days.find((day) => day.endsWith('-01') && day <= last);
    const at = LABEL_WIDTH + week * CELL_WIDTH;
    if (!starts || at < free) return;
    const name = MONTHS[parseDay(starts).getMonth()]!;
    if (at + name.length > months.length) return;
    months.splice(at, name.length, ...name);
    free = at + name.length + 1;
  });

  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{months.join('').trimEnd()}</Text>
      {WEEKDAYS.map((label, row) => (
        <Text key={label || row}>
          <Text color={theme.muted}>{label.padEnd(LABEL_WIDTH)}</Text>
          {columns.map((days, week) => {
            const day = days[row]!;
            if (day > last) return null;
            return (
              <Text key={day}>
                <Text color={day === selected ? theme.accent : theme.heat[level(values[day] ?? 0)]}>
                  {CELL}
                </Text>
                {week < shown - 1 && ' '}
              </Text>
            );
          })}
        </Text>
      ))}
      {legend && (
        <Box justifyContent="flex-end" width={LABEL_WIDTH + shown * CELL_WIDTH - 1}>
          <Text color={theme.muted}>
            Less{' '}
            {theme.heat.map((color, index) => (
              <Text key={color} color={color}>
                {CELL}
                {index < theme.heat.length - 1 && ' '}
              </Text>
            ))}{' '}
            More
          </Text>
        </Box>
      )}
    </Box>
  );
}
