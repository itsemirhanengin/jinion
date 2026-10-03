import { memo } from 'react';
import {
  AskResult,
  Box,
  Clickable,
  EditBlock,
  Expandable,
  ExpandHint,
  FRAME_INSET,
  Frame,
  Markdown,
  Notice,
  parsePatch,
  printable,
  ShellBlock,
  StatusMark,
  Text,
  Thinking,
  TodoBlock,
  ToolLine,
  toneOf,
  UserMessage,
  useAnimation,
  useContentWidth,
  useHovered,
  usePanels,
  useTheme,
  useView,
  type TreeNode,
} from '@jinion/tui';
import type { FileRef, ToolRun } from '../agent/types.js';
import { compact } from '../usage/format.js';
import { useConversation } from '../context.js';
import { DiffPanel } from '../panels/diff.js';
import type { ChangedFile, Entry, ToolCallEntry } from '../session.js';
import { Banner } from './banner.js';

type ToolEntry = Extract<Entry, { kind: 'tool' }>;

const MAX_TREE_ITEMS = 6;

/** Lines of a diff shown before a click shows the rest, as `Diff` does by default. */
const DIFF_PREVIEW_LINES = 24;

/** A subagent's latest calls shown while it works; earlier ones are counted. */
const LIVE_CALLS = 6;

const MEMORY_VERBS = { remember: 'Remember', recall: 'Recall', forget: 'Forget' } as const;

export interface EntryViewProps {
  entry: Entry;
  /** The entry came in the turn still running: a command's output stays open until the turn ends. */
  live?: boolean;
}

/**
 * Entries are immutable, so unchanged ones skip re-rendering while the newest one streams. Those with more to show than
 * they do open and close on a click, each on its own.
 */
export const EntryView = memo(function EntryView({ entry, live = false }: EntryViewProps) {
  // A pending question lives in the AskPanel at the bottom until it is answered.
  if (entry.kind === 'tool' && entry.run.name === 'ask' && entry.status === 'running') return null;

  const fullWidth =
    entry.kind === 'banner' ||
    entry.kind === 'user' ||
    entry.kind === 'changes' ||
    (entry.kind === 'tool' && ['bash', 'edit', 'todo', 'ask', 'plan'].includes(entry.run.name));

  const body = <EntryBody entry={entry} live={live} />;
  return (
    <Box flexDirection="column" marginTop={1} paddingX={fullWidth ? 0 : 1}>
      {expandable(entry) ? (
        <Expandable id={entry.id} fit={fitsText(entry)}>
          {body}
        </Expandable>
      ) : (
        body
      )}
    </Box>
  );
});

/**
 * Entries a click shows more of: thinking, a command's output, a diff longer than its preview, a subagent's calls, a
 * pasted prompt in full, a summary. Only these light up under the pointer.
 */
function expandable(entry: Entry) {
  switch (entry.kind) {
    case 'thinking':
      return true;
    case 'tool':
      switch (entry.run.name) {
        case 'bash':
          return entry.output.length > 0;
        case 'edit':
          return parsePatch(entry.run.result?.patch ?? entry.run.input.patch).length > DIFF_PREVIEW_LINES;
        case 'agent':
          return (entry.children?.length ?? 0) > 0;
        default:
          return false;
      }
    case 'user':
      return entry.prompt !== undefined;
    case 'compaction':
      return entry.summary !== undefined;
    default:
      return false;
  }
}

/** Entries drawn as lines of text light up as far as their text goes; frames and messages keep their full width. */
const fitsText = (entry: Entry) =>
  entry.kind === 'thinking' || entry.kind === 'compaction' || (entry.kind === 'tool' && entry.run.name === 'agent');

function EntryBody({ entry, live }: { entry: Entry; live: boolean }) {
  const { expanded } = useView();
  switch (entry.kind) {
    case 'banner':
      return <Banner />;
    case 'user':
      return <UserEntry text={expanded && entry.prompt ? entry.prompt : entry.text} steered={entry.steered} />;
    case 'thinking': {
      // Shown as it comes, then down to one line once the agent moved on, as in Claude Code.
      const folded = !expanded && (entry.endedAt !== undefined || !live);
      const took = entry.startedAt !== undefined && entry.endedAt !== undefined ? thoughtFor(entry.endedAt - entry.startedAt) : undefined;
      return <Thinking text={entry.text} folded={folded} took={took} />;
    }
    case 'text':
      return <Markdown text={entry.text} />;
    case 'notice':
      return <Notice text={entry.text} tone={entry.tone} />;
    case 'task':
      return <TaskEnd entry={entry} />;
    case 'compaction':
      return <Compaction entry={entry} />;
    case 'changes':
      return <ChangesCard entry={entry} />;
    case 'tool':
      return <ToolView entry={entry} live={live} />;
  }
}

/** Files listed on a turn's card before the rest is counted; a click on the count opens them all in `/diff`. */
const CARD_FILES = 8;

/**
 * What a turn changed, at its end, as Cursor shows it: each file with the lines it gained and lost. A click on a file
 * opens its diff in `/diff`, in the view of that turn.
 */
function ChangesCard({ entry }: { entry: Extract<Entry, { kind: 'changes' }> }) {
  const theme = useTheme();
  const panels = usePanels();
  const width = useContentWidth();
  const open = (file?: string) =>
    panels.open({ id: 'diff', placement: 'fullscreen', element: <DiffPanel turn={entry.turn} file={file} /> });
  const shown = entry.files.slice(0, CARD_FILES);
  const more = entry.files.length - shown.length;
  const total = {
    path: '',
    created: false,
    added: entry.files.reduce((sum, file) => sum + file.added, 0),
    removed: entry.files.reduce((sum, file) => sum + file.removed, 0),
  };
  // The paths in one column, as long as the longest, leaving room for the counts after them.
  const pathWidth = Math.min(Math.max(...shown.map((file) => file.path.length)) + 2, Math.max(10, width - FRAME_INSET - 16));

  return (
    <Frame
      title={
        <Text>
          <Text bold>{plural(entry.files.length, 'file')} changed</Text> <LineCounts file={total} />
        </Text>
      }
    >
      {shown.map((file) => (
        <Clickable key={file.path} id={`${entry.id}:${file.path}`} fit onClick={() => open(file.path)}>
          <Box>
            <Box width={pathWidth} flexShrink={0}>
              <Text color={theme.code} wrap="truncate-start">
                {file.path}
              </Text>
            </Box>
            <LineCounts file={file} column={entry.files.some((other) => other.created)} />
          </Box>
        </Clickable>
      ))}
      {more > 0 && (
        <Clickable id={`${entry.id}:more`} fit onClick={() => open()}>
          <ExpandHint>{`+${plural(more, 'more file')}`}</ExpandHint>
        </Clickable>
      )}
    </Frame>
  );
}

/** `new +29`, `+2 -1`, as `/diff` lists them; in a `column`, `new` takes its place on every line so the counts line up. */
function LineCounts({ file, column = false }: { file: ChangedFile; column?: boolean }) {
  const theme = useTheme();
  return (
    <Text>
      {(file.created || column) && <Text color={theme.muted}>{file.created ? 'new ' : '    '}</Text>}
      {file.added > 0 && <Text color={theme.diff.added}>+{file.added}</Text>}
      {file.added > 0 && file.removed > 0 && ' '}
      {file.removed > 0 && <Text color={theme.diff.removed}>-{file.removed}</Text>}
    </Text>
  );
}

/** Where the conversation was summarized: how much it held before and after; the summary on a click. */
function Compaction({ entry }: { entry: Extract<Entry, { kind: 'compaction' }> }) {
  const theme = useTheme();
  const { expanded } = useView();
  const hovered = useHovered();
  const tokens = `${compact(entry.before)}${entry.after !== undefined ? ` → ${compact(entry.after)}` : ''} tokens`;
  return (
    <Box flexDirection="column">
      <ToolLine
        status="done"
        name="Compacted"
        detail={
          <Text color={hovered ? undefined : theme.muted}>
            {'· '}
            {tokens}
            {entry.trigger === 'auto' && ' · on its own, as the context filled'}
          </Text>
        }
      />
      {expanded && entry.summary && (
        <Box marginTop={1} paddingLeft={4}>
          <Markdown text={entry.summary} />
        </Box>
      )}
    </Box>
  );
}

const TASK_MARKS = { running: 'running', completed: 'done', failed: 'error', stopped: 'cancelled' } as const;

/** A background task that ended: what it was, how, and how long it ran. */
function TaskEnd({ entry }: { entry: Extract<Entry, { kind: 'task' }> }) {
  const theme = useTheme();
  const { task, summary } = entry;
  const took = formatSeconds((task.endedAt ?? Date.now()) - task.startedAt);
  // Claude Code's summary of a command repeats it; the exit code is what it adds.
  const exitCode = /exit code (\d+)/.exec(summary ?? '')?.[1];
  const how =
    task.status === 'failed' ? `failed after ${took}${exitCode ? ` · exit ${exitCode}` : ''}` : task.status === 'stopped' ? `stopped after ${took}` : `done in ${took}`;
  return (
    <ToolLine
      status={TASK_MARKS[task.status]}
      name={task.kind === 'agent' ? 'Background agent' : 'Background'}
      detail={
        <Text>
          <Text color={task.kind === 'shell' ? theme.code : undefined}>{printable(task.title.split('\n')[0]!)}</Text>
          <Text color={task.status === 'failed' ? theme.error : theme.muted}> · {how}</Text>
        </Text>
      }
    />
  );
}

/** Skills show highlighted, as they were in the prompt. */
function UserEntry({ text, steered }: { text: string; steered?: boolean }) {
  const { mention } = useConversation();
  return <UserMessage text={text} mentions={[mention]} aside={steered ? 'while working' : undefined} />;
}

function ToolView({ entry, live }: { entry: ToolEntry; live: boolean }) {
  const theme = useTheme();
  const { expanded } = useView();
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
          // Open to follow while the turn runs, down to its line count once it is over.
          folded={!live && !expanded && status !== 'running'}
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
          detail={<Text color={theme.muted}>{printable(run.input.detail)}</Text>}
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
          detail={run.input.detail && <Text color={theme.muted}>{printable(run.input.detail)}</Text>}
        />
      );
    case 'agent':
      return <AgentView entry={entry} />;
  }
}

/**
 * A subagent: its tool calls as a tree while it works, the latest few in view; once it is done, how many it made and
 * how long it took, with the whole tree on a click.
 */
function AgentView({ entry }: { entry: ToolEntry }) {
  const theme = useTheme();
  const { expanded } = useView();
  const hovered = useHovered();
  const { tasks } = useConversation();
  if (entry.run.name !== 'agent') return null;
  // Sent to the background, it works on after its call ended, as its task says.
  const background = entry.run.result?.background;
  const task = background ? tasks.find((candidate) => candidate.id === background) : undefined;
  const status = task?.status === 'running' ? 'running' : entry.status;
  const calls = entry.children ?? [];
  let tree: TreeNode[];
  if (status === 'running' || expanded) {
    const shown = expanded ? calls : calls.slice(-LIVE_CALLS);
    tree = shown.map((call) => ({ label: <CallLine call={call} /> }));
    if (shown.length < calls.length) tree.unshift({ label: <Text color={theme.muted}>… {calls.length - shown.length} earlier</Text> });
  } else {
    const took = formatSeconds((task?.endedAt ?? entry.endedAt ?? Date.now()) - entry.startedAt);
    tree = [{ label: <Text color={hovered ? undefined : theme.muted}>{`${plural(calls.length, 'tool call')} · ${took}`}</Text> }];
  }
  return (
    <ToolLine
      status={status}
      name="Agent"
      detail={
        <Text>
          <Text color={theme.muted}>· </Text>
          {entry.run.input.description}
          {background && <Text color={theme.muted}> · in the background</Text>}
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
      {detail && <Text color={theme.muted}> {printable(detail)}</Text>}
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
  if (entry.run.result?.background) return <BackgroundState id={entry.run.result.background} />;

  const timeout = `Timeout: ${formatSeconds(entry.run.input.timeoutMs)}`;
  if (running && entry.waiting) return <>[Waiting for your approval | {timeout}]</>;
  // A command asked about runs from when it was allowed.
  const started = entry.approvedAt ?? entry.startedAt;
  if (running) return <>[Running: {formatSeconds(Date.now() - started)} | {timeout}]</>;

  const took = entry.approvedAt ? (entry.endedAt ?? Date.now()) - entry.approvedAt : (entry.run.result?.wallMs ?? (entry.endedAt ?? Date.now()) - started);
  const wall = `Wall: ${formatSeconds(took)}`;
  const exitCode = entry.run.result?.exitCode;
  if (entry.status === 'cancelled') return <>[Cancelled | {wall}]</>;
  return <>[{exitCode ? `Exit: ${exitCode} | ` : ''}{wall} | {timeout}]</>;
}

/** A command that went on in the background, as its task is now. */
function BackgroundState({ id }: { id: string }) {
  const { tasks } = useConversation();
  const task = tasks.find((candidate) => candidate.id === id);
  if (!task || task.status === 'running') return <>[In the background | ctrl+t to see it]</>;
  return <>[In the background | {task.status === 'completed' ? 'done' : task.status}]</>;
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

/** `Thought for 12s` or `Thought for 2m 5s`, in whole seconds as Claude Code says it. */
function thoughtFor(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${total % 60}s`;
}

function formatSeconds(ms: number) {
  const seconds = ms / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(2)}s`;
}
