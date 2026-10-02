import { Box, Text } from 'ink';
import { useTheme, useView } from '../runtime/context.js';

export function ExpandHint({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text color={theme.muted}>
      … {children} <Text color={theme.accent}>(ctrl+o to expand)</Text>
    </Text>
  );
}

export interface OutputLinesProps {
  lines: string[];
  /** Number of trailing lines kept while collapsed. */
  tail?: number;
  color?: string;
}

/** Command output that collapses to its last lines until the view is expanded. */
export function OutputLines({ lines, tail = 10, color }: OutputLinesProps) {
  const { expanded } = useView();
  const hidden = expanded ? 0 : Math.max(0, lines.length - tail);

  return (
    <Box flexDirection="column">
      {hidden > 0 && (
        <ExpandHint>{`(${hidden} earlier lines, showing ${lines.length - hidden} of ${lines.length})`}</ExpandHint>
      )}
      {lines.slice(hidden).map((line, index) => (
        <Text key={index} color={color}>
          {line || ' '}
        </Text>
      ))}
    </Box>
  );
}
