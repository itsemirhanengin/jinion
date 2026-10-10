import { classNames, Spinner, Waiting } from '@jinion/ui';
import { ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronRight, GitBranch, Laptop, Plus, RotateCw, Search } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { changes, diff, people, type State, terminal } from './fixtures.js';

export type Palette = Record<`--${string}`, string>;

export interface DiffLine {
  number: number;
  sign: string;
  text: string;
}

/** A Mac window in its own palette: the theme's variables set again on it, so every piece below takes its colors. */
export function Window({ palette, className, children }: { palette: Palette; className?: string; children: ReactNode }) {
  return (
    <div
      style={{ '--card': '12px', '--field': '16px', ...palette } as CSSProperties}
      className={classNames(
        'isolate flex min-h-0 flex-1 overflow-hidden rounded-xl font-sans text-ink antialiased shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] ring-1 ring-black/12',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TrafficLights() {
  return (
    <div className="flex w-14 shrink-0 gap-2">
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

export function Mark({ state, quiet }: { state?: State; quiet?: boolean }) {
  if (state === 'working') return <Spinner />;
  if (state === 'waiting') return <Waiting />;

  return (
    <span className="flex w-[1ch] shrink-0 justify-center font-mono text-mono">
      {!quiet && <span className="size-1.5 rounded-full bg-faint/60" />}
    </span>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={classNames('flex items-center gap-1 px-2 pb-1 text-[11px]/4 font-medium text-faint', className)}>{children}</p>;
}

export function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-on-primary uppercase">{name[0]}</span>
  );
}

export function Counts({ added, removed }: { added?: number; removed?: number }) {
  if (!added && !removed) return null;

  return (
    <span className="shrink-0 tabular-nums">
      {!!added && <span className="text-added">+{added}</span>}
      {!!removed && <span className="text-removed"> -{removed}</span>}
    </span>
  );
}

export function IconButton({
  label,
  children,
  pressed,
  size = 'size-7 [&_svg]:size-4',
  className,
}: {
  label: string;
  children: ReactNode;
  pressed?: boolean;
  size?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={classNames(
        'flex shrink-0 items-center justify-center rounded-lg [&_svg]:shrink-0',
        size,
        pressed ? 'bg-selected text-ink' : 'text-muted hover:bg-shade hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Messages() {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-(--card) bg-raised px-4 py-3 ring-1 ring-edge">
        <p className="text-pretty">Add a search box above the users table. It should filter by name and email as you type, and keep the query in the URL.</p>
      </div>

      <p className="text-pretty text-ink/85">
        I'll write the query to <Code>?q=</Code> from a small client component and filter on the server, so the table stays a server component.
      </p>

      <div className="flex flex-col">
        <WorkLine summary="Explored 5 files, 2 searches" />
        <WorkLine summary="Created search-box.tsx" added={10} />
        <WorkLine summary="Edited page.tsx" added={38} removed={3} open />
      </div>

      <DiffCard name="page.tsx" added={38} removed={3} lines={diff} />

      <p className="text-pretty text-ink/85">
        The table filters on name and email, ignoring case. An empty query shows everyone, and the count above the table follows the filter.
      </p>

      <SummaryCard />

      <div className="flex items-center gap-2 text-muted">
        <Spinner />
        <span>Running the typecheck</span>
        <span className="text-faint tabular-nums">3s</span>
      </div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-shade px-1 py-0.5 font-mono text-mono">{children}</code>;
}

function WorkLine({ summary, added, removed, open }: { summary: string; added?: number; removed?: number; open?: boolean }) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <button type="button" className="group flex h-7 items-center gap-2 self-start text-muted hover:text-ink">
      <span>{summary}</span>
      <Counts added={added} removed={removed} />
      <Chevron className="size-4 shrink-0 text-faint group-hover:text-muted" />
    </button>
  );
}

export function DiffCard({ name, folder, added, removed, lines }: { name: string; folder?: string; added?: number; removed?: number; lines: DiffLine[] }) {
  return (
    <div className="overflow-hidden rounded-(--card) bg-background ring-1 ring-edge">
      <div className="flex h-9 items-center gap-2 border-b border-line px-3">
        <span className="shrink-0 font-medium">{name}</span>
        <span className="min-w-0 flex-1 truncate text-faint">{folder}</span>
        <span className="font-mono text-mono">
          <Counts added={added} removed={removed} />
        </span>
      </div>
      <div className="overflow-x-auto py-1.5 font-mono text-mono">
        {lines.map((line, index) => (
          <div
            key={index}
            className={classNames('flex whitespace-pre', line.sign === '+' && 'bg-added-surface text-added-ink', line.sign === '-' && 'bg-removed-surface text-removed-ink')}
          >
            <span className="w-10 shrink-0 pr-3 text-right text-faint tabular-nums select-none">{line.number}</span>
            <span className={classNames('w-5 shrink-0 select-none', line.sign === '+' && 'text-added', line.sign === '-' && 'text-removed')}>{line.sign}</span>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard() {
  return (
    <div className="rounded-(--card) bg-background ring-1 ring-edge">
      <div className="flex h-10 items-center gap-2 pr-2 pl-4">
        <p className="flex-1 font-medium">
          2 files changed{' '}
          <span className="font-normal">
            <Counts added={48} removed={3} />
          </span>
        </p>
        <button type="button" className="h-7 rounded-full px-3 font-medium hover:bg-shade">
          Review
        </button>
      </div>
      <div className="border-t border-line py-1">
        <ChangeRows />
      </div>
    </div>
  );
}

export function ChangeRows() {
  return (
    <ul className="flex flex-col">
      {changes.map((change) => (
        <li key={change.name}>
          <button type="button" className="flex h-8 w-full items-center gap-2 px-4 text-left hover:bg-shade">
            <span className="shrink-0">{change.name}</span>
            <span className="min-w-0 flex-1 truncate text-faint">{change.folder}</span>
            {change.created && <span className="text-faint">new</span>}
            <Counts added={change.added} removed={change.removed} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The composer: what it carries in pills over the text, the mode and model under it, anything about where it goes below. */
export function Composer({
  placeholder = 'Ask for a follow-up. / for commands, @ for files',
  attached,
  footer,
  rows = 2,
}: {
  placeholder?: string;
  attached?: ReactNode;
  footer?: ReactNode;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-(--field) bg-floating shadow-[0_2px_8px_-4px_rgb(0_0_0/0.12)] ring-1 ring-edge">
        {attached && <div className="flex flex-wrap gap-1.5 px-3 pt-3">{attached}</div>}
        <textarea
          name="message"
          aria-label="Message"
          rows={rows}
          placeholder={placeholder}
          className={classNames('block w-full resize-none bg-transparent px-4 outline-none placeholder:text-faint', attached ? 'pt-2' : 'pt-3')}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <IconButton label="Attach">
            <Plus />
          </IconButton>
          <Choice>
            <span className="size-1.5 rounded-full bg-warning" />
            Auto
          </Choice>
          <Choice>
            Opus 5.5 <span className="text-faint">High</span>
          </Choice>
          <div className="flex-1" />
          <button type="button" aria-label="Send" className="flex size-7 items-center justify-center rounded-full bg-primary text-on-primary">
            <ArrowUp className="size-4 shrink-0" />
          </button>
        </div>
      </div>
      {footer}
    </div>
  );
}

/** A file the composer carries, in the blue tint files after @ have. */
export function FilePill({ name, lines }: { name: string; lines?: string }) {
  return (
    <span className="flex h-6 items-center gap-1.5 rounded-md bg-(--tint-blue) px-2 text-(--tint-blue-ink)">
      {name}
      {lines && <span className="opacity-70">{lines}</span>}
    </span>
  );
}

export function ComposerFooter({ context }: { context?: string }) {
  return (
    <div className="flex items-center gap-1 px-1 text-muted">
      <Choice>
        <GitBranch className="size-4 shrink-0" />
        feat/dashboard
      </Choice>
      <Choice>
        <Laptop className="size-4 shrink-0" />
        This Mac
      </Choice>
      <div className="flex-1" />
      {context && <span className="px-2 text-faint tabular-nums">{context}</span>}
    </div>
  );
}

export function Choice({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-7 min-w-0 items-center gap-1.5 rounded-lg pr-1.5 pl-2 text-muted hover:bg-shade hover:text-ink">
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-faint" />
    </button>
  );
}

/** A thread from its first message to the composer, which floats over the end of it. */
export function ThreadBody({ width = 'max-w-176', gutter = 'px-8', footer = true }: { width?: string; gutter?: string; footer?: boolean }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={classNames('mx-auto pt-6 pb-44', gutter, width)}>
          <Messages />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background from-60% to-transparent pt-10 pb-4">
        <div className={classNames('pointer-events-auto mx-auto', gutter, width)}>
          <Composer footer={footer && <ComposerFooter context="12% of context" />} />
        </div>
      </div>
    </div>
  );
}

/** The dashboard as the preview shows it, drawn light whatever the window is. */
export function Browser({ bare }: { bare?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {!bare && (
        <div className="flex h-11 shrink-0 items-center gap-1 px-2">
          <IconButton label="Back">
            <ArrowLeft />
          </IconButton>
          <IconButton label="Forward">
            <ArrowRight />
          </IconButton>
          <IconButton label="Reload">
            <RotateCw />
          </IconButton>
          <div className="ml-1 flex h-7 min-w-0 flex-1 items-center rounded-full bg-shade px-3 text-muted">
            <span className="truncate">
              localhost:3000<span className="text-ink">/users?q=ay</span>
            </span>
          </div>
        </div>
      )}
      <div className="light mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-lg bg-white text-zinc-950 ring-1 ring-black/8">
        <div className="flex h-11 items-center gap-2 border-b border-black/6 px-4">
          <span className="size-4 rounded-[5px] bg-zinc-900" />
          <span className="font-semibold">Jinion</span>
          <span className="text-zinc-400">Beta</span>
          <div className="flex-1" />
          <span className="text-zinc-500">Users</span>
          <span className="text-zinc-400">Turns</span>
          <span className="text-zinc-400">Feedback</span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-base/6 font-semibold">Users</p>
            <p className="text-zinc-500">3 of 128</p>
          </div>
          <div className="flex h-8 items-center gap-2 rounded-md px-2.5 ring-1 ring-blue-500/60 outline-3 outline-blue-500/15">
            <Search className="size-3.5 shrink-0 text-zinc-400" />
            <span>
              ay<span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-zinc-900" />
            </span>
          </div>
          <table className="w-full text-left">
            <thead className="text-zinc-500">
              <tr className="border-b border-black/6">
                <th className="py-1.5 font-medium">Name</th>
                <th className="py-1.5 font-medium">Email</th>
                <th className="py-1.5 text-right font-medium">Turns</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.email} className="border-b border-black/6 last:border-0">
                  <td className="py-2">{person.name}</td>
                  <td className="py-2 text-zinc-500">{person.email}</td>
                  <td className="py-2 text-right tabular-nums">{person.turns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TerminalLines() {
  return (
    <div className="flex flex-col px-4 py-2.5 font-mono text-mono">
      {terminal.map((line) => (
        <p
          key={line.text}
          className={classNames(
            'truncate whitespace-pre',
            line.tone === 'faint' && 'text-faint',
            line.tone === 'added' && 'text-added',
            line.tone === 'accent' && 'text-accent',
          )}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}
