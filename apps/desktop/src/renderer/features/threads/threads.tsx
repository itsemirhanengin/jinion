import { nextMode } from '@jinion/core/agent/modes';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { classNames, StatusIcon } from '@jinion/ui';
import { Dot, type Feature, IconButton, useLayout, useWorkbench } from '@jinion/workbench';
import { atom, useAtomValue } from 'jotai';
import { Lock, MessagesSquare, Plus } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import type { Core } from '../../core/core.js';
import { ago } from '../../lib/time.js';
import { statusOf, useCore, useSession } from '../../state/session.js';
import { ThreadView } from './thread-view.js';

/** The project's threads: the open ones as tabs, the saved ones in the sidebar, each opening into a tab. */
export function threads(core: Core): Feature {
  const shown = () => {
    const id = core.client.store.get(core.client.shownAtom);
    const snapshot = id ? core.client.store.get(core.session(id)) : undefined;

    return id && snapshot ? { id, snapshot } : undefined;
  };

  const newThread = () => core.act(core.open());

  return {
    id: 'threads',
    activity: { title: 'Threads', icon: <MessagesSquare />, Badge: Waiting, Sidebar: ThreadList, Actions: NewThread },
    tabs: [{ kind: 'thread', Title: ThreadTitle, Mark: ThreadMark, Content: ThreadView, onClose: (id) => core.act(core.close(id)) }],
    commands: [
      { id: 'thread.new', title: 'New thread', keys: 'mod+n', run: newThread },
      { id: 'thread.new-tab', title: 'New thread', keys: 'mod+t', run: newThread },
      {
        id: 'thread.focus',
        title: 'Go to the composer',
        keys: 'mod+l',
        run: () => document.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.focus(),
      },
      {
        id: 'thread.mode',
        title: 'Next mode',
        keys: 'shift+tab',
        when: () => shown() !== undefined,
        run: () => {
          const { id, snapshot } = shown()!;
          const modes = core.client.store.get(core.appAtom)?.agents.find((agent) => agent.name === snapshot.fields.agent)?.modes ?? [];

          if (modes.length > 0) core.act(core.setMode(id, nextMode(modes, snapshot.fields.mode)));
        },
      },
      {
        id: 'thread.stop',
        title: 'Stop the turn',
        keys: 'escape',
        when: () => shown()?.snapshot.fields.working === true,
        run: () => core.act(core.interrupt(shown()!.id)),
      },
    ],
  };
}

function ThreadTitle({ id }: { id: string }) {
  const core = useCore();
  const snapshot = useSession(core, id);

  return snapshot?.state.title ?? 'New thread';
}

function ThreadMark({ id }: { id: string }) {
  const core = useCore();
  const snapshot = useSession(core, id);
  const status = snapshot && statusOf(snapshot);

  return status === 'working' || status === 'waiting' ? <StatusIcon status={status} /> : null;
}

function NewThread() {
  const core = useCore();

  return (
    <IconButton label="New thread" onClick={() => core.act(core.open())}>
      <Plus />
    </IconButton>
  );
}

function Waiting() {
  const snapshots = useOpenSnapshots();

  return snapshots.some(({ snapshot }) => snapshot && statusOf(snapshot) === 'waiting') ? <Dot tone="warning" /> : null;
}

function ThreadList() {
  const core = useCore();
  const saved = useAtomValue(core.savedAtom);
  const snapshots = useOpenSnapshots();

  const busy = snapshots.filter(({ snapshot }) => snapshot && ['working', 'waiting'].includes(statusOf(snapshot) ?? ''));

  // Whether a thread is open as a tab shows only in its row's background, never as a group of its own.
  const earlier = [
    ...snapshots.filter((each) => !busy.includes(each)).map(({ id, snapshot }) => ({ id, open: true, at: snapshot?.state.createdAt ?? 0 })),
    ...saved.filter((thread) => !snapshots.some(({ id }) => id === thread.id)).map((thread) => ({ id: thread.id, open: false, at: thread.updatedAt })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="flex flex-col gap-4">
      {busy.length > 0 && (
        <Group title="Working">
          {busy.map(({ id }) => (
            <OpenThread key={id} id={id} />
          ))}
        </Group>
      )}
      {earlier.length > 0 && (
        <Group title="Earlier">
          {earlier.map((each) => {
            if (each.open) return <OpenThread key={each.id} id={each.id} />;

            const thread = saved.find((candidate) => candidate.id === each.id)!;

            return (
              <Row
                key={thread.id}
                mark={thread.openElsewhere ? <Lock className="size-3.5 text-faint" aria-label="Open in another Jinion" /> : <StatusIcon status="idle" />}
                title={thread.title}
                trailing={thread.openElsewhere ? 'elsewhere' : ago(thread.updatedAt)}
                onClick={() => core.act(core.resume(thread.id))}
              />
            );
          })}
        </Group>
      )}
      {snapshots.length === 0 && saved.length === 0 && <p className="px-2 text-pretty text-muted">Threads show here once you start one.</p>}
    </div>
  );
}

function OpenThread({ id }: { id: string }) {
  const core = useCore();
  const workbench = useWorkbench();
  const snapshot = useSession(core, id);
  const active = useLayout((layout) => layout.groups[layout.focused]?.active === `thread:${id}`);

  if (!snapshot) return null;

  const { state } = snapshot;

  return (
    <Row
      mark={<StatusIcon status={statusOf(snapshot) ?? 'idle'} />}
      title={state.title ?? 'New thread'}
      trailing={ago(state.busySince ?? state.createdAt)}
      active={active}
      onClick={() => workbench.open({ kind: 'thread', id })}
    />
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-muted">{title}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

interface RowProps {
  mark: ReactNode;
  title: string;
  trailing: string;
  active?: boolean;
  onClick: () => void;
}

function Row({ mark, title, trailing, active, onClick }: RowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={classNames('flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left', active ? 'bg-selected' : 'hover:bg-shade')}
      >
        <span className="flex w-3 shrink-0 justify-center">{mark}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="shrink-0 text-faint tabular-nums">{trailing}</span>
      </button>
    </li>
  );
}

/** Every open thread with its snapshot, in one value, so a list can sort them by where they are. */
function useOpenSnapshots() {
  const core = useCore();
  const { sessions } = useAtomValue(core.sessionsAtom);

  const ids = sessions.map((session) => session.id).join();

  const all = useMemo(
    () => atom((get) => sessions.map((session) => ({ id: session.id, snapshot: get(core.session(session.id)) as SessionSnapshot | undefined }))),
    [core, ids],
  );

  return useAtomValue(all);
}
