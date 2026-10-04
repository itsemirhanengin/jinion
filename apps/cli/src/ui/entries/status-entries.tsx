import { Box, Markdown, printable, Text, useHovered, useTheme, useView } from '@jinion/tui';
import { ToolLine, UserMessage } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import type { EntryOf } from '@jinion/core/conversation/entries';
import { compact, preciseSeconds } from '@jinion/core/lib/format';
import { firstLine } from '@jinion/core/lib/text';
import { mentionAtom } from '../../state/session.js';
import { TASK_MARKS } from '../task-marks.js';

export function UserEntry({ text, steered }: { text: string; steered?: boolean }) {
  const mention = useAtomValue(mentionAtom);

  return <UserMessage text={text} mentions={[mention]} aside={steered ? 'while working' : undefined} />;
}

export function Compaction({ entry }: { entry: EntryOf<'compaction'> }) {
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

export function TaskEnd({ entry }: { entry: EntryOf<'task'> }) {
  const theme = useTheme();

  const { task, summary } = entry;
  const took = preciseSeconds((task.endedAt ?? Date.now()) - task.startedAt);
  // Claude Code's summary of a command repeats it; the exit code is what it adds.
  const exitCode = /exit code (\d+)/.exec(summary ?? '')?.[1];

  const how =
    task.status === 'failed'
      ? `failed after ${took}${exitCode ? ` · exit ${exitCode}` : ''}`
      : task.status === 'stopped'
        ? `stopped after ${took}`
        : `done in ${took}`;

  return (
    <ToolLine
      status={TASK_MARKS[task.status]}
      name={task.kind === 'agent' ? 'Background agent' : 'Background'}
      detail={
        <Text>
          <Text color={task.kind === 'shell' ? theme.code : undefined}>{printable(firstLine(task.title))}</Text>
          <Text color={task.status === 'failed' ? theme.error : theme.muted}> · {how}</Text>
        </Text>
      }
    />
  );
}
