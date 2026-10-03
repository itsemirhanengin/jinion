import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { Meter } from '../primitives/meter.js';
import { useTheme } from '../runtime/theme.js';

export interface Bar {
  label: ReactNode;
  labelWidth?: number;
  value: number;
  text?: ReactNode;
  detail?: ReactNode;
  color?: string;
}

export interface BarListProps {
  bars: Bar[];
  width?: number;
}

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
            <Box flexShrink={0}>
              <Meter value={bar.value} width={width} color={bar.color ?? theme.accent} />
            </Box>
            {bar.text !== undefined && <Text wrap="truncate-end"> {bar.text}</Text>}
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
