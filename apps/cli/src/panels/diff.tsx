import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Diff,
  ListRow,
  Panel,
  parsePatch,
  SelectList,
  Tabs,
  Text,
  useInput,
  useListNavigation,
  usePanel,
  useTheme,
  useWindowSize,
  type KeyHint,
} from '@jinion/tui';
import { useJinion } from '../context.js';
import { branchBase, fileDiff, findRepos, repoChanges, repoState, type FileChange, type Repo } from '../git/repos.js';
import type { EditTurn } from '../session.js';

/** Rows the panel itself takes around the list or the diff: edges, header, dividers and hints. */
const CHROME_ROWS = 8;
/** Turn views shown in the bar at once, next to Current. */
const TURNS_SHOWN = 3;
const TURN_LABEL = 24;

/** A changed file in one of the views. */
interface ChangeRow {
  key: string;
  /** The repository it is in, when the list groups by them. */
  group?: { label: string; aside?: string };
  file: string;
  kind: FileChange['kind'];
  insertions: number;
  deletions: number;
  binary?: boolean;
  /** The agent changed it in this conversation. */
  agent?: boolean;
  /** Over its diff, e.g. `api/server.ts`. */
  where: string;
  patch(): Promise<string>;
}

/** Current, from git, or one turn's edits, from the conversation. */
interface View {
  label: string;
  /** `undefined` while it is read. */
  rows?: ChangeRow[];
  subtitle?: string;
  empty: string;
  /** Under the list. */
  note?: ReactNode;
}

interface RepoView {
  repo: Repo;
  branch?: string;
  changes: FileChange[];
  /** With nothing uncommitted, what the branch adds on top of the default branch. */
  since?: { base: string; against: string };
}

/**
 * `/diff`, as in Claude Code: Current shows what isn't committed in the project's repository, or in each of the
 * repositories of a folder that holds several, or what a branch adds to the default branch when nothing is; left and
 * right go through the turns in which the agent changed files, each with just its edits. Enter opens a file's diff.
 */
export function DiffPanel() {
  const app = useJinion();
  const current = useCurrentView();
  const views = [current, ...app.turns.map(turnView)];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<ChangeRow>();

  if (open) return <FileDiff row={open} onBack={() => setOpen(undefined)} />;
  return (
    <ChangeList
      key={active}
      views={views}
      active={Math.min(active, views.length - 1)}
      onSwitch={(step) => setActive((index) => Math.min(views.length - 1, Math.max(0, index + step)))}
      onOpen={setOpen}
    />
  );
}

function useCurrentView(): View {
  const app = useJinion();
  const [repos, setRepos] = useState<RepoView[]>();
  useEffect(() => {
    let current = true;
    void Promise.all(
      findRepos(app.info.cwd).map(async (repo): Promise<RepoView> => {
        const [state, changes] = await Promise.all([repoState(repo), repoChanges(repo).catch(() => [])]);
        if (changes.length > 0) return { repo, branch: state?.branch, changes };
        const since = await branchBase(repo).catch(() => undefined);
        if (!since) return { repo, branch: state?.branch, changes };
        return { repo, branch: state?.branch, changes: await repoChanges(repo, since.base).catch(() => []), since };
      }),
    ).then((found) => current && setRepos(found));
    return () => {
      current = false;
    };
  }, []);

  if (!repos) return { label: 'Current', empty: 'Looking for changes…' };
  if (repos.length === 0) return { label: 'Current', rows: [], empty: 'There is no git repository here or in the folders below.' };
  // Headers name each repository unless the project is the only one.
  const [only] = repos;
  const grouped = repos.length > 1 || only!.repo.path !== '';
  const what = (repo: RepoView) => (repo.since ? `${repo.branch} · what it adds to ${repo.since.against}` : repo.branch);
  const rows = repos.flatMap((repo) =>
    repo.changes.map(
      (change): ChangeRow => ({
        key: change.absolute,
        group: grouped ? { label: repo.repo.label, aside: what(repo) } : undefined,
        file: change.file,
        kind: change.kind,
        insertions: change.insertions,
        deletions: change.deletions,
        binary: change.binary,
        agent: app.edited.has(change.absolute),
        where: `${repo.repo.path ? `${repo.repo.path}/` : ''}${change.file}`,
        patch: () => fileDiff(repo.repo, change, repo.since?.base),
      }),
    ),
  );
  // Repositories without changes have no rows, so they are named under the list.
  const clean = rows.length > 0 && grouped ? repos.filter((repo) => repo.changes.length === 0) : [];
  return {
    label: 'Current',
    rows,
    subtitle: [grouped ? plural(repos.length, 'repository', 'repositories') : what(only!), ...totals(rows)].filter(Boolean).join(' · '),
    empty: `No changes since the last commit in ${grouped ? plural(repos.length, 'repository', 'repositories') : 'this repository'}.`,
    note: clean.length > 0 ? `No changes in ${clean.map((repo) => repo.repo.label).join(', ')}.` : undefined,
  };
}

/** A turn's edits, a file each, from the conversation rather than git: what the agent changed then, and only that. */
function turnView(turn: EditTurn): View {
  const files = new Map<string, { patches: string[]; created: boolean }>();
  for (const edit of turn.edits) {
    const file = files.get(edit.path) ?? { patches: [], created: false };
    file.patches.push(edit.patch);
    file.created ||= edit.created === true;
    files.set(edit.path, file);
  }
  const rows = [...files].map(([path, file]): ChangeRow => {
    const patch = file.patches.join('\n');
    const lines = patch.split('\n');
    return {
      key: path,
      file: path,
      kind: file.created ? 'added' : 'modified',
      insertions: lines.filter((line) => line.startsWith('+')).length,
      deletions: lines.filter((line) => line.startsWith('-')).length,
      where: path,
      patch: async () => patch,
    };
  });
  const prompt = turn.prompt.split('\n').find((line) => line.trim()) ?? turn.prompt;
  return {
    label: prompt.length > TURN_LABEL ? `${prompt.slice(0, TURN_LABEL - 1)}…` : prompt,
    rows,
    subtitle: [`“${prompt.length > 60 ? `${prompt.slice(0, 59)}…` : prompt}”`, ...totals(rows)].join(' · '),
    empty: '',
  };
}

function ChangeList({
  views,
  active,
  onSwitch,
  onOpen,
}: {
  views: View[];
  active: number;
  onSwitch(step: number): void;
  onOpen(row: ChangeRow): void;
}) {
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

/** Current, then the turns newest first; a few at a time around the one shown, with how many more each way. */
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

/** One file's diff, scrolled with the arrows and page keys. */
function FileDiff({ row, onBack }: { row: ChangeRow; onBack(): void }) {
  const theme = useTheme();
  const { rows: height } = useWindowSize();
  const [patch, setPatch] = useState<string>();
  const [top, setTop] = useState(0);
  const lines = patch ? parsePatch(patch).length : 0;
  const view = Math.max(3, height - CHROME_ROWS);
  const last = Math.max(0, lines - view);

  useEffect(() => {
    let current = true;
    row.patch().then(
      (text) => current && setPatch(text),
      () => current && setPatch(''),
    );
    return () => {
      current = false;
    };
  }, [row]);

  useInput((_, key) => {
    if (key.escape) return onBack();
    const step = key.pageDown ? view : key.pageUp ? -view : key.downArrow ? 1 : key.upArrow ? -1 : 0;
    if (step) setTop((current) => Math.min(last, Math.max(0, current + step)));
  });

  return (
    <Panel
      title="Diff"
      subtitle={`${row.where}${lines > view ? ` · lines ${top + 1}-${Math.min(lines, top + view)} of ${lines}` : ''}`}
      grow
      hints={[
        ['Up/Down', 'scroll'],
        ['PgUp/PgDn', 'page'],
        ['Esc', 'back'],
      ]}
    >
      {patch === undefined ? (
        <Text color={theme.muted}>Reading the diff…</Text>
      ) : row.binary ? (
        <Text color={theme.muted}>A binary file; there are no lines to show.</Text>
      ) : lines === 0 ? (
        <Text color={theme.muted}>No line changes, e.g. only the file's mode changed.</Text>
      ) : (
        <Diff patch={patch} window={{ start: top, rows: view }} />
      )}
    </Panel>
  );
}

/** `2 files`, `+3 -1`. */
function totals(rows: ChangeRow[]) {
  const insertions = rows.reduce((total, row) => total + row.insertions, 0);
  const deletions = rows.reduce((total, row) => total + row.deletions, 0);
  return [plural(rows.length, 'file'), `+${insertions} -${deletions}`];
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
