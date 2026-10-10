import type { SavedSummary, SessionSnapshot } from '@jinion/core/api/schemas';
import { Button, classNames, LineCounts, StatusIcon, VirtualList } from '@jinion/ui';
import { Dot, useLayout, useWorkbench } from '@jinion/workbench';
import { atom, useAtom, useAtomValue } from 'jotai';
import { Lock, Search, SquarePen } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import type { Core } from '../../core/core.js';
import { monthOf } from '../../lib/month-groups.js';
import { ago } from '../../lib/time.js';
import { countsOf } from '../../state/news.js';
import { statusOf, useCore } from '../../state/session.js';
import { spareThreadAtom, threadSearchAtom } from '../../state/threads.js';
import { keepOrder } from './order.js';
import { newThread } from './spare.js';

/** Each project's order of its threads, kept while the app runs, so the sidebar shows them as it left them. */
const orders = new WeakMap<Core, string[]>();

interface Thread {
  id: string;
  title: string;
  at: number;
  snapshot?: SessionSnapshot;
  saved?: SavedSummary;
}

type Item = { kind: 'month'; label: string } | { kind: 'thread'; thread: Thread };

const HEIGHTS = { month: 32, thread: 28 };

/**
 * Every thread of the project once, open or saved, a dense row each under the month it was last used in, in an order
 * that doesn't move under the pointer; the search over them filters them by title. Only the rows in view are drawn,
 * however many threads there are.
 */
export function ThreadList() {
  const core = useCore();
  const threads = useThreads();
  const search = useAtomValue(threadSearchAtom);

  const order = keepOrder(orders.get(core) ?? [], threads);
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const query = search?.trim().toLocaleLowerCase();
  const months = new Map<string, Thread[]>();

  orders.set(core, order);

  for (const id of order) {
    const thread = byId.get(id);
    if (!thread || (query && !thread.title.toLocaleLowerCase().includes(query))) continue;

    const month = monthOf(thread.at);

    months.set(month, [...(months.get(month) ?? []), thread]);
  }

  const items: Item[] = [...months].flatMap(([label, inMonth]) => [{ kind: 'month' as const, label }, ...inMonth.map((thread) => ({ kind: 'thread' as const, thread }))]);

  return (
    <VirtualList
      items={items}
      keyOf={(item) => (item.kind === 'month' ? `month:${item.label}` : item.thread.id)}
      estimate={(item) => HEIGHTS[item.kind]}
      className="h-full"
      // Room on both sides for the open thread's shadow, which the list would cut off at its edges.
      innerClassName="px-1"
      header={search !== undefined && <SearchField />}
      footer={
        items.length === 0 && (
          <p className="px-2 pt-2 text-pretty text-muted">{threads.length === 0 ? 'Threads show here once you start one.' : `No thread’s title has “${search?.trim()}”.`}</p>
        )
      }
    >
      {(item) =>
        item.kind === 'month' ? (
          <p className="flex items-center gap-2 px-2 pt-3 pb-1 text-[11px]/4 font-medium text-faint">
            {item.label}
            <span className="h-px flex-1 bg-line" />
          </p>
        ) : (
          <Row thread={item.thread} />
        )
      }
    </VirtualList>
  );
}

/** Beside the sidebar's title: the search over the threads, and a new thread. */
export function ThreadActions() {
  const core = useCore();
  const workbench = useWorkbench();
  const [search, setSearch] = useAtom(threadSearchAtom);

  return (
    <>
      <Button size="icon" aria-label="Search threads" title="Search threads" aria-pressed={search !== undefined} onClick={() => setSearch(search === undefined ? '' : undefined)}>
        <Search />
      </Button>
      <Button size="icon" aria-label="New thread" title="New thread (⌘N)" onClick={() => core.act(newThread(core, workbench))}>
        <SquarePen />
      </Button>
    </>
  );
}

/** On Agent while Code shows: a thread waits on the user. */
export function Waiting() {
  const threads = useThreads();

  return threads.some((thread) => thread.snapshot && statusOf(thread.snapshot) === 'waiting') ? <Dot tone="warning" /> : null;
}

/** Takes the focus once it opens; Escape, or leaving it empty, closes it. */
function SearchField() {
  const [search, setSearch] = useAtom(threadSearchAtom);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  return (
    <label className="mb-1 flex h-8 items-center gap-2 rounded-lg bg-shade px-2.5 text-faint">
      <Search className="size-4 shrink-0" />
      <input
        ref={input}
        aria-label="Search threads"
        placeholder="Search threads"
        value={search ?? ''}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setSearch(undefined)}
        onBlur={() => !search?.trim() && setSearch(undefined)}
        className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
      />
    </label>
  );
}

function Row({ thread }: { thread: Thread }) {
  const core = useCore();
  const workbench = useWorkbench();
  const active = useLayout((layout) => layout.groups[layout.focused]?.active === `thread:${thread.id}`);

  const elsewhere = !thread.snapshot && thread.saved?.openElsewhere;
  const status = thread.snapshot && statusOf(thread.snapshot);
  const counts = thread.snapshot && countsOf(thread.snapshot);

  const open = () => {
    if (thread.snapshot) workbench.open({ kind: 'thread', id: thread.id });
    else core.act(core.resume(thread.id));
  };

  return (
    <button
      type="button"
      onClick={open}
      className={classNames(
        'grid h-7 w-full cursor-default grid-cols-[0.75rem_minmax(0,1fr)_auto_2rem] items-center gap-2 rounded-md px-2 text-left',
        active ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade',
      )}
    >
      <span className="flex justify-center">
        {elsewhere ? <Lock className="size-3.5 text-faint" aria-label="Open in another Jinion" /> : <StatusIcon status={status ?? 'idle'} />}
      </span>
      <span className="truncate">{thread.title}</span>
      <span className="text-small">{counts && <LineCounts added={counts.added} removed={counts.removed} />}</span>
      <span className="text-right text-small text-faint tabular-nums">{ago(thread.at)}</span>
    </button>
  );
}

/** The project's threads by id: an open one's title and state from its session, a saved one's from the list on disk. */
function useThreads(): Thread[] {
  const core = useCore();
  const saved = useAtomValue(core.savedAtom);
  const spare = useAtomValue(spareThreadAtom);
  const all = useAtomValue(core.sessionsAtom).sessions;

  const sessions = all.filter((session) => session.id !== spare);
  const ids = sessions.map((session) => session.id).join();
  const snapshots = useMemo(() => atom((get) => sessions.map((session) => get(core.session(session.id)) as SessionSnapshot | undefined)), [core, ids]);
  const open = useAtomValue(snapshots);

  const threads = new Map<string, Thread>();

  for (const thread of saved) threads.set(thread.id, { id: thread.id, title: thread.title, at: thread.updatedAt, saved: thread });

  sessions.forEach((session, index) => {
    const snapshot = open[index];
    const known = threads.get(session.id);

    threads.set(session.id, {
      id: session.id,
      title: snapshot?.state.title ?? known?.title ?? session.title ?? 'New thread',
      at: known?.at ?? snapshot?.state.createdAt ?? Date.now(),
      snapshot,
      saved: known?.saved,
    });
  });

  return [...threads.values()];
}
