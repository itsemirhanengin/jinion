import { useMemo, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Frame, FrameDivider } from '../primitives/frame.js';
import { StatusMark, type Status } from '../primitives/spinner.js';
import { Tree, type TreeNode } from '../primitives/tree.js';
import { countChanges, Diff, parsePatch } from '../content/diff.js';
import { ExpandHint, OutputLines } from '../content/output.js';
import { ShellCommand } from '../content/shell.js';
import type { Tone } from '../theme/themes.js';

export function toneOf(status: Status): Tone {
  switch (status) {
    case 'done':
      return 'success';
    case 'error':
      return 'error';
    case 'cancelled':
      return 'neutral';
    default:
      return 'pending';
  }
}

export interface ToolLineProps {
  status: Status;
  name: string;
  detail?: ReactNode;
  tree?: TreeNode[];
}

/** Compact tool call: `[x] Read src/server.ts:1-40`, optionally followed by a result tree. */
export function ToolLine({ status, name, detail, tree }: ToolLineProps) {
  return (
    <Box flexDirection="column">
      <Text>
        <StatusMark status={status} /> <Text bold>{name}</Text>
        {detail !== undefined && <Text> {detail}</Text>}
      </Text>
      {tree && tree.length > 0 && <Tree nodes={tree} />}
    </Box>
  );
}

export interface ShellBlockProps {
  command: string;
  output: string[];
  status: Status;
  /** Shown under the output, e.g. `[Wall: 1.2s | Timeout: 120s]`. */
  footer?: ReactNode;
  tail?: number;
  /** The output down to how many lines it has, as once the turn that ran the command is over. */
  folded?: boolean;
}

export function ShellBlock({ command, output, status, footer, tail, folded }: ShellBlockProps) {
  const theme = useTheme();
  const hasOutput = output.length > 0 || footer !== undefined;

  return (
    <Frame tone={toneOf(status)}>
      <ShellCommand command={command} />
      {hasOutput && <FrameDivider title="Output" />}
      {output.length > 0 &&
        (folded ? (
          <ExpandHint>{`+${output.length} ${output.length === 1 ? 'line' : 'lines'}`}</ExpandHint>
        ) : (
          <OutputLines lines={output} tail={tail} />
        ))}
      {footer !== undefined && <Text color={status === 'error' ? theme.error : theme.muted}>{footer}</Text>}
    </Frame>
  );
}

export interface EditBlockProps {
  path: string;
  patch: string;
  status: Status;
  verb?: string;
}

/** `+--- ~ Edit: ts src/server.ts [+3/-1] ---+` followed by the diff. */
export function EditBlock({ path, patch, status, verb = 'Edit' }: EditBlockProps) {
  const theme = useTheme();
  const { added, removed } = useMemo(() => countChanges(parsePatch(patch)), [patch]);
  const language = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : 'txt';

  const title = (
    <Text>
      <Text color={theme.warning}>~</Text> {verb}: <Text color={theme.muted}>{language}</Text>{' '}
      <Text color={theme.code}>{path}</Text>{' '}
      <Text color={theme.muted}>
        [<Text color={theme.diff.added}>+{added}</Text>/<Text color={theme.diff.removed}>-{removed}</Text>]
      </Text>
    </Text>
  );

  return (
    <Frame tone={toneOf(status)} title={title}>
      <Diff patch={patch} />
    </Frame>
  );
}
