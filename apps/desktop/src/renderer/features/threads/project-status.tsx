import type { UsageProfile } from '@jinion/core/agent/usage';
import { Card, StatusIcon } from '@jinion/ui';
import { useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { CircleCheck, FilePen, SquareTerminal } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { greeting } from '../../lib/greeting.js';
import { compact, counted } from '../../lib/numbers.js';
import { ago } from '../../lib/time.js';
import { Activity } from '../../panels/profile/activity.js';
import { newsOf } from '../../state/news.js';
import { useProfile } from '../../state/profile.js';
import { saveSeen, savedSeen } from '../../state/saved.js';
import { changesOf, useCore } from '../../state/session.js';
import { useGit } from '../git/use-git.js';
import { useCapture } from '../preview/capture.js';
import { PREVIEW } from '../preview/previews.js';
import { useOpenSessions } from './active.js';

/** When the user was last here before this run, by project; read once, so what changed since stays put while the app runs. */
const before = new Map<string, number | undefined>();

const weekday = new Intl.DateTimeFormat('en', { weekday: 'long' });

/** How many files changed by hand the card names; the rest are a count that opens Git. */
const HAND = 5;

/**
 * A thread that hasn't started opens on where the project stands: a line for the time of day, what waits on the user,
 * what runs, what changed since they were last here and their year with Jinion; `children`, the composer, at the foot.
 */
export function ProjectStatus({ children }: { children: ReactNode }) {
  const core = useCore();
  const workbench = useWorkbench();
  const threads = useOpenSessions();
  const terminals = useAtomValue(core.terminalsAtom);
  const saved = useAtomValue(core.savedAtom);
  const hand = useHandChanges(threads.map((thread) => thread.snapshot));
  const seen = useLastSeen(core.project.path);
  const { name, usage } = useProfile();

  const waiting = threads.filter((thread) => thread.status === 'waiting');
  const working = threads.filter((thread) => thread.status === 'working');
  const running = terminals.filter((terminal) => terminal.running);
  const server = running.some((terminal) => (terminal.urls ?? []).length > 0);
  const finished = seen ? saved.filter((thread) => thread.updatedAt > seen && !threads.some((open) => open.id === thread.id)) : [];

  const open = (id: string) => workbench.open({ kind: 'thread', id });

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-208 flex-col gap-5 px-8 pt-10 pb-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl/7 font-medium tracking-tight">{greeting(new Date(), name.split(/[\s.]/)[0] || name)}</h1>
            <p className="text-pretty text-muted">{summary(waiting.length, working.length, server)}</p>
          </header>

          {waiting.length > 0 && (
            <Card title="Waiting on you" detail={counted(waiting.length, 'thread')}>
              <ul className="flex flex-col divide-y divide-line">
                {waiting.map((thread) => (
                  <li key={thread.id} className="flex flex-col gap-2.5 px-3.5 py-3">
                    <p className="flex items-center gap-2">
                      <StatusIcon status="waiting" />
                      <span className="min-w-0 flex-1 truncate font-medium">{thread.snapshot.state.title ?? 'New thread'}</span>
                    </p>
                    <p className="text-pretty text-ink/85">{newsOf(thread.snapshot)}</p>
                    <button
                      type="button"
                      onClick={() => open(thread.id)}
                      className="h-7 self-start rounded-full bg-primary px-3.5 font-medium text-on-primary hover:bg-primary/90"
                    >
                      Answer
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(running.length > 0 || finished.length > 0 || hand.length > 0) && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
              {running.length > 0 && (
                <Card title="Running" detail={counted(running.length, 'terminal')} action="Open" onAction={() => workbench.showView('bottom', 'terminal')}>
                  <ul className="flex flex-col py-1">
                    {running.map((terminal) => (
                      <li key={terminal.id} className="flex h-8 items-center gap-2 px-3.5">
                        <SquareTerminal className="size-4 shrink-0 text-faint" />
                        <span className="min-w-0 flex-1 truncate font-mono text-mono">{terminal.title}</span>
                        {terminal.urls?.[0] && (
                          <span className="flex shrink-0 items-center gap-1.5 text-faint">
                            <span className="size-1.5 rounded-full bg-added" />
                            {terminal.urls[0].replace(/^https?:\/\//, '')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <PreviewPicture />
                </Card>
              )}
              {(finished.length > 0 || hand.length > 0) && (
                <Card title="Since last time" detail={seen && `${ago(seen)} ago`}>
                  <ul className="flex flex-col py-1">
                    {finished.map((thread) => (
                      <Since key={thread.id} icon={<CircleCheck />} text={thread.title} detail={ago(thread.updatedAt)} onClick={() => core.act(core.resume(thread.id))} />
                    ))}
                    {hand.slice(0, HAND).map((path) => (
                      <Since key={path} icon={<FilePen />} text={path.slice(path.lastIndexOf('/') + 1)} detail="changed by hand" />
                    ))}
                    {hand.length > HAND && (
                      <Since icon={<FilePen />} text={`${counted(hand.length - HAND, 'more file')} changed by hand`} detail="Git" onClick={() => workbench.activate('git')} />
                    )}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {usage && usage.activeDays > 0 && (
            <Card
              title="Your activity"
              detail={usage.currentStreak > 0 && `${counted(usage.currentStreak, 'day')} in a row`}
              action="Profile"
              onAction={() => workbench.open({ kind: 'page', id: 'profile' })}
            >
              <div className="flex flex-col gap-3 px-3.5 pt-2 pb-3">
                <Activity days={usage.days} titled={false} />
                <p className="text-pretty text-muted">{usageLine(usage)}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
      {/* The fade over the status's end stops short of its scrollbar, as the conversation's does. */}
      <div className="relative shrink-0 before:pointer-events-none before:absolute before:inset-x-2.5 before:-top-8 before:h-8 before:bg-linear-to-t before:from-background before:to-transparent">
        <div className="mx-auto flex w-full max-w-208 flex-col gap-3 px-8 pt-1 pb-4">{children}</div>
      </div>
    </div>
  );
}

function Since({ icon, text, detail, onClick }: { icon: ReactNode; text: string; detail: string; onClick?: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-8 w-full cursor-default items-center gap-2 px-3.5 text-left hover:bg-shade [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <span className="shrink-0 text-faint">{detail}</span>
      </button>
    </li>
  );
}

/** The project's preview as a picture, under what runs, when one is open and drawn. */
function PreviewPicture() {
  const core = useCore();
  const workbench = useWorkbench();
  const tab = workbench.tabs().find((each) => each.kind === PREVIEW);
  const image = useCapture(core, tab?.id);

  if (!tab || !image) return null;

  return (
    <button type="button" onClick={() => workbench.open(tab)} className="block w-full cursor-default border-t border-line bg-raised p-2">
      <img src={image} alt="" className="w-full rounded-md ring-1 ring-edge" />
    </button>
  );
}

/** `One thread is waiting on you, one is at work, and the dev server is up.` */
function summary(waiting: number, working: number, server: boolean) {
  const parts: string[] = [];

  if (waiting > 0) parts.push(waiting === 1 ? 'one thread is waiting on you' : `${waiting} threads are waiting on you`);
  if (working > 0) parts.push(`${working === 1 ? 'one' : working}${waiting > 0 ? '' : working === 1 ? ' thread' : ' threads'} ${working === 1 ? 'is' : 'are'} at work`);
  if (server) parts.push('the dev server is up');
  if (parts.length === 0) return 'Nothing runs right now. Ask for a change below and it starts here.';

  const text = parts.length < 3 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;

  return `${text[0]!.toUpperCase()}${text.slice(1)}.`;
}

/** `312 sessions · 1.9B tokens · mostly Opus 5.5 · busiest on Thursdays` */
function usageLine(usage: UsageProfile) {
  const days = Array.from({ length: 7 }, () => 0);

  for (const day of usage.days) {
    const [year, month, date] = day.date.split('-').map(Number);

    days[new Date(year!, month! - 1, date).getDay()]! += day.tokens;
  }

  // 7 January 2024 was a Sunday, the day `getDay` counts from.
  const busiest = weekday.format(new Date(2024, 0, 7 + days.indexOf(Math.max(...days))));

  return [counted(usage.sessions, 'session'), `${compact(usage.tokens)} tokens`, usage.models[0] && `mostly ${usage.models[0].name}`, `busiest on ${busiest}s`]
    .filter(Boolean)
    .join(' · ');
}

/** The project's files git sees changed that no open thread changed, so changed by hand. */
function useHandChanges(snapshots: Parameters<typeof changesOf>[0][]) {
  const core = useCore();
  const { repos } = useGit();

  const root = `${core.project.path}/`;
  const byThreads = new Set(snapshots.flatMap((snapshot) => changesOf(snapshot).map((file) => file.path)));

  return (repos ?? [])
    .flatMap((repo) => repo.changes)
    .flatMap((change) => (change.absolute.startsWith(root) ? [change.absolute.slice(root.length)] : []))
    .filter((path) => !byThreads.has(path));
}

/** When the user was last in the project before this run; now is kept as they leave it, for the next one. */
function useLastSeen(path: string) {
  if (!before.has(path)) before.set(path, savedSeen(path));

  useEffect(() => {
    const save = () => saveSeen(path);

    addEventListener('blur', save);
    addEventListener('beforeunload', save);

    return () => {
      save();
      removeEventListener('blur', save);
      removeEventListener('beforeunload', save);
    };
  }, [path]);

  return before.get(path);
}
