import { printable, StatusMark, Text, useHovered, useTheme, useView, type TreeNode } from '@jinion/tui';
import { ToolLine } from '@jinion/tui/chat';
import { useAtomValue } from 'jotai';
import type { ToolCallEntry, ToolEntry } from '../../../conversation/entries.js';
import { plural, preciseSeconds } from '../../../lib/format.js';
import { tasksAtom } from '../../../state/agent.js';
import { callSummary } from './call-summary.js';

const LIVE_CALLS = 6;

export function AgentView({ entry }: { entry: ToolEntry }) {
  const theme = useTheme();
  const { expanded } = useView();
  const hovered = useHovered();
  const tasks = useAtomValue(tasksAtom);

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
    const took = preciseSeconds((task?.endedAt ?? entry.endedAt ?? Date.now()) - entry.startedAt);

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
