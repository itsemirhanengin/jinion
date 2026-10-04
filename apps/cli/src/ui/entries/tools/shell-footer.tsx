import { useAnimation } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { tasksAtom } from '../../../state/session.js';
import type { ToolEntry } from '@jinion/core/conversation/entries';
import { preciseSeconds } from '@jinion/core/lib/format';

export function ShellFooter({ entry }: { entry: ToolEntry }) {
  const running = entry.status === 'running';

  useAnimation({ interval: 100, isActive: running });

  if (entry.run.name !== 'bash') return null;
  if (entry.run.result?.background) return <BackgroundState id={entry.run.result.background} />;

  const timeout = `Timeout: ${preciseSeconds(entry.run.input.timeoutMs)}`;
  if (running && entry.waiting) return <>[Waiting for your approval | {timeout}]</>;

  // A command asked about runs from when it was allowed.
  const started = entry.approvedAt ?? entry.startedAt;
  if (running) return <>[Running: {preciseSeconds(Date.now() - started)} | {timeout}]</>;

  const took = entry.approvedAt
    ? (entry.endedAt ?? Date.now()) - entry.approvedAt
    : (entry.run.result?.wallMs ?? (entry.endedAt ?? Date.now()) - started);

  const wall = `Wall: ${preciseSeconds(took)}`;
  if (entry.status === 'cancelled') return <>[Cancelled | {wall}]</>;

  const exitCode = entry.run.result?.exitCode;

  return (
    <>
      [{exitCode ? `Exit: ${exitCode} | ` : ''}
      {wall} | {timeout}]
    </>
  );
}

function BackgroundState({ id }: { id: string }) {
  const task = useAtomValue(tasksAtom).find((candidate) => candidate.id === id);
  if (!task || task.status === 'running') return <>[In the background | ctrl+t to see it]</>;

  return <>[In the background | {task.status === 'completed' ? 'done' : task.status}]</>;
}
