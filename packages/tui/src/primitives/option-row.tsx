import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Prose } from './prose.js';

/** Width of the `> 12. ` marker for a list of `count` options, so descriptions and notes line up under the label. */
export const optionIndent = (count: number) => String(count).length + 4;

export interface OptionRowProps {
  /** 1-based; number keys jump to it. */
  number: number;
  /** How many options the list has, so the numbers line up. */
  count: number;
  label: ReactNode;
  description?: ReactNode;
  focused: boolean;
  /** The option in effect now, marked `current` on the right. */
  current?: boolean;
  note?: string;
  /** Replaces the note line, e.g. with an editor. */
  children?: ReactNode;
}

/**
 * One choice in a panel's list:
 *
 *     > 2. Opus 5.5                       current
 *          For complex work and everyday tasks
 */
export function OptionRow({ number, count, label, description, focused, current = false, note, children }: OptionRowProps) {
  const theme = useTheme();
  const color = focused ? theme.selection : undefined;
  const indent = optionIndent(count);

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexShrink={0} width={indent}>
          <Text color={color}>
            {focused ? '> ' : '  '}
            {`${number}.`.padStart(String(count).length + 1)}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          <Prose color={color} bold={focused}>
            {label}
          </Prose>
        </Box>
        {current && (
          <Box flexShrink={0} marginLeft={2}>
            <Text color={theme.muted}>current</Text>
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
