import { Text } from 'ink';
import { useTheme } from '../runtime/theme.js';

export interface MeterProps {
  value: number;
  width?: number;
  color?: string;
}

export function Meter({ value, width = 10, color }: MeterProps) {
  const theme = useTheme();
  const level = Math.min(1, Math.max(0, value));
  const filled = Math.round(level * width);
  const fill = color ?? (level >= 0.8 ? theme.error : level >= 0.5 ? theme.warning : theme.success);

  return (
    <Text>
      <Text color={theme.muted}>[</Text>
      <Text color={fill}>{'='.repeat(filled)}</Text>
      <Text color={theme.muted}>{'-'.repeat(width - filled)}]</Text>
    </Text>
  );
}
