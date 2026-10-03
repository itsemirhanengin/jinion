import { memo } from 'react';
import {
  AskResult,
  Box,
  EditBlock,
  Frame,
  Markdown,
  Notice,
  ShellBlock,
  StatusMark,
  Text,
  Thinking,
  TodoBlock,
  ToolLine,
  toneOf,
  UserMessage,
  useAnimation,
  useTheme,
  useView,
  type TreeNode,
} from '@jinion/tui';
import type { FileRef, ToolRun } from '../agent/types.js';
import { useJinion } from '../context.js';
import type { Entry, ToolCallEntry } from '../session.js';
import { Banner } from './banner.js';

type ToolEntry = Extract<Entry, { kind: 'tool' }>;

const MAX_TREE_ITEMS = 6;

/** A subagent's latest calls shown while it works; earlier ones are counted. */
const LIVE_CALLS = 6;

const MEMORY_VERBS = { remember: 'Remember', recall: 'Recall', forget: 'Forget' } as const;

/** Entries are immutable, so unchanged ones skip re-rendering while the newest one streams. */
export const EntryView = memo(function EntryView({ entry }: { entry: Entry }) {
  // A pending question lives in the AskPanel at the bottom until it is answered.
  if (entry.kind === 'tool' && entry.run.name === 'ask' && entry.status === 'running') return null;

  const fullWidth =
    entry.kind === 'banner' ||
    entry.kind === 'user' ||
    (entry.kind === 'tool' && ['bash', 'edit', 'todo', 'ask', 'plan'].includes(entry.run.name));

  return (
    <Box flexDirection="column" marginTop={1} paddingX={fullWidth ? 0 : 1}>
      <EntryBody entry={entry} />
    </Box>
  );
});

function EntryBody({ entry }: { entry: Entry }) {
  const { expanded } = useView();
  switch (entry.kind) {
    case 'banner':
      return <Banner />;
    case 'user':
      return <UserEntry text={expanded && entry.prompt ? entry.prompt : entry.text} steered={entry.steered} />;
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

/** Skills show highlighted, as they were in the prompt. */
function UserEntry({ text, steered }: { text: string; steered?: boolean }) {
  const { skills } = useJinion();
  return <UserMessage text={text} mentions={[skills.mention]} aside={steered ? 'while working' : undefined} />;
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
    case 'memory':
      return (
        <ToolLine
          status={status}
          name={MEMORY_VERBS[run.input.action]}
          detail={<Text color={theme.muted}>{run.input.detail}</Text>}
        />
      );
    case 'plan':
      return (
        <Frame title={<Text bold>Plan</Text>} tone={toneOf(status)} lead={1}>
          <Markdown text={run.input.plan} />
        </Frame>
      );
    case 'other':
      return (
        <ToolLine
          status={status}
          name={run.input.title}
          detail={run.input.detail && <Text color={theme.muted}>{run.input.detail}</Text>}
        />
      );
    case 'agent':
      return <AgentView entry={entry} />;
  }
}

/**
 * A subagent: its tool calls as a tree while it works, the latest few in view; once it is done, how many it made and
 * how long it took, with the whole tree on ctrl+o.
 */
function AgentView({ entry }: { entry: ToolEntry }) {
  const theme = useTheme();
  const { expanded } = useView();
  if (entry.run.name !== 'agent') return null;
  const calls = entry.children ?? [];
  let tree: TreeNode[];
  if (entry.status === 'running' || expanded) {
    const shown = expanded ? calls : calls.slice(-LIVE_CALLS);
    tree = shown.map((call) => ({ label: <CallLine call={call} /> }));
    if (shown.length < calls.length) tree.unshift({ label: <Text color={theme.muted}>… {calls.length - shown.length} earlier</Text> });
  } else {
    const took = formatSeconds((entry.endedAt ?? Date.now()) - entry.startedAt);
    const hint = calls.length > 0 ? ' · ctrl+o to expand' : '';
    tree = [{ label: <Text color={theme.muted}>{`${plural(calls.length, 'tool call')} · ${took}${hint}`}</Text> }];
  }
  return (
    <ToolLine
      status={entry.status}
      name="Agent"
      detail={
        <Text>
          <Text color={theme.muted}>· </Text>
          {entry.run.input.description}
        </Text>
      }
      tree={tree}
    />
  );
}

/** One of a subagent's tool calls, on one line. */
function CallLine({ call }: { call: ToolCallEntry }) {
  const theme = useTheme();
  const [name, detail] = callSummary(call.run);
  return (
    <Text wrap="truncate-end">
      <StatusMark status={call.status} /> <Text bold>{name}</Text>
      {detail && <Text color={theme.muted}> {detail}</Text>}
    </Text>
  );
}

function callSummary(run: ToolRun): [name: string, detail?: string] {
  switch (run.name) {
    case 'read':
      return ['Read', run.input.files.map((file) => file.path).join(', ')];
    case 'grep': {
      const found = run.result && (run.result.files ? plural(run.result.files.length, 'file') : plural(run.result.matches.length, 'match', 'matches'));
      return ['Grep', found ? `${run.input.pattern} · ${found}` : run.input.pattern];
    }
    case 'glob':
      return ['Glob', run.result ? `${run.input.pattern} · ${plural(run.result.files.length, 'file')}` : run.input.pattern];
    case 'bash': {
      const command = run.input.command.split('\n')[0]!;
      return ['Bash', run.result?.exitCode ? `${command} · exit ${run.result.exitCode}` : command];
    }
    case 'edit':
      return [run.input.created ? 'Write' : 'Edit', run.input.path];
    case 'memory':
      return [MEMORY_VERBS[run.input.action], run.input.detail];
    case 'other':
      return [run.input.title, run.input.detail];
    case 'agent':
      return ['Agent', run.input.description];
    case 'todo':
      return ['Tasks'];
    case 'ask':
      return ['Ask'];
    case 'plan':
      return ['Plan'];
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
