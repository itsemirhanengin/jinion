import { Box, printable, StatusMark, Text, useAnimation, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { backgroundTasksAtom } from '../state/session.js';
import { elapsed } from '@jinion/core/lib/format';
import { firstLine } from '@jinion/core/lib/text';
import { TASK_MARKS } from '../ui/task-marks.js';

const RECENT_MS = 60_000;

export function TaskLine() {
  const theme = useTheme();
  const tasks = useAtomValue(backgroundTasksAtom);

  const running = tasks.some((task) => task.status === 'running');
  const shown = tasks.filter((task) => task.status === 'running' || Date.now() - (task.endedAt ?? 0) < RECENT_MS);

  useAnimation({ interval: 1000, isActive: running });

  if (!running) return null;

  return (
    <Box marginTop={1} paddingX={1}>
      <Text wrap="truncate-end">
        <Text color={theme.muted}>bg </Text>
        {shown.map((task, index) => (
          <Text key={task.id}>
            {index > 0 && <Text color={theme.muted}> · </Text>}
            <StatusMark status={TASK_MARKS[task.status]} /> {printable(firstLine(task.title))}
            {task.status === 'running' && <Text color={theme.muted}> {elapsed(Date.now() - task.startedAt)}</Text>}
          </Text>
        ))}
        <Text color={theme.muted}> · ctrl+t</Text>
      </Text>
    </Box>
  );
}
