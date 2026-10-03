import { extension, printable, Text, useTheme, type Status, type TreeNode } from '@jinion/tui';
import { ToolLine } from '@jinion/tui/chat';
import type { FileRef, ToolRun } from '../../../agent/tools.js';
import { plural } from '../../../lib/format.js';

const MAX_TREE_ITEMS = 6;

type Run<N extends ToolRun['name']> = Extract<ToolRun, { name: N }>;

export function ReadView({ run, status }: { run: Run<'read'>; status: Status }) {
  const { files } = run.input;
  if (files.length === 1) return <ToolLine status={status} name="Read" detail={<FileLabel file={files[0]!} />} />;
  return <ToolLine status={status} name={`Read (${files.length})`} tree={files.map((file) => ({ label: <FileLabel file={file} /> }))} />;
}

export function GrepView({ run, status }: { run: Run<'grep'>; status: Status }) {
  const theme = useTheme();
  const matches = run.result?.matches ?? [];
  const files = run.result?.files ?? [...new Set(matches.map((match) => match.file))];
  const tree: TreeNode[] = files.map((file) => ({
    label: <Text color={theme.code}>{file}</Text>,
    children: matches
      .filter((match) => match.file === file)
      .map((match) => ({
        label: (
          <Text>
            <Text color={theme.muted}>{match.line}|</Text>
            {printable(match.text)}
          </Text>
        ),
      })),
  }));
  return (
    <ToolLine
      status={status}
      name="Grep:"
      detail={
        <Text>
          <Text color={theme.code}>{run.input.pattern}</Text>
          {run.result && (
            <Text color={theme.muted}>
              {' '}
              {run.result.files ? '' : `${plural(matches.length, 'match', 'matches')} - `}
              {plural(files.length, 'file')} - in {run.input.path}
            </Text>
          )}
        </Text>
      }
      tree={tree}
    />
  );
}

export function GlobView({ run, status }: { run: Run<'glob'>; status: Status }) {
  const theme = useTheme();
  const files = run.result?.files ?? [];
  const tree: TreeNode[] = files.slice(0, MAX_TREE_ITEMS).map((file) => ({
    label: (
      <Text>
        <Text color={theme.muted}>{extension(file) ?? '-'}</Text> {file}
      </Text>
    ),
  }));
  if (files.length > MAX_TREE_ITEMS) {
    tree.push({ label: <Text color={theme.muted}>… {files.length - MAX_TREE_ITEMS} more files</Text> });
  }
  return (
    <ToolLine
      status={status}
      name="Glob:"
      detail={
        <Text>
          <Text color={theme.code}>{run.input.pattern}</Text>
          {run.result && <Text color={theme.muted}> {plural(files.length, 'file')}</Text>}
        </Text>
      }
      tree={tree}
    />
  );
}

function FileLabel({ file }: { file: FileRef }) {
  const theme = useTheme();
  return (
    <Text color={theme.code}>
      {file.path}
      {file.lines && <Text color={theme.muted}>:{file.lines}</Text>}
    </Text>
  );
}
