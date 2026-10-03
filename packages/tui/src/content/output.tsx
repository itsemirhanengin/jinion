import { Box, Text } from 'ink';
import { useHovered } from '../primitives/expandable.js';
import { useTheme, useView } from '../runtime/context.js';
import { printable } from '../utils/printable.js';

/** What a click would show, e.g. `… +12 lines`: muted, and standing out while the pointer is over its item. */
export function ExpandHint({ children }: { children: string }) {
  const theme = useTheme();
  const hovered = useHovered();
  return <Text color={hovered ? undefined : theme.muted}>… {children}</Text>;
}

export interface OutputLinesProps {
  lines: string[];
  /** Number of trailing lines kept while collapsed. */
  tail?: number;
  color?: string;
}

/** Command output that collapses to its last lines until the view is expanded. Tabs and control characters are laid out first. */
export function OutputLines({ lines, tail = 10, color }: OutputLinesProps) {
  const { expanded } = useView();
  const hidden = expanded ? 0 : Math.max(0, lines.length - tail);

  return (
    <Box flexDirection="column">
      {hidden > 0 && (
        <ExpandHint>{`+${hidden} earlier ${hidden === 1 ? 'line' : 'lines'}`}</ExpandHint>
      )}
      {lines.slice(hidden).map((line, index) => (
        <Text key={index} color={color}>
          {printable(line) || ' '}
        </Text>
      ))}
    </Box>
  );
}
