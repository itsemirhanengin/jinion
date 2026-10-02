import { Text } from 'ink';
import { useTheme } from '../runtime/context.js';

export interface MeterProps {
  /** From 0 to 1; values outside are clamped. */
  value: number;
  /** Cells between the brackets. */
  width?: number;
  /** For the filled part; picks success, warning or error by `value` when left out. */
  color?: string;
}

/** `[======----]`, the filled part colored by how full it is. */
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
