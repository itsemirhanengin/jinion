import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Fill } from './fill.js';

export interface RuleProps {
  title?: ReactNode;
  char?: string;
  color?: string;
}

/** A full-width dashed line: `------` or `--- title ------`. */
export function Rule({ title, char = '-', color }: RuleProps) {
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
    </Box>
  );
}
