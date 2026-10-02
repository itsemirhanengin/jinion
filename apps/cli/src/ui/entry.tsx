import { memo } from 'react';
import {
  AskResult,
  Box,
  EditBlock,
  Markdown,
  Notice,
  ShellBlock,
  Text,
  Thinking,
  TodoBlock,
  ToolLine,
  UserMessage,
  useAnimation,
  useTheme,
  type TreeNode,
} from '@jinion/tui';
import type { FileRef } from '../agent/types.js';
import type { Entry } from '../session.js';
import { Banner } from './banner.js';

type ToolEntry = Extract<Entry, { kind: 'tool' }>;

const MAX_TREE_ITEMS = 6;

/** Entries are immutable, so unchanged ones skip re-rendering while the newest one streams. */
export const EntryView = memo(function EntryView({ entry }: { entry: Entry }) {
  // A pending question lives in the AskPanel at the bottom until it is answered.
  if (entry.kind === 'tool' && entry.run.name === 'ask' && entry.status === 'running') return null;

  const fullWidth =
    entry.kind === 'banner' ||
    entry.kind === 'user' ||
    (entry.kind === 'tool' && ['bash', 'edit', 'todo', 'ask'].includes(entry.run.name));

  return (
    <Box flexDirection="column" marginTop={1} paddingX={fullWidth ? 0 : 1}>
      <EntryBody entry={entry} />
    </Box>
  );
});

function EntryBody({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case 'banner':
      return <Banner />;
    case 'user':
      return <UserMessage text={entry.text} />;
    case 'thinking':
      return <Thinking text={entry.text} />;
    case 'text':
      return <Markdown text={entry.text} />;
    case 'notice':
      return <Notice text={entry.text} tone={entry.tone} />;
    case 'tool':
      return <ToolView entry={entry} />;
  }
}

function ToolView({ entry }: { entry: ToolEntry }) {
  const theme = useTheme();
  const { run, status } = entry;

  switch (run.name) {
    case 'read': {
      const { files } = run.input;
      if (files.length === 1) return <ToolLine status={status} name="Read" detail={<FileLabel file={files[0]!} />} />;
      return (
        <ToolLine
          status={status}
          name={`Read (${files.length})`}
          tree={files.map((file) => ({ label: <FileLabel file={file} /> }))}
        />
      );
    }
    case 'grep': {
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
                {match.text}
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
    case 'glob': {
      const files = run.result?.files ?? [];
      const tree: TreeNode[] = files.slice(0, MAX_TREE_ITEMS).map((file) => ({
        label: (
          <Text>
            <Text color={theme.muted}>{extension(file)}</Text> {file}
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
    case 'bash':
      return (
        <ShellBlock
          command={run.input.command}
          output={entry.output}
          status={status}
          footer={<ShellFooter entry={entry} />}
        />
      );
    case 'edit':
      return (
        <EditBlock
          path={run.input.path}
          patch={run.result?.patch ?? run.input.patch}
          status={status}
          verb={run.input.created ? 'Write' : 'Edit'}
        />
      );
    case 'todo':
      return <TodoBlock groups={run.input.groups} status={status} />;
    case 'ask':
      return (
        <AskResult questions={run.input.questions} answers={run.result?.answers ?? []} cancelled={status === 'cancelled'} />
      );
    case 'other':
      return (
        <ToolLine
          status={status}
          name={run.input.title}
          detail={run.input.detail && <Text color={theme.muted}>{run.input.detail}</Text>}
        />
      );
  }
}

function ShellFooter({ entry }: { entry: ToolEntry }) {
  const running = entry.status === 'running';
  useAnimation({ interval: 100, isActive: running });
  if (entry.run.name !== 'bash') return null;

  const timeout = `Timeout: ${formatSeconds(entry.run.input.timeoutMs)}`;
  if (running) return <>[Running: {formatSeconds(Date.now() - entry.startedAt)} | {timeout}]</>;

  const wall = `Wall: ${formatSeconds(entry.run.result?.wallMs ?? (entry.endedAt ?? Date.now()) - entry.startedAt)}`;
  const exitCode = entry.run.result?.exitCode;
  if (entry.status === 'cancelled') return <>[Cancelled | {wall}]</>;
  return <>[{exitCode ? `Exit: ${exitCode} | ` : ''}{wall} | {timeout}]</>;
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

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const extension = (path: string) => (path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : '-');

function formatSeconds(ms: number) {
  const seconds = ms / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(2)}s`;
}
