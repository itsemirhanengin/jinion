import { classNames, CodeView, FadeText, Spinner } from '@jinion/ui';
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Columns2,
  Ellipsis,
  FileCode,
  GitBranch,
  GitCompare,
  Globe,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  SquareTerminal,
  X,
} from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { type GitStatus, gitChanges, type State, type Thread, threads, tree } from './fixtures.js';
import { Browser, ChangeRows, Choice, Counts, IconButton, Initial, Mark, SectionLabel, TerminalLines, TrafficLights } from './pieces.js';

export const SELECTED = 'bg-background shadow-xs ring-1 ring-edge';

/** The window's top: the project as a dropdown, the search in the middle, the pages and the profile at the end. */
export function TitleBar({ after, end, search = 'Search threads, files and commands' }: { after?: ReactNode; end?: ReactNode; search?: string }) {
  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
      <div className="flex min-w-0 items-center gap-2">
        <TrafficLights />
        <button type="button" className="flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 font-medium hover:bg-shade">
          <Initial name="coding-agent" />
          <span className="truncate">coding-agent</span>
          <ChevronsUpDown className="size-4 shrink-0 text-faint" />
        </button>
        {after}
      </div>
      <button type="button" className="flex h-8 w-96 items-center gap-2 rounded-lg bg-background/70 px-3 text-faint ring-1 ring-edge hover:bg-background">
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{search}</span>
        <span className="shrink-0">⌘K</span>
      </button>
      <div className="flex items-center justify-end gap-0.5">
        {end}
        <IconButton label="Skills">
          <BookOpen />
        </IconButton>
        <IconButton label="Memory">
          <Brain />
        </IconButton>
        <span className="ml-1.5 flex size-6 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">E</span>
      </div>
    </header>
  );
}

export function NewButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 font-medium text-on-primary">
      <SquarePen className="size-3.5" />
      New
    </button>
  );
}

/** The threads as an inbox: a header with the filter and New, then a card per thread with its latest news. */
export function ThreadList({
  active,
  titled = true,
  onNew,
  onSelect,
}: {
  active?: number;
  titled?: boolean;
  onNew?: () => void;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 pr-1 pl-3">
        <p className="flex-1 font-semibold">{titled && 'Threads'}</p>
        <Choice>All</Choice>
        <NewButton onClick={onNew} />
      </div>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {threads.map((thread, index) => (
          <li key={thread.title}>
            <ThreadItem thread={thread} active={index === active} onClick={() => onSelect?.(index)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ThreadItem({ thread, active, onClick }: { thread: Thread; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames('grid w-full grid-cols-[0.75rem_1fr_auto] items-center gap-x-2 gap-y-0.5 rounded-lg px-3 py-2.5 text-left', active ? SELECTED : 'hover:bg-shade')}
    >
      <span className="flex justify-center">
        <Mark state={thread.state} quiet />
      </span>
      <span className="min-w-0 truncate font-medium">{thread.title}</span>
      <span className="text-faint tabular-nums">{thread.ago}</span>
      <span />
      <span className={classNames('min-w-0 truncate', thread.state === 'waiting' ? 'text-warning' : 'text-muted')}>{thread.snippet}</span>
      <Counts added={thread.added} removed={thread.removed} />
    </button>
  );
}

export function Card({
  title,
  detail,
  action,
  onAction,
  children,
}: {
  title: ReactNode;
  detail?: ReactNode;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
      <div className="flex h-10 shrink-0 items-center gap-2 pr-2 pl-4">
        <div className="flex shrink-0 items-center gap-2 font-medium">{title}</div>
        <span className="min-w-0 flex-1 truncate text-faint">{detail}</span>
        {action && (
          <button type="button" onClick={onAction} className="h-7 shrink-0 rounded-full px-2.5 font-medium hover:bg-shade">
            {action}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 border-t border-line">{children}</div>
    </section>
  );
}

export function ChangesCard() {
  return (
    <Card title="Changes" detail={<Counts added={48} removed={3} />} action="Review">
      <div className="py-1">
        <ChangeRows />
      </div>
    </Card>
  );
}

export function PreviewCard() {
  return (
    <Card title="Preview" detail={<Running label="localhost:3000" />} action="Open">
      <div className="h-40 overflow-hidden">
        <div className="h-80 pt-1" style={{ zoom: 0.5 }}>
          <Browser bare />
        </div>
      </div>
    </Card>
  );
}

export function TerminalCard() {
  return (
    <Card title="Terminal" detail={<span className="font-mono text-mono">pnpm dev:dashboard</span>} action="Open">
      <TerminalLines />
    </Card>
  );
}

/** The thread at work, from anywhere: its last words and what it is doing now. */
export function ThreadCard({ onOpen }: { onOpen?: () => void }) {
  return (
    <Card
      title={
        <>
          <Mark state="working" />
          Search on the users table
        </>
      }
      action="Open"
      onAction={onOpen}
    >
      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="line-clamp-3 text-pretty text-ink/85">
          The table filters on name and email, ignoring case. An empty query shows everyone, and the count follows the filter.
        </p>
        <div className="flex items-center gap-2 text-muted">
          <Spinner />
          Running the typecheck
          <span className="text-faint tabular-nums">3s</span>
        </div>
      </div>
    </Card>
  );
}

export function SearchPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className={classNames('flex h-8 items-center gap-2 rounded-lg px-2.5', SELECTED)}>
        <Search className="size-4 shrink-0 text-faint" />
        <span>listUsers</span>
      </div>
      <div className="flex flex-col">
        <SectionLabel>3 results in 2 files</SectionLabel>
        {results.map((result) => (
          <div key={result.file} className="flex flex-col">
            <button type="button" className="flex h-7 items-center gap-2 rounded-md px-2 text-left hover:bg-shade">
              <FileCode className="size-3.5 shrink-0 text-faint" />
              <span className="shrink-0">{result.file}</span>
              <span className="min-w-0 flex-1 truncate text-faint">{result.folder}</span>
            </button>
            {result.lines.map((line) => (
              <button key={line.number} type="button" className="flex h-6 items-center gap-2 rounded-md pr-2 pl-7 text-left font-mono text-mono hover:bg-shade">
                <span className="w-5 shrink-0 text-right text-faint">{line.number}</span>
                <span className="min-w-0 truncate whitespace-pre">
                  {line.before}
                  <span className="rounded-sm bg-(--tint-blue) text-(--tint-blue-ink)">listUsers</span>
                  {line.after}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const results = [
  {
    file: 'page.tsx',
    folder: 'apps/dashboard/src/app/users',
    lines: [
      { number: 1, before: 'import { ', after: " } from '@/lib…" },
      { number: 11, before: 'const users = (await ', after: '()).filter(' },
    ],
  },
  { file: 'users.ts', folder: 'apps/dashboard/src/lib/data', lines: [{ number: 4, before: 'export async function ', after: '() {' }] },
];

export function Running({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-1.5 shrink-0 rounded-full bg-added" />
      {label}
    </span>
  );
}

export interface TabSpec {
  title: string;
  kind: 'thread' | 'file' | 'diff' | 'preview' | 'git' | 'terminal';
  state?: State;
  active?: boolean;
  edited?: boolean;
}

/** One group of tabs on a white card; two side by side are a split. */
export function Group({ tabs, children, grow = true, className }: { tabs: TabSpec[]; children: ReactNode; grow?: boolean; className?: string }) {
  return (
    <section className={classNames('flex min-w-0 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge', grow && 'flex-1', className)}>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {tabs.map((tab) => (
            <Tab key={tab.title} tab={tab} />
          ))}
          <IconButton label="New tab">
            <Plus />
          </IconButton>
        </div>
        <IconButton label="Split right">
          <Columns2 />
        </IconButton>
        <IconButton label="More">
          <Ellipsis />
        </IconButton>
      </div>
      {children}
    </section>
  );
}

export function Tab({ tab }: { tab: TabSpec }) {
  return (
    <button
      type="button"
      className={classNames(
        'group flex h-7 w-44 min-w-0 shrink items-center gap-2 rounded-lg pr-1 pl-2.5 text-left [&_svg]:size-3.5 [&_svg]:shrink-0',
        tab.active ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink',
      )}
    >
      <span className="flex shrink-0 text-faint">
        <TabIcon tab={tab} />
      </span>
      <FadeText className="flex-1">{tab.title}</FadeText>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md">
        {tab.edited ? <span className="size-1.5 rounded-full bg-ink/50" /> : <X className={tab.active ? 'text-muted' : 'invisible text-faint group-hover:visible'} />}
      </span>
    </button>
  );
}

export function TabIcon({ tab }: { tab: TabSpec }) {
  if (tab.kind === 'thread') return tab.state ? <Mark state={tab.state} /> : <MessageSquare />;
  if (tab.kind === 'diff') return <GitCompare />;
  if (tab.kind === 'preview') return <Globe />;
  if (tab.kind === 'git') return <GitBranch />;
  if (tab.kind === 'terminal') return <SquareTerminal />;

  return <FileCode />;
}

/** A file open for reading and editing: where it is, the code, and the cursor's place at the foot. */
export function CodePane({ path, code, marked, children }: { path: string; code: string; marked?: number[]; children?: ReactNode }) {
  const parts = path.split('/');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 overflow-hidden px-4 whitespace-nowrap text-faint">
        {parts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && <ChevronRight className="size-3 shrink-0" />}
            <span className={index === parts.length - 1 ? 'text-muted' : undefined}>{part}</span>
          </Fragment>
        ))}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto">
          <CodeView code={code} path={path} marked={marked} />
        </div>
        {children}
      </div>
      <div className="flex h-7 shrink-0 items-center gap-4 border-t border-line px-4 text-faint">
        <span>Ln 13, Col 24</span>
        <span>Spaces: 2</span>
        <span className="flex-1" />
        <span>TypeScript JSX</span>
      </div>
    </div>
  );
}

export function FileTree() {
  return (
    <ul className="flex flex-col">
      {tree.map((item, index) => {
        const Chevron = item.open ? ChevronDown : ChevronRight;

        return (
          <li key={index}>
            <button
              type="button"
              style={{ paddingLeft: 8 + item.depth * 14 }}
              className={classNames('flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left', item.active ? SELECTED : 'hover:bg-shade')}
            >
              <span className="flex w-3.5 shrink-0 justify-center">{item.folder && <Chevron className="size-3.5 text-faint" />}</span>
              <span className={classNames('min-w-0 flex-1 truncate', !item.folder && !item.status && 'text-ink/80')}>{item.name}</span>
              {item.status && <Letter status={item.status} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Letter({ status }: { status: GitStatus }) {
  return <span className={classNames('w-3 shrink-0 text-center text-[11px] font-semibold', status === 'A' ? 'text-added' : 'text-accent')}>{status}</span>;
}

/** The repository as it really is: its branch, a commit box, and each changed file, checked when staged. */
export function GitPanel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-8 items-center gap-2 pl-2">
        <GitBranch className="size-4 shrink-0 text-muted" />
        <span className="font-medium">coding-agent</span>
        <span className="min-w-0 flex-1 truncate text-faint">feat/dashboard</span>
        <IconButton label="Sync">
          <RefreshCw />
        </IconButton>
      </div>
      <div className={classNames('rounded-xl', SELECTED)}>
        <textarea
          name="commit"
          aria-label="Commit message"
          rows={2}
          placeholder="Message (⌘↵ to commit)"
          className="block w-full resize-none bg-transparent px-3 pt-2.5 outline-none placeholder:text-faint"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <button type="button" className="h-7 rounded-full px-3 text-muted hover:bg-shade hover:text-ink">
            Stage all
          </button>
          <div className="flex-1" />
          <button type="button" className="h-7 rounded-full bg-primary px-3.5 font-medium text-on-primary">
            Commit 2
          </button>
        </div>
      </div>
      <div>
        <SectionLabel>Changes {gitChanges.length}</SectionLabel>
        <GitFiles />
      </div>
    </div>
  );
}

function GitFiles() {
  return (
    <ul className="flex flex-col py-1">
      {gitChanges.map((change) => (
        <li key={change.name}>
          <button type="button" className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-shade">
            <span
              className={classNames(
                'flex size-3.5 shrink-0 items-center justify-center rounded-[4px]',
                change.staged ? 'bg-primary text-on-primary' : 'ring-1 ring-edge ring-inset',
              )}
            >
              {change.staged && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <span className="shrink-0">{change.name}</span>
            <span className="min-w-0 flex-1 truncate text-faint">{change.byHand ? 'edited by you' : change.folder}</span>
            <Letter status={change.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
