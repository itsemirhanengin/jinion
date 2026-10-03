import { useMemo, type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { Frame, FrameDivider } from '../primitives/frame.js';
import { StatusMark, toneOf, type Status } from '../primitives/spinner.js';
import { Tree, type TreeNode } from '../primitives/tree.js';
import { countChanges, Diff, parsePatch } from '../content/diff.js';
import { ExpandHint, OutputLines } from '../content/output.js';
import { ShellCommand } from '../content/shell.js';
import { extension } from '../utils/extension.js';
import { plural } from '../utils/plural.js';

export interface ToolLineProps {
  status: Status;
  name: string;
  detail?: ReactNode;
  tree?: TreeNode[];
}

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
  footer?: ReactNode;
  tail?: number;
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
          <ExpandHint>{`+${plural(output.length, 'line')}`}</ExpandHint>
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

export function EditBlock({ path, patch, status, verb = 'Edit' }: EditBlockProps) {
  const theme = useTheme();
  const { added, removed } = useMemo(() => countChanges(parsePatch(patch)), [patch]);
  const language = extension(path) ?? 'txt';

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
