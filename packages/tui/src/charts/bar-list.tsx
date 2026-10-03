import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { Meter } from '../primitives/meter.js';
import { useTheme } from '../runtime/context.js';

export interface Bar {
  label: ReactNode;
  /** The label's width for lining up the bars; the label's length when it is a string. */
  labelWidth?: number;
  /** From 0 to 1. */
  value: number;
  /** After the bar, e.g. `47%  13.0B`. */
  text?: ReactNode;
  /** A muted line under the row. */
  detail?: ReactNode;
  /** The bar's own color, the theme's accent when left out. */
  color?: string;
}

export interface BarListProps {
  bars: Bar[];
  /** Cells in each bar. */
  width?: number;
}

/**
 * Rows of `label [=====-----] text`, the bars lined up: shares of a whole, like each model's part of the tokens. Bars
 * keep one color, unlike a `Meter` on its own, which warns as it fills.
 */
export function BarList({ bars, width = 20 }: BarListProps) {
  const theme = useTheme();
  const labelWidth = Math.max(0, ...bars.map((bar) => bar.labelWidth ?? (typeof bar.label === 'string' ? bar.label.length : 0))) + 2;
  return (
    <Box flexDirection="column">
      {bars.map((bar, index) => (
        <Box key={index} flexDirection="column">
          <Box>
            <Box width={labelWidth} flexShrink={0}>
              <Text wrap="truncate-end">{bar.label}</Text>
            </Box>
            <Meter value={bar.value} width={width} color={bar.color ?? theme.accent} />
            {bar.text !== undefined && <Text> {bar.text}</Text>}
          </Box>
          {bar.detail !== undefined && (
            <Box paddingLeft={labelWidth}>
              <Text color={theme.muted} wrap="truncate-end">
                {bar.detail}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
