import { Fragment, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';

export interface StatusBarProps {
  items: ReactNode[];
  right?: ReactNode | ReactNode[];
}

export function StatusBar({ items, right }: StatusBarProps) {
  const rightItems = right === undefined ? [] : Array.isArray(right) ? right : [right];

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box flexShrink={0} maxWidth="100%">
        <Text wrap="truncate-end">
          <Joined items={items} />
        </Text>
      </Box>
      {rightItems.length > 0 && (
        <Box flexShrink={1} marginLeft={2}>
          <Text wrap="truncate-end">
            <Joined items={rightItems} />
          </Text>
        </Box>
      )}
    </Box>
  );
}

function Joined({ items }: { items: ReactNode[] }) {
  const theme = useTheme();

  return items.map((item, index) => (
    <Fragment key={index}>
      {index > 0 && <Text color={theme.muted}> · </Text>}
      {item}
    </Fragment>
  ));
}

export function Tag({ name, value, color }: { name: string; value: ReactNode; color?: string }) {
  const theme = useTheme();

  return (
    <Text>
      <Text color={theme.muted}>[{name}]</Text> <Text color={color}>{value}</Text>
    </Text>
  );
}
