import { countChanges, parsePatch, Text } from '@jinion/tui';
import type { Entry } from '../../conversation/entries.js';
import { clockTime, minutes, plural } from '../../lib/format.js';
import type { Segment } from '../segment.js';

export const changes: Segment = {
  id: 'changes',
  name: 'Changes',
  description: 'Lines added and removed in this conversation',
  render: ({ session, theme }) => {
    const { added, removed } = sessionChanges(session.entries);
    if (added === 0 && removed === 0) return undefined;
    return (
      <Text>
        <Text color={theme.success}>+{added}</Text> <Text color={theme.error}>-{removed}</Text>
      </Text>
    );
  },
};

export const tasks: Segment = {
  id: 'tasks',
  name: 'Tasks',
  description: "Progress on the agent's task list",
  render: ({ session, theme }) => {
    const items = session.todos.flatMap((group) => group.items);
    if (items.length === 0) return undefined;
    const done = items.filter((item) => item.status === 'done').length;
    return (
      <Text>
        <Text color={theme.muted}>tasks </Text>
        {done}/{items.length}
      </Text>
    );
  },
};

export const title: Segment = {
  id: 'title',
  name: 'Title',
  description: 'What the conversation is about',
  render: ({ session, theme }) => session.title && <Text color={theme.muted}>{session.title}</Text>,
};

export const duration: Segment = {
  id: 'duration',
  name: 'Duration',
  description: 'How long ago the conversation started',
  ticks: true,
  render: ({ session, now, theme }) => <Text color={theme.muted}>{minutes(now - session.createdAt)}</Text>,
};

export const turns: Segment = {
  id: 'turns',
  name: 'Turns',
  description: 'Prompts sent in this conversation',
  render: ({ session, theme }) => (
    <Text color={theme.muted}>{plural(session.entries.filter((entry) => entry.kind === 'user').length, 'turn')}</Text>
  ),
};

export const time: Segment = {
  id: 'time',
  name: 'Clock',
  description: 'The time of day',
  ticks: true,
  render: ({ now, theme }) => <Text color={theme.muted}>{clockTime(new Date(now))}</Text>,
};

const changesByEntry = new WeakMap<Entry, { added: number; removed: number }>();

/** Entries never change once they are done, so each patch is parsed once. */
function sessionChanges(entries: Entry[]) {
  let added = 0;
  let removed = 0;
  for (const entry of entries) {
    if (entry.kind !== 'tool' || entry.run.name !== 'edit' || entry.status !== 'done') continue;
    let counts = changesByEntry.get(entry);
    if (!counts) {
      counts = countChanges(parsePatch(entry.run.result?.patch ?? entry.run.input.patch));
      changesByEntry.set(entry, counts);
    }
    added += counts.added;
    removed += counts.removed;
  }
  return { added, removed };
}
