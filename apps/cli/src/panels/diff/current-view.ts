import { resolve } from 'node:path';
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useJinion } from '../../app/context.js';
import { branchBase, fileDiff, findRepos, repoChanges, repoState, type FileChange, type Repo } from '../../git/repos.js';
import { plural } from '../../lib/format.js';
import { editTurnsAtom } from '../../state/session.js';
import { useAsync } from '../../ui/use-async.js';
import { totals, type ChangeRow, type View } from './views.js';

interface RepoView {
  repo: Repo;
  branch?: string;
  changes: FileChange[];
  /** With nothing uncommitted, what the branch adds on top of the default branch. */
  since?: { base: string; against: string };
}

export function useCurrentView(): View {
  const { info } = useJinion();
  const turns = useAtomValue(editTurnsAtom);

  const edited = useMemo(
    () => new Set(turns.flatMap((turn) => turn.edits.map((change) => resolve(info.cwd, change.path)))),
    [turns, info.cwd],
  );

  const read = useAsync(() => Promise.all(findRepos(info.cwd).map(readRepo)), []);

  if (read.state !== 'done') return { label: 'Current', empty: 'Looking for changes…' };

  const repos = read.value;
  if (repos.length === 0) return { label: 'Current', rows: [], empty: 'There is no git repository here or in the folders below.' };

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
        agent: edited.has(change.absolute),
        where: `${repo.repo.path ? `${repo.repo.path}/` : ''}${change.file}`,
        patch: () => fileDiff(repo.repo, change, repo.since?.base),
      }),
    ),
  );

  // Repositories without changes have no rows, so they are named under the list.
  const clean = rows.length > 0 && grouped ? repos.filter((repo) => repo.changes.length === 0) : [];
  const repositories = plural(repos.length, 'repository', 'repositories');

  return {
    label: 'Current',
    rows,
    subtitle: [grouped ? repositories : what(only!), ...totals(rows)].filter(Boolean).join(' · '),
    empty: `No changes since the last commit in ${grouped ? repositories : 'this repository'}.`,
    note: clean.length > 0 ? `No changes in ${clean.map((repo) => repo.repo.label).join(', ')}.` : undefined,
  };
}

async function readRepo(repo: Repo): Promise<RepoView> {
  const [state, changes] = await Promise.all([repoState(repo), repoChanges(repo).catch(() => [])]);
  if (changes.length > 0) return { repo, branch: state?.branch, changes };

  const since = await branchBase(repo).catch(() => undefined);
  if (!since) return { repo, branch: state?.branch, changes };

  return { repo, branch: state?.branch, changes: await repoChanges(repo, since.base).catch(() => []), since };
}
