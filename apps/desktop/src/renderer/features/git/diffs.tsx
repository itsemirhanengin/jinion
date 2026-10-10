import type { FileChange, RepoChanges } from '@jinion/core/api/protocol';
import { LineCounts, VirtualList, type VirtualListHandle } from '@jinion/ui';
import { DiffCard, type DiffCardProps, type DiffLine } from '@jinion/ui/chat';
import { FolderGit2, GitBranch } from 'lucide-react';
import { type ReactNode, useEffect, useReducer, useRef } from 'react';
import { diffLines } from '../../lib/diff.js';
import { diffHeight, drawable, SHOWN_LINES } from '../../lib/diff-view.js';
import { useReveal } from '../../state/reveal.js';
import { useCore } from '../../state/session.js';
import { CommentsBar } from '../comments/comments-bar.js';
import { useComments } from '../comments/use-comments.js';
import { useGit } from './use-git.js';

type Item = { kind: 'heading'; repo: RepoChanges; first: boolean } | { kind: 'change'; change: FileChange };

const HEADING = 44;
const BINARY = 36;

/**
 * Every uncommitted file's diff one under another, a heading for each repository when the folder holds several. Only
 * the files in view are drawn, and each reads its diff once it comes into view, so a folder of thousands stays light.
 */
export function GitDiffs() {
  const { shown, repos } = useGit();
  const { diffOf, read, drawn } = useDiffs(shown);
  const commentsOn = useComments(shown, 'git');
  const list = useRef<VirtualListHandle>(null);

  const changed = (repos ?? []).filter((repo) => repo.changes.length > 0);

  useReveal('git:changes', (path) => list.current?.scrollTo(path), drawn);

  if (!shown) return <Note>Open a thread to see the git changes in its folder.</Note>;
  if (!repos) return null;
  if (repos.length === 0) return <Note>This folder isn't in a git repository, and holds none.</Note>;
  if (changed.length === 0) return <Note>Nothing to commit. What changes in the folder's repositories shows here, file by file.</Note>;

  const items: Item[] = changed.flatMap((repo, index) => [
    { kind: 'heading' as const, repo, first: index === 0 },
    ...repo.changes.map((change) => ({ kind: 'change' as const, change })),
  ]);

  return (
    <VirtualList
      handle={list}
      items={items}
      keyOf={(item) => (item.kind === 'heading' ? `repo:${item.repo.repo.root}` : item.change.absolute)}
      estimate={(item) => (item.kind === 'heading' ? HEADING : item.change.binary ? BINARY : diffHeight(item.change.insertions, item.change.deletions))}
      gap={16}
      className="h-full"
      innerClassName="mx-auto max-w-240 px-8 py-6"
    >
      {(item) => {
        if (item.kind === 'heading') return <Heading repo={item.repo} titled={changed.length > 1} end={item.first && <CommentsBar session={shown} />} />;

        const lines = diffOf(item.change);

        return <Diff change={item.change} lines={lines} comments={lines && commentsOn(item.change.absolute, lines)} onShow={() => read(item.change)} />;
      }}
    </VirtualList>
  );
}

function Heading({ repo, titled, end }: { repo: RepoChanges; titled: boolean; end?: ReactNode }) {
  const added = repo.changes.reduce((sum, change) => sum + change.insertions, 0);
  const removed = repo.changes.reduce((sum, change) => sum + change.deletions, 0);

  return (
    <div className="flex items-center gap-3 pt-2">
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

/** A file's diff, asked for as it comes into view; a long one shows its first lines until it is opened in full. */
function Diff({ change, lines, comments, onShow }: { change: FileChange; lines?: DiffLine[]; comments?: Partial<DiffCardProps>; onShow: () => void }) {
  useEffect(() => {
    if (!change.binary) onShow();
  }, [change.absolute, change.insertions, change.deletions, change.kind, change.staged]);

  if (change.binary) return <Placeholder path={change.file} text="A binary file, with no lines to show." />;
  if (!lines) return <Placeholder path={change.file} text="Reading the diff" />;

  return <DiffCard path={change.file} lines={drawable(lines)} folded={SHOWN_LINES} bare {...comments} />;
}

function Placeholder({ path, text }: { path: string; text: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-xl bg-raised px-3 ring-1 ring-edge">
      <span className="font-medium">{path.slice(path.lastIndexOf('/') + 1)}</span>
      <span className="text-muted">{text}</span>
    </div>
  );
}

/** Each file's diff, read when its card asks, and again only once the file's change is no longer the one it was read for. */
function useDiffs(session: string | undefined) {
  const core = useCore();
  const cache = useRef(new Map<string, { key: string; lines?: DiffLine[] }>());
  const [drawn, redraw] = useReducer((count: number) => count + 1, 0);

  const keyOf = (change: FileChange) => `${change.kind}|${change.insertions}|${change.deletions}|${change.staged ?? ''}`;

  const read = (change: FileChange) => {
    const key = keyOf(change);
    if (!session || cache.current.get(change.absolute)?.key === key) return;

    cache.current.set(change.absolute, { key, lines: cache.current.get(change.absolute)?.lines });

    void core.gitDiff(session, change.absolute).then(
      (patch) => {
        if (cache.current.get(change.absolute)?.key !== key) return;

        cache.current.set(change.absolute, { key, lines: diffLines(patch) });
        redraw();
      },
      () => {},
    );
  };

  return { diffOf: (change: FileChange) => cache.current.get(change.absolute)?.lines, read, drawn };
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
