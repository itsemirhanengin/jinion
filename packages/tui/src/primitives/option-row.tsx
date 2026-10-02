import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Prose } from './prose.js';

/** Width of the `> 12. [x] ` marker, so descriptions and notes line up under the label. */
export const optionIndent = (count: number, multiple = false) => String(count).length + 4 + (multiple ? 4 : 0);

export interface OptionRowProps {
  /** 1-based; number keys jump to it. */
  number: number;
  /** How many options the list has, so the numbers line up. */
  count: number;
  label: ReactNode;
  description?: ReactNode;
  focused: boolean;
  /** Draws a `[x]`/`[ ]` box, for lists where several options can be picked. Leave out for a single choice. */
  checked?: boolean;
  /** Muted, on the right: e.g. `current` for the option in effect now. */
  aside?: ReactNode;
  note?: string;
  /** Replaces the note line, e.g. with an editor. */
  children?: ReactNode;
}

/**
 * One option in a panel's list:
 *
 *     > 2. Opus 5.5                       current      a single choice
 *          For complex work and everyday tasks
 *     > 2. [x] Tests                                   one of several
 */
export function OptionRow({ number, count, label, description, focused, checked, aside, note, children }: OptionRowProps) {
  const theme = useTheme();
  const multiple = checked !== undefined;
  // Unchecked options read as off; the focused one stays readable.
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
