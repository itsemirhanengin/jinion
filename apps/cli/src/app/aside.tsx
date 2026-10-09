import { useState } from 'react';
import { Box, Text, useTheme } from '@jinion/tui';
import { TodoPanel, Working } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import { busyAtom, dialogAtom, queueAtom, sessionAtom, steeringAtom, tasksAtom, todosAtom } from '../state/session.js';
import { activity, hasWorkLeft } from './activity.js';
import { TaskLine } from './task-line.js';

/** While a turn runs, the last done items stay in view, to see what just happened; between turns none do. */
const KEEP_DONE_WHILE_BUSY = 2;

export function Aside() {
  return (
    <>
      <Activity />
      <Todos />
      <TaskLine />
      <Queue />
    </>
  );
}

/** A dialog takes their place: what jinion asks matters more than the list while it waits. */
function Todos() {
  const todos = useAtomValue(todosAtom);
  const busy = useAtomValue(busyAtom);
  const dialog = useAtomValue(dialogAtom);

  const [folded, setFolded] = useState(false);

  if (dialog || !hasWorkLeft(todos)) return null;

  return (
    <Box marginTop={1} flexDirection="column">
      <TodoPanel groups={todos} folded={folded} onToggle={() => setFolded(!folded)} keepDone={busy ? KEEP_DONE_WHILE_BUSY : 0} />
    </Box>
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

/** Steered messages first: the agent reads them in this turn, queued ones go after it. */
function Queue() {
  const theme = useTheme();
  const steering = useAtomValue(steeringAtom);
  const queued = useAtomValue(queueAtom);

  const waiting = [...steering.map((text) => `steering: ${text}`), ...queued.map(({ text }) => `queued: ${text}`)];
  if (waiting.length === 0) return null;

  return (
    <Box marginTop={1} flexDirection="column" paddingX={1}>
      {waiting.map((line, index) => (
        <Text key={index} color={theme.muted} wrap="truncate-end">
          {line}
        </Text>
      ))}
    </Box>
  );
}
