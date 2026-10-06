import type { FileChange, RepoChanges } from '@jinion/core/api/protocol';
import { LineCounts } from '@jinion/ui';
import { DiffCard, type DiffCardProps, type DiffLine } from '@jinion/ui/chat';
import { FolderGit2, GitBranch } from 'lucide-react';
import { type ReactNode, useEffect, useReducer, useRef } from 'react';
import { diffLines } from '../../lib/diff.js';
import { useReveal } from '../../state/reveal.js';
import { useCore } from '../../state/session.js';
import { CommentsBar } from '../comments/comments-bar.js';
import { useComments } from '../comments/use-comments.js';
import { useGit } from './use-git.js';

/** Every uncommitted file's diff one under another, a heading for each repository when the folder holds several. */
export function GitDiffs() {
  const { shown, repos } = useGit();
  const { diffs, read } = useDiffs(shown, repos);
  const commentsOn = useComments(shown, 'git');
  const list = useRef<HTMLDivElement>(null);

  const changed = (repos ?? []).filter((repo) => repo.changes.length > 0);

  useReveal('git:changes', list, read);

  if (!shown) return <Note>Open a thread to see the git changes in its folder.</Note>;
  if (!repos) return null;
  if (repos.length === 0) return <Note>This folder isn't in a git repository, and holds none.</Note>;
  if (changed.length === 0) return <Note>Nothing to commit. What changes in the folder's repositories shows here, file by file.</Note>;

  return (
    <div ref={list} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-240 flex-col gap-8 px-8 py-6">
        {changed.map((repo, index) => (
          <section key={repo.repo.root} className="flex flex-col gap-4">
            <Heading repo={repo} titled={repos.length > 1} end={index === 0 && <CommentsBar session={shown} />} />
            {repo.changes.map((change) => {
              const lines = diffs.get(change.absolute)?.lines;

              return (
                <div key={change.absolute} data-path={change.absolute} className="scroll-mt-4">
                  <Diff change={change} lines={lines} comments={lines && commentsOn(change.absolute, lines)} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function Heading({ repo, titled, end }: { repo: RepoChanges; titled: boolean; end?: ReactNode }) {
  const added = repo.changes.reduce((sum, change) => sum + change.insertions, 0);
  const removed = repo.changes.reduce((sum, change) => sum + change.deletions, 0);

  return (
    <div className="flex items-center gap-3">
      {titled && <FolderGit2 className="size-4 shrink-0 text-faint" />}
      <p className="font-medium">
        {titled ? `${repo.repo.label}, ` : ''}
        {repo.changes.length} {repo.changes.length === 1 ? 'file' : 'files'} changed
      </p>
      <LineCounts added={added} removed={removed} />
      {repo.branch && (
        <span className="flex min-w-0 items-center gap-1.5 text-faint">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{repo.branch}</span>
        </span>
      )}
      {end && (
        <>
          <span className="flex-1" />
          {end}
        </>
      )}
    </div>
  );
}

function Diff({ change, lines, comments }: { change: FileChange; lines?: DiffLine[]; comments?: Partial<DiffCardProps> }) {
  if (change.binary) return <Placeholder path={change.file} text="A binary file, with no lines to show." />;
  if (!lines) return <Placeholder path={change.file} text="Reading the diff" />;

  return <DiffCard path={change.file} lines={lines} folded={Number.POSITIVE_INFINITY} bare {...comments} />;
}

function Placeholder({ path, text }: { path: string; text: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-xl bg-raised px-3 ring-1 ring-edge">
      <span className="font-medium">{path.slice(path.lastIndexOf('/') + 1)}</span>
      <span className="text-muted">{text}</span>
    </div>
  );
}

/** Each file's diff, read again only when the file's change is no longer the one it was read for. */
function useDiffs(session: string | undefined, repos: RepoChanges[] | undefined) {
  const core = useCore();
  const cache = useRef(new Map<string, { key: string; lines?: DiffLine[] }>());
  const [read, redraw] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!session || !repos) return;

    for (const change of repos.flatMap((repo) => repo.changes)) {
      const key = `${change.kind}|${change.insertions}|${change.deletions}|${change.staged ?? ''}`;
      if (change.binary || cache.current.get(change.absolute)?.key === key) continue;

      cache.current.set(change.absolute, { key, lines: cache.current.get(change.absolute)?.lines });

      void core.gitDiff(session, change.absolute).then(
        (patch) => {
          if (cache.current.get(change.absolute)?.key !== key) return;

          cache.current.set(change.absolute, { key, lines: diffLines(patch) });
          redraw();
        },
        () => {},
      );
    }
  }, [core, session, repos]);

  return { diffs: cache.current, read };
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
