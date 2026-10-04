import { resolve } from 'node:path';
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { editTurnsAtom } from '@jinion/core/state/active';
import { readChanges, type RepoChanges } from '@jinion/core/git/changes';
import { fileDiff } from '@jinion/core/git/repos';
import { plural } from '@jinion/core/lib/format';
import { useAsync } from '../../ui/use-async.js';
import { useWorkdir } from '../../ui/use-workdir.js';
import { totals, type ChangeRow, type View } from './views.js';

export function useCurrentView(): View {
  const cwd = useWorkdir();
  const turns = useAtomValue(editTurnsAtom);

  const edited = useMemo(() => new Set(turns.flatMap((turn) => turn.edits.map((change) => resolve(cwd, change.path)))), [turns, cwd]);

  const read = useAsync(() => readChanges(cwd), []);

  if (read.state !== 'done') return { label: 'Current', empty: 'Looking for changes…' };

  const repos = read.value;
  if (repos.length === 0) return { label: 'Current', rows: [], empty: 'There is no git repository here or in the folders below.' };

  const [only] = repos;
  const grouped = repos.length > 1 || only!.repo.path !== '';
  const what = (repo: RepoChanges) => (repo.since ? `${repo.branch} · what it adds to ${repo.since.against}` : repo.branch);

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
