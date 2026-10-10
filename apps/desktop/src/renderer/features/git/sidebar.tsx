import type { FileChange, RepoChanges } from '@jinion/core/api/protocol';
import { Button, classNames, VirtualList } from '@jinion/ui';
import { useWorkbench } from '@jinion/workbench';
import { atom, useAtom } from 'jotai';
import { FolderGit2, GitBranch } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { reveal } from '../../state/reveal.js';
import { useCore } from '../../state/session.js';
import { GIT_TAB } from './git.js';
import { useGit } from './use-git.js';

/** What is typed in each repository's commit box, by its root, so it outlives the sidebar closing. */
const messagesAtom = atom<Record<string, string>>({});

type Item = { kind: 'repo'; repo: RepoChanges } | { kind: 'file'; change: FileChange };

const HEAD = 176;
const EMPTY = 32;
const ROW = 28;

/** Each repository's commit box and its changed files, only the rows in view drawn, however many files changed. */
export function GitSidebar() {
  const core = useCore();
  const workbench = useWorkbench();
  const { shown, repos } = useGit();

  if (!shown) return <Note>Open a thread to see the git changes in its folder.</Note>;
  if (!repos) return null;
  if (repos.length === 0) return <Note>This folder isn't in a git repository, and holds none.</Note>;

  const items: Item[] = repos.flatMap((repo) => [{ kind: 'repo' as const, repo }, ...repo.changes.map((change) => ({ kind: 'file' as const, change }))]);

  const open = (change: FileChange) => {
    workbench.open(GIT_TAB);
    reveal(core, 'git:changes', change.absolute);
  };

  return (
    <VirtualList
      items={items}
      keyOf={(item) => (item.kind === 'repo' ? `repo:${item.repo.repo.root}` : item.change.absolute)}
      estimate={(item) => (item.kind === 'file' ? ROW : item.repo.changes.length > 0 ? HEAD : EMPTY)}
      className="h-full"
    >
      {(item) =>
        item.kind === 'repo' ? (
          <Repo session={shown} repo={item.repo} titled={repos.length > 1} />
        ) : (
          <Row change={item.change} onStage={(on) => core.act(core.stage(shown, [item.change.absolute], on))} onOpen={() => open(item.change)} />
        )
      }
    </VirtualList>
  );
}

/** A repository's head: its name when the folder holds several, the commit box, Stage All and Commit, and how much changed. */
function Repo({ session, repo, titled }: { session: string; repo: RepoChanges; titled: boolean }) {
  const core = useCore();
  const [messages, setMessages] = useAtom(messagesAtom);

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const { root } = repo.repo;
  const message = messages[root] ?? '';
  const branch = repo.branch ?? 'HEAD';
  const staged = repo.changes.filter((change) => change.staged);
  const everything = repo.changes.length > 0 && repo.changes.every((change) => change.staged === 'all');
  const ready = message.trim() !== '' && staged.length > 0 && !busy;

  const setMessage = (text: string) => setMessages((all) => ({ ...all, [root]: text }));

  const stage = (changes: FileChange[], on: boolean) => {
    setProblem(undefined);
    core.stage(session, changes.map((change) => change.absolute), on).catch((error: Error) => setProblem(error.message));
  };

  const commit = async () => {
    if (!ready) return;

    setBusy(true);
    setProblem(undefined);

    try {
      await core.commit(session, root, message.trim());
      setMessage('');
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      void commit();
    }
  };

  return (
    <section className="flex flex-col gap-2 pt-3 pb-1 first:pt-0">
      {titled && (
        <div className="flex h-6 items-center gap-2 px-1">
          <FolderGit2 className="size-4 shrink-0 text-faint" />
          <span className="min-w-0 truncate font-medium">{repo.repo.label}</span>
          <span className="flex min-w-0 items-center gap-1 text-faint">
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate">{branch}</span>
          </span>
        </div>
      )}
      {repo.changes.length === 0 ? (
        <p className="px-1 text-pretty text-muted">Nothing to commit on {branch}.</p>
      ) : (
        <>
          <textarea
            name="message"
            aria-label={`Commit message for ${repo.repo.label}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={keyDown}
            placeholder={`Message (⌘↵ to commit on ${branch})`}
            rows={3}
            className="w-full resize-none rounded-lg bg-shade px-3 py-2 outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="small" onClick={() => stage(repo.changes, !everything)}>
              {everything ? 'Unstage All' : 'Stage All'}
            </Button>
            <div className="flex-1" />
            <Button variant="primary" size="small" disabled={!ready} onClick={() => void commit()}>
              {busy ? 'Committing' : 'Commit'}
            </Button>
          </div>
          {problem && <p className="rounded-lg bg-removed-surface px-3 py-2 text-pretty whitespace-pre-wrap text-removed-ink">{problem}</p>}
          <p className="px-1 pt-1 text-small text-muted">
            {repo.changes.length} changed {repo.changes.length === 1 ? 'file' : 'files'}
            {staged.length > 0 && `, ${staged.length} staged`}
          </p>
        </>
      )}
    </section>
  );
}

function Row({ change, onStage, onOpen }: { change: FileChange; onStage: (on: boolean) => void; onOpen: () => void }) {
  const name = change.file.slice(change.file.lastIndexOf('/') + 1);
  const folder = change.file.slice(0, -name.length - 1);

  return (
    <div className="flex h-7 items-center gap-2 rounded-lg px-1 hover:bg-shade">
      <input
        type="checkbox"
        aria-label={`Stage ${change.file}`}
        checked={change.staged === 'all'}
        ref={(node) => {
          if (node) node.indeterminate = change.staged === 'some';
        }}
        onChange={() => onStage(change.staged !== 'all')}
        className="size-3.5 shrink-0 accent-primary"
      />
      <button type="button" onClick={onOpen} title={change.file} className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 text-left">
        <Letter kind={change.kind} />
        <span className={classNames('shrink-0', change.kind === 'deleted' && 'text-muted line-through')}>{name}</span>
        <span className="min-w-0 truncate text-faint">{folder}</span>
      </button>
    </div>
  );
}

const LETTERS: Record<FileChange['kind'], { letter: string; tone: string; label: string }> = {
  modified: { letter: 'M', tone: 'bg-accent/15 text-accent', label: 'Modified' },
  added: { letter: 'A', tone: 'bg-added-surface text-added-ink', label: 'Added' },
  untracked: { letter: 'U', tone: 'bg-added-surface text-added-ink', label: 'Untracked' },
  deleted: { letter: 'D', tone: 'bg-removed-surface text-removed-ink', label: 'Deleted' },
  renamed: { letter: 'R', tone: 'bg-warning/15 text-warning', label: 'Renamed' },
};

function Letter({ kind }: { kind: FileChange['kind'] }) {
  const { letter, tone, label } = LETTERS[kind];

  return (
    <span title={label} className={classNames('flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-semibold', tone)}>
      {letter}
    </span>
  );
}

function Note({ children }: { children: string }) {
  return <p className="px-1 text-pretty text-muted">{children}</p>;
}
