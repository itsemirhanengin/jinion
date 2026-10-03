import { Box, Text, usePanels, useTheme } from '@jinion/tui';
import { TodoPanel, Working } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { tasksAtom } from '../state/agent.js';
import { queueAtom } from '../state/prompt.js';
import { sessionAtom, todosAtom } from '../state/session.js';
import { activity, hasWorkLeft } from './activity.js';
import { TaskLine } from './task-line.js';

export function Aside() {
  const todos = useAtomValue(todosAtom);
  return (
    <>
      <Activity />
      {hasWorkLeft(todos) && (
        <Box marginTop={1} flexDirection="column">
          <TodoPanel groups={todos} />
        </Box>
      )}
      <TaskLine />
      <Queue />
    </>
  );
}

function Activity() {
  const session = useAtomValue(sessionAtom);
  const tasks = useAtomValue(tasksAtom);
  const { top } = usePanels();
  if (session.busySince === undefined) return null;
  return (
    <Box marginTop={1}>
      <Working label={activity(session, top?.id, tasks)} since={session.busySince} />
    </Box>
  );
}

function Queue() {
  const theme = useTheme();
  const queued = useAtomValue(queueAtom);
  if (queued.length === 0) return null;
  return (
    <Box marginTop={1} flexDirection="column" paddingX={1}>
      {queued.map((text, index) => (
        <Text key={index} color={theme.muted} wrap="truncate-end">
          queued: {text}
        </Text>
      ))}
    </Box>
  );
}
