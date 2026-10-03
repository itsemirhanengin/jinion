import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Prose } from './prose.js';

export interface OptionRowProps {
  number: number;
  count: number;
  label: ReactNode;
  description?: ReactNode;
  focused: boolean;
  checked?: boolean;
  aside?: ReactNode;
  note?: string;
  children?: ReactNode;
}

export function OptionRow({ number, count, label, description, focused, checked, aside, note, children }: OptionRowProps) {
  const theme = useTheme();

  const multiple = checked !== undefined;
  const color = focused ? theme.selection : checked === false ? theme.muted : undefined;
  const indent = optionIndent(count, multiple);

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexShrink={0} width={indent}>
          <Text color={color}>
            {focused ? '> ' : '  '}
            {`${number}.`.padStart(String(count).length + 1)}
            {multiple && <Text color={checked ? theme.selection : theme.muted}>{checked ? ' [x]' : ' [ ]'}</Text>}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          <Prose color={color} bold={focused}>
            {label}
          </Prose>
        </Box>
        {aside !== undefined && (
          <Box flexShrink={0} marginLeft={2}>
            <Text color={theme.muted}>{aside}</Text>
          </Box>
        )}
      </Box>
      {description && (
        <Box paddingLeft={indent}>
          <Prose color={theme.muted}>{description}</Prose>
        </Box>
      )}
      {children ?? (note && <NoteLine note={note} indent={indent} />)}
    </Box>
  );
}

export const optionIndent = (count: number, multiple = false) => String(count).length + 4 + (multiple ? 4 : 0);

export function NoteLine({ note, indent }: { note: string; indent: number }) {
  const theme = useTheme();

  return (
    <Box paddingLeft={indent}>
      <Prose>
        <Text color={theme.muted}>note: </Text>
        {note}
      </Prose>
    </Box>
  );
}
