import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { useEffect, useState } from 'react';
import {
  Box,
  ChoiceList,
  choiceIndent,
  Panel,
  StatusMark,
  Text,
  useAnimation,
  useChoiceList,
  useInput,
  usePanel,
  usePanels,
  useTheme,
  useWindowSize,
  type Choice,
  type Status,
} from '@jinion/tui';
import type { BackgroundTask } from '../agent/types.js';
import { useJinion } from '../context.js';

const VISIBLE = 8;
/** Lines of the focused task's output shown under it. */
const TAIL_LINES = 6;
/** Rows the full output view takes around the lines: edges, header and hints. */
const CHROME_ROWS = 6;
/** How often a running task's output is read again. */
const POLL_MS = 500;
/** The end of the output is what matters; a dev server can write a lot. */
const MAX_BYTES = 256 * 1024;

const MARKS: Record<BackgroundTask['status'], Status> = { running: 'running', completed: 'done', failed: 'error', stopped: 'cancelled' };

/** Tasks the user sees: the ones in the background, not a command the turn still waits for. */
export const backgroundTasks = (tasks: BackgroundTask[]) => tasks.filter((task) => !task.foreground);

/** How long a task that ended stays in the line above the prompt, next to ones still running. */
const RECENT_MS = 60_000;

/** Above the prompt while something runs in the background: what, for how long, and how to see it. */
export function TaskLine({ tasks }: { tasks: BackgroundTask[] }) {
  const theme = useTheme();
  const running = backgroundTasks(tasks).some((task) => task.status === 'running');
  useAnimation({ interval: 1000, isActive: running });
  if (!running) return null;
  const shown = backgroundTasks(tasks).filter((task) => task.status === 'running' || Date.now() - (task.endedAt ?? 0) < RECENT_MS);
  return (
    <Box marginTop={1} paddingX={1}>
      <Text wrap="truncate-end">
        <Text color={theme.muted}>bg </Text>
        {shown.map((task, index) => (
          <Text key={task.id}>
            {index > 0 && <Text color={theme.muted}> · </Text>}
            <StatusMark status={MARKS[task.status]} /> {task.title.split('\n')[0]}
            {task.status === 'running' && <Text color={theme.muted}> {duration(Date.now() - task.startedAt)}</Text>}
          </Text>
        ))}
        <Text color={theme.muted}> · ctrl+t</Text>
      </Text>
    </Box>
  );
}

/** `/tasks` and ctrl+t: the background tasks, the focused one's latest output under it; x stops one. */
export function TasksPanel() {
  const app = useJinion();
  const theme = useTheme();
  const panels = usePanels();
  const { close } = usePanel();
  useAnimation({ interval: 1000 });
  const tasks = backgroundTasks(app.tasks);
  const list = useChoiceList({
    keys: tasks.map((task) => task.id),
    mode: 'single',
    onCancel: close,
    onSubmit: ([id]) => {
      const task = tasks.find((candidate) => candidate.id === id);
      if (task?.output) panels.open({ id: 'task-output', placement: 'fullscreen', element: <TaskOutput id={task.id} /> });
    },
  });
  const focused = tasks.find((task) => task.id === list.focus);

  useInput((input) => {
    if (input === 'x' && focused?.status === 'running') app.actions.stopTask(focused.id);
  });

  const choices: Choice[] = tasks.map((task) => ({
    key: task.id,
    label: (
      <Text wrap="truncate-end">
        <StatusMark status={MARKS[task.status]} /> {task.kind === 'agent' && <Text color={theme.muted}>Agent · </Text>}
        {task.title.split('\n')[0]}
      </Text>
    ),
    aside: <TaskTime task={task} />,
    editor: <TaskDetails task={task} indent={choiceIndent(list)} />,
  }));

  const running = tasks.filter((task) => task.status === 'running').length;
  return (
    <Panel
      title="Background tasks"
      subtitle={tasks.length > 0 ? `${running} running` : undefined}
      hints={[
        ...(focused?.output ? ([['Enter', 'output']] as [string, string][]) : []),
        ...(focused?.status === 'running' ? ([['x', 'stop']] as [string, string][]) : []),
        ['Up/Down', 'move'],
        ['Esc', 'close'],
      ]}
    >
      <ChoiceList
        list={list}
        choices={choices}
        limit={VISIBLE}
        empty="Nothing runs in the background. The agent starts commands there that keep running, like a dev server, and ctrl+b sends the command it waits for there."
      />
    </Panel>
  );
}

function TaskTime({ task }: { task: BackgroundTask }) {
  const theme = useTheme();
  const took = duration((task.endedAt ?? Date.now()) - task.startedAt);
  switch (task.status) {
    case 'running':
      return <Text color={theme.muted}>{took}</Text>;
    case 'completed':
      return <Text color={theme.muted}>done in {took}</Text>;
    case 'failed':
      return <Text color={theme.error}>failed after {took}</Text>;
    case 'stopped':
      return <Text color={theme.muted}>stopped after {took}</Text>;
  }
}

/** Under the focused task: a command's latest output, or what a subagent is doing. */
function TaskDetails({ task, indent }: { task: BackgroundTask; indent: number }) {
  const theme = useTheme();
  const lines = useOutput(task.output, task.status === 'running');
  if (task.kind === 'agent') {
    const calls = task.calls ?? 0;
    return (
      <Box paddingLeft={indent} marginBottom={1}>
        <Text color={theme.muted} wrap="truncate-end">
          {calls === 1 ? '1 tool call' : `${calls} tool calls`}
          {task.lastCall && ` · ${task.lastCall}`}
        </Text>
      </Box>
    );
  }
  if (!task.output) return null;
  const tail = lines?.slice(-TAIL_LINES) ?? [];
  return (
    <Box flexDirection="column" paddingLeft={indent} marginBottom={1}>
      {tail.length === 0 ? (
        <Text color={theme.muted}>{lines ? 'No output yet.' : 'Reading the output…'}</Text>
      ) : (
        tail.map((line, index) => (
          <Text key={index} color={theme.muted} wrap="truncate-end">
            {line || ' '}
          </Text>
        ))
      )}
    </Box>
  );
}

/** A task's whole output, full screen, following the end while it runs unless scrolled up. */
function TaskOutput({ id }: { id: string }) {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const { rows: height } = useWindowSize();
  const task = app.tasks.find((candidate) => candidate.id === id);
  const lines = useOutput(task?.output, task?.status === 'running') ?? [];
  const view = Math.max(3, height - CHROME_ROWS);
  const last = Math.max(0, lines.length - view);
  // `undefined` follows the end.
  const [top, setTop] = useState<number>();
  const shown = top ?? last;

  useInput((input, key) => {
    if (key.escape) return close();
    if (input === 'x' && task?.status === 'running') return app.actions.stopTask(task.id);
    const step = key.pageDown ? view : key.pageUp ? -view : key.downArrow ? 1 : key.upArrow ? -1 : 0;
    if (!step) return;
    const next = Math.min(last, Math.max(0, shown + step));
    setTop(next >= last ? undefined : next);
  });

  if (!task) return null;
  const range = lines.length > view ? ` · lines ${shown + 1}-${Math.min(lines.length, shown + view)} of ${lines.length}` : '';
  return (
    <Panel
      title="Output"
      subtitle={`${task.title.split('\n')[0]}${range}`}
      grow
      hints={[
        ['Up/Down', 'scroll'],
        ['PgUp/PgDn', 'page'],
        ...(task.status === 'running' ? ([['x', 'stop']] as [string, string][]) : []),
        ['Esc', 'back'],
      ]}
    >
      {lines.length === 0 ? (
        <Text color={theme.muted}>No output yet.</Text>
      ) : (
        lines.slice(shown, shown + view).map((line, index) => (
          <Text key={shown + index} wrap="truncate-end">
            {line || ' '}
          </Text>
        ))
      )}
    </Panel>
  );
}

/** The lines of an output file, read again while `live`; `undefined` until read. */
function useOutput(path: string | undefined, live: boolean) {
  const [lines, setLines] = useState<string[]>();
  useEffect(() => {
    if (!path) return;
    const read = () => setLines(readOutput(path));
    read();
    if (!live) return;
    const timer = setInterval(read, POLL_MS);
    return () => clearInterval(timer);
  }, [path, live]);
  return lines;
}

/** The end of an output file as lines, without color codes, and progress bars as their latest state. */
export function readOutput(path: string, maxBytes = MAX_BYTES) {
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    let text = buffer.toString('utf8');
    // A cut at the start leaves half a line.
    if (length < size) text = text.slice(text.indexOf('\n') + 1);
    return text
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => line.slice(line.lastIndexOf('\r') + 1));
  } catch {
    return [];
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** `12s`, `3m 5s`, `1h 4m`. */
export function duration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
