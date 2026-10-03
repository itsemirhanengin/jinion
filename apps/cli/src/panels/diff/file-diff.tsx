import { Diff, Panel, parsePatch, Text, useInput, useTheme } from '@jinion/tui';
import { PAGER_HINTS, usePager } from '../../ui/use-pager.js';
import { useAsync } from '../../ui/use-async.js';
import type { ChangeRow } from './views.js';

export const CHROME_ROWS = 8;

export function FileDiff({ row, onBack }: { row: ChangeRow; onBack(): void }) {
  const theme = useTheme();

  const read = useAsync(() => row.patch().catch(() => ''), [row]);
  const patch = read.state === 'done' ? read.value : undefined;
  const lines = patch ? parsePatch(patch).length : 0;
  const pager = usePager(lines, { chrome: CHROME_ROWS });

  useInput((_, key) => {
    if (key.escape) return onBack();

    pager.scroll(key);
  });

  return (
    <Panel title="Diff" subtitle={[row.where, pager.range].filter(Boolean).join(' · ')} grow hints={[...PAGER_HINTS, ['Esc', 'back']]}>
      {patch === undefined ? (
        <Text color={theme.muted}>Reading the diff…</Text>
      ) : row.binary ? (
        <Text color={theme.muted}>A binary file; there are no lines to show.</Text>
      ) : lines === 0 ? (
        <Text color={theme.muted}>No line changes, e.g. only the file's mode changed.</Text>
      ) : (
        <Diff patch={patch} window={{ start: pager.top, rows: pager.view }} />
      )}
    </Panel>
  );
}
