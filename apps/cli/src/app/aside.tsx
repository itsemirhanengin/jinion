import { dialogAtom, tasksAtom, queueAtom, sessionAtom, todosAtom } from '../state/session.js';
import { Box, Text, useTheme } from '@jinion/tui';
import { TodoPanel, Working } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
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
  const dialog = useAtomValue(dialogAtom);

  if (session.busySince === undefined) return null;

  return (
    <Box marginTop={1}>
      <Working label={activity(session, dialog?.id, tasks)} since={session.busySince} />
    </Box>
  );
}

function Queue() {
  const theme = useTheme();
  const queued = useAtomValue(queueAtom);
  if (queued.length === 0) return null;

  return (
    <Box marginTop={1} flexDirection="column" paddingX={1}>
      {queued.map(({ text }, index) => (
        <Text key={index} color={theme.muted} wrap="truncate-end">
          queued: {text}
        </Text>
      ))}
    </Box>
  );
}
