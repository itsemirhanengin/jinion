import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Fill } from './fill.js';

export interface RuleProps {
  title?: ReactNode;
  aside?: ReactNode;
  char?: string;
  color?: string;
}

export function Rule({ title, aside, char = '-', color }: RuleProps) {
  const theme = useTheme();
  const lineColor = color ?? theme.border;

  return (
    <Box width="100%">
      {title !== undefined && (
        <>
          <Text color={lineColor}>{char.repeat(3)} </Text>
          <Text>{title}</Text>
          <Text> </Text>
        </>
      )}
      <Fill char={char} color={lineColor} />
      {aside !== undefined && (
        <>
          <Text> </Text>
          <Text>{aside}</Text>
          <Text color={lineColor}> {char.repeat(3)}</Text>
        </>
      )}
    </Box>
  );
}
