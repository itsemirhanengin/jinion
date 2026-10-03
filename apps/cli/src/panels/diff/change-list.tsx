import { Box, ListRow, Panel, SelectList, Tabs, Text, useInput, useListNavigation, usePanel, useTheme, useWindowSize, type KeyHint } from '@jinion/tui';
import { CHROME_ROWS } from './file-diff.js';
import type { ChangeRow, View } from './views.js';

const TURNS_SHOWN = 3;

interface ChangeListProps {
  views: View[];
  active: number;
  onSwitch(step: number): void;
  onOpen(row: ChangeRow): void;
}

export function ChangeList({ views, active, onSwitch, onOpen }: ChangeListProps) {
  const theme = useTheme();
  const { close } = usePanel();
  const { rows: height } = useWindowSize();
  const view = views[active]!;
  const rows = view.rows ?? [];
  const groups = new Set(rows.map((row) => row.group?.label)).size;
  const limit = Math.max(3, height - CHROME_ROWS - groups - (view.note ? 1 : 0));
  const [selected] = useListNavigation(rows.length, { wrap: false, pageSize: limit });

  useInput((_, key) => {
    if (key.escape) return close();
    if (key.leftArrow) return onSwitch(-1);
    if (key.rightArrow) return onSwitch(1);
    const row = rows[selected];
    if (key.return && row) onOpen(row);
  });

  const labelWidth = Math.min(60, Math.max(10, ...rows.map((row) => row.file.length)) + 2);
  const hints: KeyHint[] = [
    ...(views.length > 1 ? ([['Left/Right', 'turn']] as KeyHint[]) : []),
    ['Enter', 'open'],
    ['Up/Down', 'move'],
    ['Esc', 'close'],
  ];
  return (
    <Panel title="Changes" subtitle={view.subtitle} header={views.length > 1 ? <ViewBar views={views} active={active} /> : undefined} grow hints={hints}>
      {!view.rows ? (
        <Text color={theme.muted}>{view.empty}</Text>
      ) : (
        <>
          <SelectList
            items={rows}
            selected={selected}
            limit={limit}
            empty={view.empty}
            renderItem={(row, state) => (
              <Box flexDirection="column">
                {row.group && (state.first || rows[state.index - 1]?.group?.label !== row.group.label) && (
                  <Text>
                    <Text bold>{row.group.label}</Text>
                    {row.group.aside && <Text color={theme.muted}> {row.group.aside}</Text>}
                  </Text>
                )}
                <ListRow
                  selected={state.selected}
                  labelWidth={labelWidth}
                  label={`${row.group ? '  ' : ''}${row.file}`}
                  description={<ChangeStats row={row} />}
                  aside={row.agent ? 'agent' : undefined}
                />
              </Box>
            )}
          />
          {view.note && <Text color={theme.muted}>{view.note}</Text>}
        </>
      )}
    </Panel>
  );
}

function ViewBar({ views, active }: { views: View[]; active: number }) {
  const theme = useTheme();
  const turns = views.length - 1;
  const first = Math.min(Math.max(1, active - 1), Math.max(1, turns - TURNS_SHOWN + 1));
  const shown = views.slice(first, first + TURNS_SHOWN);
  const before = first - 1;
  const after = turns - (first - 1) - shown.length;
  return (
    <Text>
      <Tabs tabs={['Current']} active={active === 0 ? 0 : -1} />
      <Text color={theme.muted}>{before > 0 ? `  ‹ ${before} ` : '  '}</Text>
      <Tabs tabs={shown.map((view) => view.label)} active={active - first} />
      {after > 0 && <Text color={theme.muted}>{` ${after} more ›`}</Text>}
    </Text>
  );
}

function ChangeStats({ row }: { row: ChangeRow }) {
  const theme = useTheme();
  const kind = row.kind === 'untracked' || row.kind === 'added' ? 'new' : row.kind === 'modified' ? undefined : row.kind;
  return (
    <Text>
      {kind && <Text color={theme.muted}>{kind} </Text>}
      {row.binary ? (
        <Text color={theme.muted}>binary</Text>
      ) : (
        <>
          {row.insertions > 0 && <Text color={theme.diff.added}>+{row.insertions} </Text>}
          {row.deletions > 0 && <Text color={theme.diff.removed}>-{row.deletions}</Text>}
        </>
      )}
    </Text>
  );
}
