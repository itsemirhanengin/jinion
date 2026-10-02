import { Fragment, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';

export interface StatusBarProps {
  items: ReactNode[];
  right?: ReactNode;
}

/** `jinion · [M] model · [D] dir · ctx: 12K/200K · $0.04          session title`. The right side gives way first. */
export function StatusBar({ items, right }: StatusBarProps) {
  const theme = useTheme();
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box flexShrink={0} maxWidth="100%">
        <Text wrap="truncate-end">
          {items.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && <Text color={theme.muted}> · </Text>}
              {item}
            </Fragment>
          ))}
        </Text>
      </Box>
      {right !== undefined && (
        <Box flexShrink={1} marginLeft={2}>
          <Text wrap="truncate-end">{right}</Text>
        </Box>
      )}
    </Box>
  );
}

/** `[M] value` */
export function Tag({ name, value, color }: { name: string; value: ReactNode; color?: string }) {
  const theme = useTheme();
  return (
    <Text>
      <Text color={theme.muted}>[{name}]</Text> <Text color={color}>{value}</Text>
    </Text>
  );
}
