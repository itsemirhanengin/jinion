import {
  Box,
  ChoiceList,
  choiceIndent,
  Panel,
  printable,
  StatusMark,
  Text,
  useAnimation,
  useChoiceList,
  useInput,
  usePanel,
  usePanels,
  useTheme,
  type Choice,
  type KeyHint,
} from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { backgroundTasksAtom } from '../../state/session.js';
import type { BackgroundTask } from '@jinion/core/agent/tasks';
import { useApi } from '../../app/api.js';
import { elapsed, plural } from '@jinion/core/lib/format';
import { firstLine } from '@jinion/core/lib/text';
import { TASK_MARKS } from '../../ui/task-marks.js';
import { useOutput } from './output.js';
import { TaskOutput } from './task-output.js';

const VISIBLE = 8;
const TAIL_LINES = 6;

export function TasksPanel() {
  const api = useApi();
  const theme = useTheme();
  const { close } = usePanel();
  const panels = usePanels();
  const tasks = useAtomValue(backgroundTasksAtom);

  useAnimation({ interval: 1000 });

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

  const choices: Choice[] = tasks.map((task) => ({
    key: task.id,
    label: (
      <Text wrap="truncate-end">
        <StatusMark status={TASK_MARKS[task.status]} /> {task.kind === 'agent' && <Text color={theme.muted}>Agent · </Text>}
        {printable(firstLine(task.title))}
      </Text>
    ),
    aside: <TaskTime task={task} />,
    editor: <TaskDetails task={task} indent={choiceIndent(list)} />,
  }));

  const hints: KeyHint[] = [
    ...(focused?.output ? ([['Enter', 'output']] as KeyHint[]) : []),
    ...(focused?.status === 'running' ? ([['x', 'stop']] as KeyHint[]) : []),
    ['Up/Down', 'move'],
    ['Esc', 'close'],
  ];

  const running = tasks.filter((task) => task.status === 'running').length;

  useInput((input) => {
    if (input === 'x' && focused?.status === 'running') api.act(api.inSession('session/stop-task', { task: focused.id }));
  });

  return (
    <Panel title="Background tasks" subtitle={tasks.length > 0 ? `${running} running` : undefined} hints={hints}>
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

  const took = elapsed((task.endedAt ?? Date.now()) - task.startedAt);

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

function TaskDetails({ task, indent }: { task: BackgroundTask; indent: number }) {
  const theme = useTheme();

  const lines = useOutput(task.output === undefined ? undefined : task.id, task.status === 'running');

  if (task.kind === 'agent') {
    return (
      <Box paddingLeft={indent} marginBottom={1}>
        <Text color={theme.muted} wrap="truncate-end">
          {plural(task.calls ?? 0, 'tool call')}
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
