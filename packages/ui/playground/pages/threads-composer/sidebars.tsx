import { classNames, LineCounts, StatusIcon } from '@jinion/ui';
import { ChevronRight, History, Pin, Search, SquarePen } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { type Thread, threads } from './fixtures.js';

const ACTIVE = '3';

/** The sidebar as it is today: a large title, New thread as a row, the threads by day, the older days closed. */
export function CurrentSidebar() {
  const [open, setOpen] = useState(new Set(['Today', 'Yesterday']));
  const groups = byDay();

  return (
    <Aside>
      <h2 className="px-3 pt-1 text-title font-semibold">Threads</h2>
      <button type="button" className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-ink/80 hover:bg-shade">
        <SquarePen className="size-4 text-muted" />
        <span className="flex-1 text-left">New thread</span>
        <span className="text-faint">⌘N</span>
      </button>
      {groups.map(([label, items]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <Toggle label={label} count={items.length} open={open.has(label)} onToggle={() => setOpen(toggled(open, label))} />
          {open.has(label) && items.map((thread) => <TwoLine key={thread.id} thread={thread} />)}
        </div>
      ))}
    </Aside>
  );
}

/** Quiet: no title, a search and a new-thread icon on top, one line a thread, the days as faint labels, older ones behind a row. */
export function QuietSidebar() {
  const [older, setOlder] = useState(false);
  const recent = threads.filter((thread) => thread.days < 7);
  const rest = threads.filter((thread) => thread.days >= 7);

  return (
    <Aside>
      <div className="flex items-center gap-1">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-shade px-2.5 text-faint">
          <Search className="size-4 shrink-0" />
          <input aria-label="Search threads" placeholder="Search threads" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint" />
        </label>
        <IconButton label="New thread (⌘N)">
          <SquarePen />
        </IconButton>
      </div>
      <div className="flex flex-col">
        {labelled(recent).map(([label, items]) => (
          <div key={label} className="flex flex-col">
            <p className="px-3 pt-3 pb-1 text-[11px]/4 font-medium text-faint">{label}</p>
            {items.map((thread) => (
              <OneLine key={thread.id} thread={thread} />
            ))}
          </div>
        ))}
        {older && rest.map((thread) => <OneLine key={thread.id} thread={thread} />)}
        <button type="button" onClick={() => setOlder(!older)} className="mt-2 flex h-8 items-center gap-2 rounded-lg px-3 text-muted hover:bg-shade hover:text-ink">
          <History className="size-4" />
          {older ? 'Show fewer' : `Show ${rest.length} older`}
        </button>
      </div>
    </Aside>
  );
}

/** By status: what waits on the user first, with its question, then what works, then today's, the rest closed. */
export function StatusSidebar() {
  const [earlier, setEarlier] = useState(false);
  const waiting = threads.filter((thread) => thread.state === 'waiting');
  const working = threads.filter((thread) => thread.state === 'working');
  const recent = threads.filter((thread) => thread.state === 'done' && thread.days < 2);
  const rest = threads.filter((thread) => thread.state === 'done' && thread.days >= 2);

  return (
    <Aside>
      <Header />
      <Section label="Needs you" count={waiting.length} tone="text-warning">
        {waiting.map((thread) => (
          <div key={thread.id} className="flex flex-col gap-1.5 rounded-lg px-3 py-2 hover:bg-shade">
            <Title thread={thread} />
            <p className="line-clamp-2 pl-5 text-pretty text-warning">{thread.news}</p>
            <button type="button" className="ml-5 h-6 self-start rounded-full bg-primary px-2.5 text-small font-medium text-on-primary">
              Answer
            </button>
          </div>
        ))}
      </Section>
      <Section label="Working" count={working.length}>
        {working.map((thread) => (
          <TwoLine key={thread.id} thread={thread} />
        ))}
      </Section>
      <Section label="Recent" count={recent.length}>
        {recent.map((thread) => (
          <OneLine key={thread.id} thread={thread} counts />
        ))}
      </Section>
      <div className="flex flex-col">
        <Toggle label="Earlier" count={rest.length} open={earlier} onToggle={() => setEarlier(!earlier)} />
        {earlier && rest.map((thread) => <OneLine key={thread.id} thread={thread} />)}
      </div>
    </Aside>
  );
}

/** Timeline: the days down a line, each thread a point on it in its state, the older months closed. */
export function TimelineSidebar() {
  const [open, setOpen] = useState(new Set<string>());
  const days = labelled(threads.filter((thread) => thread.days < 30));

  const months = [
    ['September', threads.filter((thread) => thread.days >= 30 && thread.days < 60)],
    ['August', threads.filter((thread) => thread.days >= 60)],
  ] as const;

  return (
    <Aside>
      <Header />
      <div className="relative flex flex-col pl-2">
        <span aria-hidden className="absolute top-3 bottom-20 left-[17px] w-px bg-ink/15" />
        {days.map(([label, items]) => (
          <div key={label} className="flex flex-col">
            <p className="relative z-10 flex h-7 items-center gap-3 pl-[5px] text-[11px]/4 font-medium text-muted">
              <span className="size-2.5 rounded-full bg-chrome ring-[1.5px] ring-ink/25" />
              {label}
            </p>
            {items.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={classNames('group flex h-8 items-center gap-3 rounded-lg pr-3 pl-1.5 text-left', thread.id === ACTIVE ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade')}
              >
                <span
                  className={classNames(
                    'relative z-10 size-2 shrink-0 rounded-full ring-2 ring-chrome',
                    thread.state === 'working' ? 'bg-primary' : thread.state === 'waiting' ? 'bg-warning' : 'bg-faint/70',
                  )}
                />
                <span className={classNames('min-w-0 flex-1 truncate', thread.state === 'waiting' && 'text-warning')}>{thread.title}</span>
                <span className="shrink-0 text-faint tabular-nums">{thread.ago}</span>
              </button>
            ))}
          </div>
        ))}
        {months.map(([label, items]) => (
          <div key={label} className="flex flex-col">
            <Toggle label={label} count={items.length} open={open.has(label)} onToggle={() => setOpen(toggled(open, label))} />
            {open.has(label) && items.map((thread) => <OneLine key={thread.id} thread={thread} />)}
          </div>
        ))}
      </div>
    </Aside>
  );
}

/** Pinned and recent: the threads the user pinned, the last week's, and every older one a row away, in a history of its own. */
export function PinnedSidebar() {
  const pinned = threads.filter((thread) => thread.pinned);
  const recent = threads.filter((thread) => !thread.pinned && thread.days < 7);
  const rest = threads.filter((thread) => !thread.pinned && thread.days >= 7);

  return (
    <Aside>
      <Header />
      <Section label="Pinned" count={pinned.length} icon={<Pin className="size-3" />}>
        {pinned.map((thread) => (
          <OneLine key={thread.id} thread={thread} />
        ))}
      </Section>
      <Section label="This week" count={recent.length}>
        {recent.map((thread) => (
          <OneLine key={thread.id} thread={thread} />
        ))}
      </Section>
      <button type="button" className="flex h-9 items-center gap-2 rounded-lg px-3 text-muted ring-1 ring-edge hover:bg-shade hover:text-ink">
        <History className="size-4" />
        <span className="flex-1 text-left">All threads</span>
        <span className="text-faint tabular-nums">{rest.length + recent.length + pinned.length}</span>
        <ChevronRight className="size-4 text-faint" />
      </button>
    </Aside>
  );
}

/** Compact: one dense row a thread, its state, title, changes and time in columns, a thin line between the months. */
export function CompactSidebar() {
  return (
    <Aside>
      <Header />
      <div className="flex flex-col">
        {[
          ['October', threads.filter((thread) => thread.days < 30)],
          ['September', threads.filter((thread) => thread.days >= 30 && thread.days < 60)],
          ['August', threads.filter((thread) => thread.days >= 60)],
        ].map(([label, items]) => (
          <div key={label as string} className="flex flex-col">
            <p className="flex items-center gap-2 px-3 pt-3 pb-1 text-[11px]/4 font-medium text-faint">
              {label as string}
              <span className="h-px flex-1 bg-line" />
            </p>
            {(items as Thread[]).map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={classNames(
                  'grid h-7 grid-cols-[0.75rem_minmax(0,1fr)_auto_2rem] items-center gap-2 rounded-md px-3 text-left',
                  thread.id === ACTIVE ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade',
                )}
              >
                <span className="flex justify-center">
                  <StatusIcon status={thread.state === 'done' ? 'idle' : thread.state} />
                </span>
                <span className="truncate">{thread.title}</span>
                <span className="text-small">{thread.added ? <LineCounts added={thread.added} removed={thread.removed ?? 0} /> : null}</span>
                <span className="text-right text-small text-faint tabular-nums">{thread.ago}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Aside>
  );
}

function Aside({ children }: { children: ReactNode }) {
  return <aside className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto px-2 pt-1 pb-3 [scrollbar-width:none]">{children}</aside>;
}

/** A small header: the word Threads and the icon that starts one. */
function Header() {
  return (
    <div className="flex h-8 items-center gap-1 pl-3">
      <p className="flex-1 font-medium text-muted">Threads</p>
      <IconButton label="Search threads">
        <Search />
      </IconButton>
      <IconButton label="New thread (⌘N)">
        <SquarePen />
      </IconButton>
    </div>
  );
}

function Section({ label, count, tone, icon, children }: { label: string; count: number; tone?: string; icon?: ReactNode; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <div className="flex flex-col">
      <p className={classNames('flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px]/4 font-medium', tone ?? 'text-faint')}>
        {icon}
        {label}
        <span className="text-faint tabular-nums">{count}</span>
      </p>
      {children}
    </div>
  );
}

function Toggle({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="mt-1 flex h-7 items-center gap-1.5 rounded-lg px-3 text-left font-medium text-muted hover:text-ink">
      <ChevronRight className={classNames('size-3.5 text-faint transition-transform', open && 'rotate-90')} />
      <span className="flex-1">{label}</span>
      {!open && <span className="font-normal text-faint tabular-nums">{count}</span>}
    </button>
  );
}

function Title({ thread }: { thread: Thread }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex w-3 shrink-0 justify-center">
        <StatusIcon status={thread.state === 'done' ? 'idle' : thread.state} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{thread.title}</span>
      <span className="shrink-0 text-faint tabular-nums">{thread.ago}</span>
    </span>
  );
}

function OneLine({ thread, counts }: { thread: Thread; counts?: boolean }) {
  return (
    <button
      type="button"
      className={classNames('flex h-8 items-center gap-2 rounded-lg px-3 text-left', thread.id === ACTIVE ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade')}
    >
      <span className="flex w-3 shrink-0 justify-center">
        <StatusIcon status={thread.state === 'done' ? 'idle' : thread.state} />
      </span>
      <span className="min-w-0 flex-1 truncate">{thread.title}</span>
      {counts && thread.added ? <LineCounts added={thread.added} removed={thread.removed ?? 0} /> : <span className="shrink-0 text-faint tabular-nums">{thread.ago}</span>}
    </button>
  );
}

function TwoLine({ thread }: { thread: Thread }) {
  return (
    <button
      type="button"
      className={classNames('flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left', thread.id === ACTIVE ? 'bg-background shadow-xs ring-1 ring-edge' : 'hover:bg-shade')}
    >
      <Title thread={thread} />
      <span className="flex items-center gap-2 pl-5">
        <span className={classNames('min-w-0 flex-1 truncate', thread.state === 'waiting' ? 'text-warning' : 'text-muted')}>{thread.news}</span>
        {thread.added ? <LineCounts added={thread.added} removed={thread.removed ?? 0} /> : null}
      </span>
    </button>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-shade hover:text-ink [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function byDay(): [string, Thread[]][] {
  const groups = new Map<string, Thread[]>();

  for (const thread of threads) {
    const label = thread.days === 0 ? 'Today' : thread.days === 1 ? 'Yesterday' : thread.days < 30 ? dayOf(thread.days) : thread.days < 60 ? '1 month ago' : '2 months ago';

    groups.set(label, [...(groups.get(label) ?? []), thread]);
  }

  return [...groups];
}

/** The day so many days before 10 October, as the app writes it: 7th Oct. */
function dayOf(days: number) {
  const date = new Date(2026, 9, 10 - days);
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';

  return `${day}${suffix} ${date.toLocaleString('en', { month: 'short' })}`;
}

/** Today, Yesterday, This week, This month, as faint labels. */
function labelled(items: Thread[]): [string, Thread[]][] {
  const groups = new Map<string, Thread[]>();

  for (const thread of items) {
    const label = thread.days === 0 ? 'Today' : thread.days === 1 ? 'Yesterday' : thread.days < 7 ? 'This week' : 'This month';

    groups.set(label, [...(groups.get(label) ?? []), thread]);
  }

  return [...groups];
}

function toggled(set: Set<string>, value: string) {
  const next = new Set(set);

  if (!next.delete(value)) next.add(value);

  return next;
}
