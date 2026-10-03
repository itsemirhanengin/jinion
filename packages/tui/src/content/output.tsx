import { Box, Text } from 'ink';
import { useHovered } from '../primitives/clickable.js';
import { useTheme } from '../runtime/theme.js';
import { useView } from '../runtime/view.js';
import { plural } from '../utils/plural.js';
import { printable } from '../utils/printable.js';

export interface OutputLinesProps {
  lines: string[];
  tail?: number;
  color?: string;
}

export function OutputLines({ lines, tail = 10, color }: OutputLinesProps) {
  const { expanded } = useView();

  const hidden = expanded ? 0 : Math.max(0, lines.length - tail);

  return (
    <Box flexDirection="column">
      {hidden > 0 && <ExpandHint>{`+${plural(hidden, 'earlier line')}`}</ExpandHint>}
      {lines.slice(hidden).map((line, index) => (
        <Text key={index} color={color}>
          {printable(line) || ' '}
        </Text>
      ))}
    </Box>
  );
}

export function ExpandHint({ children }: { children: string }) {
  const theme = useTheme();
  const hovered = useHovered();

  return <Text color={hovered ? undefined : theme.muted}>… {children}</Text>;
}
