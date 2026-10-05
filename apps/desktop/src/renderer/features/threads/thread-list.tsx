import type { SavedSummary, SessionSnapshot } from '@jinion/core/api/schemas';
import { classNames, StatusIcon } from '@jinion/ui';
import { Dot, useLayout, useWorkbench } from '@jinion/workbench';
import { atom, useAtomValue } from 'jotai';
import { Lock } from 'lucide-react';
import { useMemo } from 'react';
import type { Core } from '../../core/core.js';
import { ago } from '../../lib/time.js';
import { statusOf, useCore } from '../../state/session.js';
import { keepOrder } from './order.js';

/** Each project's order of its threads, kept while the app runs, so the sidebar shows them as it left them. */
const orders = new WeakMap<Core, string[]>();

interface Thread {
  id: string;
  title: string;
  at: number;
  snapshot?: SessionSnapshot;
  saved?: SavedSummary;
}

/** Every thread of the project once, open or saved, in an order that doesn't move under the pointer. */
export function ThreadList() {
  const core = useCore();
  const threads = useThreads();

  const order = keepOrder(orders.get(core) ?? [], threads);
  const byId = new Map(threads.map((thread) => [thread.id, thread]));

  orders.set(core, order);

  if (threads.length === 0) return <p className="px-2 text-pretty text-muted">Threads show here once you start one.</p>;

  return (
    <ul className="flex flex-col">
      {order.flatMap((id) => {
        const thread = byId.get(id);

        return thread ? [<Row key={id} thread={thread} />] : [];
      })}
    </ul>
  );
}

/** On the Threads item of the activity bar: a thread waits on the user. */
export function Waiting() {
  const threads = useThreads();

  return threads.some((thread) => thread.snapshot && statusOf(thread.snapshot) === 'waiting') ? <Dot tone="warning" /> : null;
}

function Row({ thread }: { thread: Thread }) {
  const core = useCore();
  const workbench = useWorkbench();
  const active = useLayout((layout) => layout.groups[layout.focused]?.active === `thread:${thread.id}`);

  const elsewhere = !thread.snapshot && thread.saved?.openElsewhere;

  const open = () => {
    if (thread.snapshot) workbench.open({ kind: 'thread', id: thread.id });
    else core.act(core.resume(thread.id));
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className={classNames('flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left', active ? 'bg-selected' : 'hover:bg-shade')}
      >
        <span className="flex w-3 shrink-0 justify-center">
          {elsewhere ? (
            <Lock className="size-3.5 text-faint" aria-label="Open in another Jinion" />
          ) : (
            <StatusIcon status={(thread.snapshot && statusOf(thread.snapshot)) ?? 'idle'} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        <span className="shrink-0 text-faint tabular-nums">{elsewhere ? 'elsewhere' : ago(thread.at)}</span>
      </button>
    </li>
  );
}

/** The project's threads by id: an open one's title and state from its session, a saved one's from the list on disk. */
function useThreads(): Thread[] {
  const core = useCore();
  const saved = useAtomValue(core.savedAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);

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
