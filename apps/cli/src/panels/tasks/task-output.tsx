import { Panel, printable, Text, useInput, usePanel, useTheme, type KeyHint } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { useJinion } from '../../app/context.js';
import { firstLine } from '@jinion/core/lib/text';
import { tasksAtom } from '@jinion/core/state/agent';
import { PAGER_HINTS, usePager } from '../../ui/use-pager.js';
import { useOutput } from './output.js';

const CHROME_ROWS = 6;

export function TaskOutput({ id }: { id: string }) {
  const jinion = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const task = useAtomValue(tasksAtom).find((candidate) => candidate.id === id);

  const lines = useOutput(task?.output, task?.status === 'running') ?? [];
  const pager = usePager(lines.length, { chrome: CHROME_ROWS, follow: true });

  useInput((input, key) => {
    if (key.escape) return close();
    if (input === 'x' && task?.status === 'running') return jinion.tasks.stop(task.id);

    pager.scroll(key);
  });

  if (!task) return null;

  const hints: KeyHint[] = [...PAGER_HINTS, ...(task.status === 'running' ? ([['x', 'stop']] as KeyHint[]) : []), ['Esc', 'back']];

  return (
    <Panel title="Output" subtitle={[printable(firstLine(task.title)), pager.range].filter(Boolean).join(' · ')} grow hints={hints}>
      {lines.length === 0 ? (
        <Text color={theme.muted}>No output yet.</Text>
      ) : (
        lines.slice(pager.top, pager.top + pager.view).map((line, index) => (
          <Text key={pager.top + index} wrap="truncate-end">
            {line || ' '}
          </Text>
        ))
      )}
    </Panel>
  );
}
