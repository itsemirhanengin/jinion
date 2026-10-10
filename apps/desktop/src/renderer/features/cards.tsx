import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { Card, classNames, LineCounts, StatusIcon } from '@jinion/ui';
import { type Feature, useMode, useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { SquareTerminal } from 'lucide-react';
import type { Core } from '../core/core.js';
import { lastWordsOf, newsOf } from '../state/news.js';
import { previewStatesAtom, previewUrlsAtom } from '../state/previews.js';
import { changesOf, statusOf, useActiveSession, useCore } from '../state/session.js';
import { openChanges } from './changes/changes.js';
import { openPlan, planTitle, plansOf } from './plan/plans.js';
import { useCapture } from './preview/capture.js';
import { loadPreview, openPreview, PREVIEW } from './preview/previews.js';
import { useHasTasks } from './tasks.js';
import { useActiveThreads } from './threads/active.js';

/** How many changed files the Changes card names; the rest are a count that opens the review. */
const LISTED = 10;

/** The right panel: what goes on in the project, each in a card that opens it. */
export function cards(): Feature {
  return { id: 'cards', views: [{ id: 'cards', title: 'Cards', place: 'right', Content: Cards }] };
}

function Cards() {
  const core = useCore();
  const mode = useMode();
  const session = useActiveSession();
  const active = useActiveThreads();

  // In Agent the thread shown has the window already; Code shows every thread at work.
  const others = active.filter((thread) => mode === 'code' || thread.id !== session?.id);

  return (
    <div className="flex flex-col gap-2 pb-2">
      {others.map((thread) => (
        <ThreadCard key={thread.id} id={thread.id} snapshot={thread.snapshot} />
      ))}
      {session && <ChangesCard id={session.id} snapshot={session} />}
      {session && mode === 'agent' && <PlanCard id={session.id} snapshot={session} />}
      <PreviewCard core={core} />
      {mode === 'agent' && <TerminalCard />}
      {mode === 'agent' && <TasksCard />}
    </div>
  );
}

/** A thread at work or waiting, wherever the user is: its last words and what it does or asks now. */
function ThreadCard({ id, snapshot }: { id: string; snapshot: SessionSnapshot }) {
  const workbench = useWorkbench();
  const status = statusOf(snapshot);
  const words = lastWordsOf(snapshot);
  const news = newsOf(snapshot);

  const open = () => {
    workbench.setMode('agent');
    workbench.open({ kind: 'thread', id });
  };

  return (
    <Card
      title={
        <>
          <StatusIcon status={status ?? 'idle'} />
          <span className="truncate">{snapshot.state.title ?? 'New thread'}</span>
        </>
      }
      action={status === 'waiting' ? 'Answer' : 'Open'}
      onAction={open}
    >
      <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
        {words && status !== 'waiting' && <p className="line-clamp-3 text-pretty text-ink/85">{words}</p>}
        {news && <p className={classNames('line-clamp-2 text-pretty', status === 'waiting' ? 'text-warning' : 'text-muted')}>{news}</p>}
      </div>
    </Card>
  );
}

function ChangesCard({ id, snapshot }: { id: string; snapshot: SessionSnapshot }) {
  const core = useCore();
  const workbench = useWorkbench();
  const files = changesOf(snapshot);

  if (files.length === 0) return null;

  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  return (
    <Card title="Changes" detail={<LineCounts added={added} removed={removed} />} action="Review" onAction={() => openChanges(core, workbench, id)}>
      <ul className="flex flex-col py-1">
        {files.slice(0, LISTED).map((file) => {
          const name = file.path.slice(file.path.lastIndexOf('/') + 1);

          return (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => openChanges(core, workbench, id, file.path)}
                className="flex h-8 w-full cursor-default items-center gap-2 px-3.5 text-left hover:bg-shade"
              >
                <span className="shrink-0">{name}</span>
                <span className="min-w-0 flex-1 truncate text-faint">{file.path.slice(0, -name.length - 1)}</span>
                {file.created && <span className="text-faint">new</span>}
                <LineCounts added={file.added} removed={file.removed} />
              </button>
            </li>
          );
        })}
        {files.length > LISTED && (
          <li>
            <button
              type="button"
              onClick={() => openChanges(core, workbench, id)}
              className="flex h-8 w-full cursor-default items-center px-3.5 text-left text-muted hover:bg-shade hover:text-ink"
            >
              +{files.length - LISTED} more
            </button>
          </li>
        )}
      </ul>
    </Card>
  );
}

function PlanCard({ id, snapshot }: { id: string; snapshot: SessionSnapshot }) {
  const workbench = useWorkbench();
  const plans = plansOf(snapshot.state.entries);
  const latest = plans.at(-1);

  if (!latest) return null;

  return <Card title="Plan" detail={planTitle(latest.plan)} action="Open" onAction={() => openPlan(workbench, id, latest.id)} />;
}

/**
 * The project's preview: a picture of its page, taken again while it shows; with none open, the address a terminal of
 * the project printed, which opens one at it.
 */
function PreviewCard({ core }: { core: Core }) {
  const workbench = useWorkbench();
  const terminals = useAtomValue(core.terminalsAtom);
  const urls = useAtomValue(previewUrlsAtom);
  const states = useAtomValue(previewStatesAtom);
  const tab = workbench.tabs().find((each) => each.kind === PREVIEW);
  const image = useCapture(core, tab?.id);

  const url = tab && (states[tab.id]?.url ?? urls[tab.id]);
  const printed = terminals.flatMap((terminal) => terminal.urls ?? [])[0];

  const open = () => {
    if (tab) return workbench.open(tab);

    openPreview(core, workbench);

    const opened = workbench.tabs().findLast((each) => each.kind === PREVIEW);

    if (opened && printed) loadPreview(core, opened.id, printed);
  };

  return (
    <Card
      title="Preview"
      detail={(url || printed) && <Address url={url || printed!} live={Boolean(url)} />}
      action="Open"
      onAction={open}
    >
      {image ? (
        <button type="button" onClick={open} className="block w-full cursor-default bg-raised p-2">
          <img src={image} alt="" className="w-full rounded-md ring-1 ring-edge" />
        </button>
      ) : (
        !url && <p className="px-3.5 py-2.5 text-pretty text-muted">{printed ? 'Your dev server is up. Open it to see the page here.' : 'Open a page of your dev server here.'}</p>
      )}
    </Card>
  );
}

function Address({ url, live }: { url: string; live: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {live && <span className="size-1.5 shrink-0 rounded-full bg-added" />}
      <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
    </span>
  );
}

/** The project's terminals, each with whether it runs; one opens the terminal panel. */
function TerminalCard() {
  const core = useCore();
  const workbench = useWorkbench();
  const terminals = useAtomValue(core.terminalsAtom);

  return (
    <Card title="Terminal" detail={terminals.length > 0 && terminals.length} action="Open" onAction={() => workbench.showView('bottom', 'terminal')}>
      {terminals.length === 0 ? (
        <p className="px-3.5 py-2.5 text-muted">No terminals open.</p>
      ) : (
        <ul className="flex flex-col py-1">
          {terminals.map((terminal) => (
            <li key={terminal.id}>
              <button
                type="button"
                onClick={() => workbench.showView('bottom', 'terminal')}
                className="flex h-8 w-full cursor-default items-center gap-2 px-3.5 text-left hover:bg-shade"
              >
                <SquareTerminal className="size-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate font-mono text-mono">{terminal.title}</span>
                {terminal.running ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-added" title="Running" />
                ) : (
                  terminal.exitCode !== undefined && <span className={classNames('shrink-0', terminal.exitCode === 0 ? 'text-faint' : 'text-error')}>exit {terminal.exitCode}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TasksCard() {
  const workbench = useWorkbench();
  const session = useActiveSession();
  const hasTasks = useHasTasks();

  if (!hasTasks || !session) return null;

  const running = session.fields.tasks.filter((task) => task.status === 'running').length;
  const todos = session.state.todos.flatMap((group) => group.items);

  return (
    <Card title="Tasks" detail={running > 0 && `${running} running`} action="Open" onAction={() => workbench.showView('bottom', 'tasks')}>
      {todos.length > 0 && (
        <p className="px-3.5 py-2.5 text-muted">
          {todos.filter((item) => item.status === 'done').length} of {todos.length} todos done
        </p>
      )}
    </Card>
  );
}
