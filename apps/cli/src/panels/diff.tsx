import { useEffect, useState } from 'react';
import {
  Box,
  Diff,
  ListRow,
  Panel,
  parsePatch,
  SelectList,
  Text,
  useInput,
  useListNavigation,
  usePanel,
  useTheme,
  useWindowSize,
} from '@jinion/tui';
import { useJinion } from '../context.js';
import { fileDiff, findRepos, repoChanges, repoState, type FileChange, type Repo } from '../git/repos.js';

/** Rows the panel itself takes around the list or the diff: edges, header, dividers and hints. */
const CHROME_ROWS = 8;

interface RepoChanges {
  repo: Repo;
  branch?: string;
  changes: FileChange[];
}

interface Row {
  repo: RepoChanges;
  change: FileChange;
}

/**
 * `/diff`: what changed since the last commit in the project's repository or, in a folder that holds several, in each
 * of them, with the files the agent changed in this conversation marked. Enter opens a file's diff.
 */
export function DiffPanel() {
  const app = useJinion();
  const [repos, setRepos] = useState<RepoChanges[]>();
  const [open, setOpen] = useState<Row>();

  useEffect(() => {
    let current = true;
    void Promise.all(
      findRepos(app.info.cwd).map(async (repo) => {
        const [state, changes] = await Promise.all([repoState(repo), repoChanges(repo).catch(() => [])]);
        return { repo, branch: state?.branch, changes };
      }),
    ).then((found) => current && setRepos(found));
    return () => {
      current = false;
    };
  }, []);

  if (open) return <FileDiff row={open} onBack={() => setOpen(undefined)} />;
  return <ChangeList repos={repos} onOpen={setOpen} />;
}

function ChangeList({ repos, onOpen }: { repos?: RepoChanges[]; onOpen(row: Row): void }) {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const { rows: height } = useWindowSize();
  const rows: Row[] = (repos ?? []).flatMap((repo) => repo.changes.map((change) => ({ repo, change })));
  const limit = Math.max(3, height - CHROME_ROWS - (repos?.length ?? 0));
  const [selected] = useListNavigation(rows.length, { wrap: false, pageSize: limit });

  useInput((_, key) => {
    if (key.escape) close();
    const row = rows[selected];
    if (key.return && row) onOpen(row);
  });

  // Headers name each repository unless the project is the only one.
  const [only] = repos ?? [];
  const grouped = (repos?.length ?? 0) > 1 || (only !== undefined && only.repo.path !== '');
  const insertions = rows.reduce((total, row) => total + row.change.insertions, 0);
  const deletions = rows.reduce((total, row) => total + row.change.deletions, 0);
  const labelWidth = Math.min(60, Math.max(10, ...rows.map((row) => row.change.file.length)) + 2);
  // Repositories without changes have no rows, so they are named under the list.
  const clean = rows.length > 0 && grouped ? (repos ?? []).filter((repo) => repo.changes.length === 0) : [];

  return (
    <Panel
      title="Changes"
      subtitle={
        repos
          ? [grouped ? plural(repos.length, 'repository', 'repositories') : only?.branch, plural(rows.length, 'file'), `+${insertions} -${deletions}`]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      grow
      hints={[
        ['Enter', 'open'],
        ['Up/Down', 'move'],
        ['Esc', 'close'],
      ]}
    >
      {!repos ? (
        <Text color={theme.muted}>Looking for changes…</Text>
      ) : repos.length === 0 ? (
        <Text color={theme.muted}>There is no git repository here or in the folders below.</Text>
      ) : (
        <>
          <SelectList
            items={rows}
            selected={selected}
            limit={limit}
            empty={`No changes since the last commit in ${grouped ? plural(repos.length, 'repository', 'repositories') : 'this repository'}.`}
            renderItem={(row, state) => (
              <Box flexDirection="column">
                {grouped && (state.first || rows[state.index - 1]?.repo !== row.repo) && (
                  <Text>
                    <Text bold>{row.repo.repo.label}</Text>
                    {row.repo.branch && <Text color={theme.muted}> {row.repo.branch}</Text>}
                  </Text>
                )}
                <ListRow
                  selected={state.selected}
                  labelWidth={labelWidth}
                  label={`${grouped ? '  ' : ''}${row.change.file}`}
                  description={<ChangeStats change={row.change} />}
                  aside={app.edited.has(row.change.absolute) ? 'agent' : undefined}
                />
              </Box>
            )}
          />
          {clean.length > 0 && <Text color={theme.muted}>No changes in {clean.map((repo) => repo.repo.label).join(', ')}.</Text>}
        </>
      )}
    </Panel>
  );
}

function ChangeStats({ change }: { change: FileChange }) {
  const theme = useTheme();
  const kind = change.kind === 'untracked' || change.kind === 'added' ? 'new' : change.kind === 'modified' ? undefined : change.kind;
  return (
    <Text>
      {kind && <Text color={theme.muted}>{kind} </Text>}
      {change.binary ? (
        <Text color={theme.muted}>binary</Text>
      ) : (
        <>
          {change.insertions > 0 && <Text color={theme.diff.added}>+{change.insertions} </Text>}
          {change.deletions > 0 && <Text color={theme.diff.removed}>-{change.deletions}</Text>}
        </>
      )}
    </Text>
  );
}

/** One file's diff, scrolled with the arrows and page keys. */
function FileDiff({ row, onBack }: { row: Row; onBack(): void }) {
  const theme = useTheme();
  const { rows: height } = useWindowSize();
  const [patch, setPatch] = useState<string>();
  const [top, setTop] = useState(0);
  const lines = patch ? parsePatch(patch).length : 0;
  const view = Math.max(3, height - CHROME_ROWS);
  const last = Math.max(0, lines - view);

  useEffect(() => {
    let current = true;
    fileDiff(row.repo.repo, row.change).then(
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

  const where = row.repo.repo.path ? `${row.repo.repo.path}/` : '';
  return (
    <Panel
      title="Diff"
      subtitle={`${where}${row.change.file}${lines > view ? ` · lines ${top + 1}-${Math.min(lines, top + view)} of ${lines}` : ''}`}
      grow
      hints={[
        ['Up/Down', 'scroll'],
        ['PgUp/PgDn', 'page'],
        ['Esc', 'back'],
      ]}
    >
      {patch === undefined ? (
        <Text color={theme.muted}>Reading the diff…</Text>
      ) : row.change.binary ? (
        <Text color={theme.muted}>A binary file; there are no lines to show.</Text>
      ) : lines === 0 ? (
        <Text color={theme.muted}>No line changes, e.g. only the file's mode changed.</Text>
      ) : (
        <Diff patch={patch} window={{ start: top, rows: view }} />
      )}
    </Panel>
  );
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;
