import { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useContentWidth, useTheme } from '../runtime/context.js';

/**
 * Days are keyed by their local date, `2026-09-21`, the way people count them: a day that ends at midnight where the
 * user is, not in UTC.
 */
export function dayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a day key. */
export function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date!);
}

export function addDays(day: string, count: number) {
  const date = parseDay(day);
  date.setDate(date.getDate() + count);
  return dayKey(date);
}

/**
 * Sorts values into the heatmap's four levels the way GitHub does: by the quartiles of the days that had anything, so
 * a few big days don't wash the rest out. Nothing is level 0.
 */
export function heatLevels(values: number[]): (value: number) => number {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  const quartile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const [first, second, third] = [quartile(0.25), quartile(0.5), quartile(0.75)];
  return (value) => (value <= 0 ? 0 : value <= first ? 1 : value <= second ? 2 : value <= third ? 3 : 4);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
/** The weekday column, and each week's square with the gap after it. */
const LABEL_WIDTH = 4;
const CELL_WIDTH = 2;
const CELL = '■';

export interface HeatmapProps {
  /** How much happened each day, by `dayKey`; days left out had nothing. */
  values: Readonly<Record<string, number>>;
  /** The last day, today when left out. */
  end?: Date;
  /** At most this many weeks, a year when left out; fewer when the width runs out, the latest kept. */
  weeks?: number;
  /**
   * A day to mark, e.g. under a cursor, in the accent color. Its square keeps its shape: inverse would fill the whole
   * cell, which stands taller than the squares around it.
   */
  selected?: string;
  /** `Less ■ ■ ■ ■ ■ More` under the grid. */
  legend?: boolean;
}

/**
 * A calendar of squares, one per day, a column per week from Sunday to Saturday, shaded by how much happened: GitHub's
 * contribution graph. Months are named over the weeks they start in.
 */
export function Heatmap({ values, end = new Date(), weeks = 53, selected, legend = false }: HeatmapProps) {
  const theme = useTheme();
  const width = useContentWidth();
  // A month's name over the last week runs a column past it.
  const shown = Math.max(1, Math.min(weeks, Math.floor((width - LABEL_WIDTH - 1) / CELL_WIDTH)));
  const last = dayKey(end);
  // The Sunday that starts the first week shown.
  const first = addDays(last, -end.getDay() - (shown - 1) * 7);
  // A cursor moving over the days redraws the grid; the days and their levels stay.
  const { columns, level } = useMemo(() => {
    const days = Array.from({ length: shown }, (_, week) => Array.from({ length: 7 }, (__, day) => addDays(first, week * 7 + day)));
    return { columns: days, level: heatLevels(days.flat().map((day) => (day <= last ? (values[day] ?? 0) : 0))) };
  }, [values, first, last, shown]);

  // A month is named over the week that has its first day, where its name fits.
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

/**
 * A day picked in a heatmap with the arrows: left/right a week, up/down a day, kept between `earliest` and `end`.
 * Leaves tab to the panel, e.g. for switching tabs.
 */
export function useDayCursor(end: Date, { earliest, isActive = true }: { earliest?: string; isActive?: boolean } = {}) {
  const last = dayKey(end);
  const [day, setDay] = useState(last);
  useInput(
    (_, key) => {
      const step = key.leftArrow ? -7 : key.rightArrow ? 7 : key.upArrow ? -1 : key.downArrow ? 1 : 0;
      if (!step) return;
      setDay((current) => {
        const next = addDays(current, step);
        if (next > last) return last;
        if (earliest && next < earliest) return earliest;
        return next;
      });
    },
    { isActive },
  );
  return [day, setDay] as const;
}
