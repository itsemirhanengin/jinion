import { classNames, Spinner, Waiting } from '@jinion/ui';
import {
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  GitBranch,
  GitCompare,
  Globe,
  Laptop,
  MessagesSquare,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  SquareTerminal,
} from 'lucide-react';
import type { ReactNode } from 'react';

const projects = [
  { name: 'acme-api', state: 'working' as const },
  { name: 'bugece-web', state: 'waiting' as const },
  { name: 'jinion', state: undefined },
];

const threads = [
  { title: 'Rate limiting for the API', ago: '25s', state: 'working' as const, active: true },
  { title: 'Upgrade to Express 5', ago: '4m', state: 'waiting' as const },
  { title: 'Explain the job queue', ago: '1h' },
  { title: 'Move the tokens to CSS variables', ago: '2d' },
  { title: 'Fix the flaky login test', ago: '3d' },
];

const changes = [
  { name: 'limits.ts', folder: 'apps/api/src', added: 41, removed: 0, created: true },
  { name: 'server.ts', folder: 'apps/api/src', added: 6, removed: 2 },
  { name: 'package.json', folder: 'apps/api', added: 1, removed: 1 },
];

const diff = [
  { number: 3, sign: ' ', text: "import express from 'express';" },
  { number: 4, sign: '-', text: "import { json } from 'body-parser';" },
  { number: 4, sign: '+', text: "import { limits } from './limits.js';" },
  { number: 5, sign: ' ', text: '' },
  { number: 6, sign: ' ', text: 'const app = express();' },
  { number: 7, sign: '+', text: 'app.use(limits({ perMinute: 60, key: apiKey }));' },
  { number: 8, sign: ' ', text: 'app.use(express.json());' },
];

/** The window in the Leaf direction: gray chrome around the content as a white sheet of its own. */
export function Leaf() {
  return (
    <div className="isolate flex h-[calc(100dvh-2rem)] min-h-160 flex-col overflow-hidden rounded-xl bg-zinc-100 font-sans text-[0.8125rem]/5 text-zinc-950 antialiased ring-1 ring-black/10">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityRail />
        <ThreadList />
        <div className="mr-2 mb-2 flex min-w-0 flex-1 overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-black/5">
          <main className="flex min-w-0 flex-1 flex-col">
            <ContentTabs />
            <Conversation />
          </main>
        </div>
        <Outline />
      </div>
    </div>
  );
}

function TitleBar() {
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 px-3">
      <div className="flex w-17 shrink-0 gap-2">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {projects.map((project, index) => (
          <button
            key={project.name}
            type="button"
            className={classNames(
              'flex h-7 w-44 min-w-0 shrink-0 items-center gap-2 rounded-lg px-2.5',
              index === 0 ? 'bg-white shadow-xs ring-1 ring-black/5' : 'text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900',
            )}
          >
            <Mark state={project.state} />
            <span className="min-w-0 truncate">{project.name}</span>
          </button>
        ))}
        <IconButton label="Open a project">
          <Plus />
        </IconButton>
      </nav>
      <div className="flex-1" />
      <IconButton label="Sidebar">
        <PanelLeft />
      </IconButton>
      <IconButton label="Bottom panel">
        <PanelBottom />
      </IconButton>
      <IconButton label="Right panel">
        <PanelRight />
      </IconButton>
    </header>
  );
}

function ActivityRail() {
  const items = [
    { label: 'Threads', icon: <MessagesSquare />, active: true },
    { label: 'Search', icon: <Search /> },
    { label: 'Changes', icon: <GitCompare />, dot: true },
    { label: 'Skills', icon: <BookOpen /> },
  ];

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 pt-1 pb-3">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={item.label}
          className={classNames(
            'relative flex size-8 items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
            item.active ? 'bg-zinc-950/6 text-zinc-950' : 'text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900',
          )}
        >
          {item.icon}
          {item.dot && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#181E33]" />}
        </button>
      ))}
      <div className="flex-1" />
      <IconButton label="Settings">
        <Settings />
      </IconButton>
    </nav>
  );
}

function ThreadList() {
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 pt-1 pr-3 pb-3">
      <div className="flex items-center gap-1 pl-2">
        <h2 className="flex-1 font-medium">Threads</h2>
        <IconButton label="New thread">
          <Plus />
        </IconButton>
      </div>
      <ThreadGroup title="Working" threads={threads.slice(0, 2)} />
      <ThreadGroup title="Earlier" threads={threads.slice(2)} />
    </aside>
  );
}

function ThreadGroup({ title, threads: shown }: { title: string; threads: typeof threads }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-zinc-500">{title}</p>
      <ul className="flex flex-col">
        {shown.map((thread) => (
          <li key={thread.title}>
            <button
              type="button"
              className={classNames('flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left', thread.active ? 'bg-zinc-950/6' : 'hover:bg-zinc-950/4')}
            >
              <span className="flex w-3 shrink-0 justify-center">
                <Mark state={thread.state} />
              </span>
              <span className={classNames('min-w-0 flex-1 truncate', !thread.state && 'text-zinc-600')}>{thread.title}</span>
              <span className="shrink-0 text-zinc-400 tabular-nums">{thread.ago}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentTabs() {
  const tabs = [
    { title: 'Rate limiting for the API', state: 'working' as const, active: true },
    { title: 'server.ts', file: true },
    { title: 'Upgrade to Express 5', state: 'waiting' as const },
  ];

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-3">
      {tabs.map((tab) => (
        <button
          key={tab.title}
          type="button"
          className={classNames(
            'flex h-7 max-w-56 min-w-0 items-center gap-2 rounded-lg px-2.5',
            tab.active ? 'bg-zinc-950/5 text-zinc-950' : 'text-zinc-500 hover:bg-zinc-950/4 hover:text-zinc-900',
          )}
        >
          {tab.file ? <FileText className="size-4 shrink-0 text-zinc-400" /> : <Mark state={tab.state} />}
          <span className={classNames('min-w-0 truncate', tab.file && 'italic')}>{tab.title}</span>
        </button>
      ))}
      <IconButton label="New thread">
        <Plus />
      </IconButton>
    </div>
  );
}

function Conversation() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-176 flex-col gap-5 px-8 pt-2 pb-40">
          <div className="sticky top-2 z-10 rounded-xl bg-white px-4 py-3 shadow-xs ring-1 ring-black/8">
            <p className="text-pretty">Add rate limiting to the API: 60 requests a minute per key, and a 429 with Retry-After when it runs out.</p>
          </div>

          <p className="text-pretty text-zinc-800">
            I'll put the limiter in front of the routes, keyed by the API key, with the window in Redis so it holds across instances.
          </p>

          <div className="flex flex-col gap-1">
            <WorkLine summary="Explored 4 files, 2 searches" />
            <WorkLine summary="Ran the API's tests" detail="4.2s" />
            <WorkLine summary="Edited server.ts" counts={[6, 2]} open />
          </div>

          <DiffCard />

          <p className="text-pretty text-zinc-800">
            The limiter answers with a 429 and <code className="rounded-md bg-zinc-950/5 px-1 py-0.5 font-mono">Retry-After</code> in seconds. The tests
            pass, two new ones included for the edge of the window.
          </p>

          <ChangesCard />

          <div className="flex items-center gap-2 text-zinc-500">
            <Spinner className="text-[#181E33]" />
            <span>Running the typecheck</span>
            <span className="text-zinc-400 tabular-nums">3s</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-white from-60% to-transparent pt-10 pb-4">
        <div className="pointer-events-auto mx-auto max-w-176 px-8">
          <Composer />
        </div>
      </div>
    </div>
  );
}

function WorkLine({ summary, detail, counts, open }: { summary: string; detail?: string; counts?: [number, number]; open?: boolean }) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <button type="button" className="group flex h-7 items-center gap-2 self-start text-zinc-500 hover:text-zinc-900">
      <span>{summary}</span>
      {counts && (
        <span className="tabular-nums">
          <span className="text-emerald-600">+{counts[0]}</span> <span className="text-red-600">-{counts[1]}</span>
        </span>
      )}
      {detail && <span className="text-zinc-400 tabular-nums">{detail}</span>}
      <Chevron className="size-4 shrink-0 text-zinc-400 group-hover:text-zinc-600" />
    </button>
  );
}

function DiffCard() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-black/8">
      <div className="flex h-9 items-center gap-2 border-b border-black/6 bg-zinc-50 px-3">
        <span className="min-w-0 flex-1 truncate font-medium">server.ts</span>
        <span className="font-mono tabular-nums">
          <span className="text-emerald-600">+6</span> <span className="text-red-600">-2</span>
        </span>
      </div>
      <div className="overflow-x-auto py-1.5 font-mono text-[0.75rem]/5">
        {diff.map((line, index) => (
          <div
            key={index}
            className={classNames('flex whitespace-pre', line.sign === '+' && 'bg-emerald-50 text-emerald-950', line.sign === '-' && 'bg-red-50 text-red-950')}
          >
            <span className="w-10 shrink-0 pr-3 text-right text-zinc-400 tabular-nums select-none">{line.number}</span>
            <span className={classNames('w-5 shrink-0 select-none', line.sign === '+' && 'text-emerald-600', line.sign === '-' && 'text-red-600')}>{line.sign}</span>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangesCard() {
  return (
    <div className="rounded-xl ring-1 ring-black/8">
      <div className="flex h-10 items-center gap-2 pr-2 pl-4">
        <p className="flex-1 font-medium">
          3 files changed{' '}
          <span className="font-normal tabular-nums">
            <span className="text-emerald-600">+48</span> <span className="text-red-600">-3</span>
          </span>
        </p>
        <button type="button" className="h-7 rounded-lg px-2.5 font-medium hover:bg-zinc-950/5">
          Review
        </button>
      </div>
      <ul className="border-t border-black/6 py-1">
        {changes.map((change) => (
          <li key={change.name}>
            <button type="button" className="flex h-8 w-full items-center gap-2 px-4 text-left hover:bg-zinc-950/3">
              <span className="shrink-0">{change.name}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-400">{change.folder}</span>
              {change.created && <span className="text-zinc-400">new</span>}
              <span className="w-16 shrink-0 text-right tabular-nums">
                <span className="text-emerald-600">+{change.added}</span>
                {change.removed > 0 && <span className="text-red-600"> -{change.removed}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Composer() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
        <textarea
          name="message"
          aria-label="Message"
          rows={2}
          placeholder="Ask for a follow-up. / for commands, @ for files"
          className="block w-full resize-none bg-transparent px-4 pt-3 outline-none placeholder:text-zinc-400"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <IconButton label="Attach">
            <Plus />
          </IconButton>
          <Choice>
            <span className="size-1.5 rounded-full bg-amber-500" />
            Auto
          </Choice>
          <Choice>
            Opus 5.5 <span className="text-zinc-400">High</span>
          </Choice>
          <div className="flex-1" />
          <button type="button" aria-label="Send" className="flex size-7 items-center justify-center rounded-full bg-[#181E33] text-white">
            <ArrowUp className="size-4 shrink-0" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 px-1 text-zinc-500">
        <Choice>
          <GitBranch className="size-4 shrink-0" />
          main
        </Choice>
        <Choice>
          <Laptop className="size-4 shrink-0" />
          This Mac
        </Choice>
        <div className="flex-1" />
        <span className="px-2 text-zinc-400 tabular-nums">40% of context</span>
      </div>
    </div>
  );
}

function Outline() {
  const sections = [
    {
      title: 'Open',
      items: [
        { icon: <SquareTerminal />, label: 'zsh', detail: 'pnpm dev' },
        { icon: <Globe />, label: 'localhost:5173' },
      ],
    },
    {
      title: 'acme-api',
      items: [
        { icon: <GitCompare />, label: 'Changes', detail: '3' },
        { icon: <Globe />, label: 'Browser' },
        { icon: <SquareTerminal />, label: 'Terminal', detail: '1' },
        { icon: <Folder />, label: 'Files' },
      ],
    },
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-5 px-3 pt-1">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-2 text-zinc-500">{section.title}</p>
          <ul className="flex flex-col">
            {section.items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-zinc-700 hover:bg-zinc-950/4 hover:text-zinc-950 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zinc-400"
                >
                  {item.icon}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.detail && <span className="text-zinc-400 tabular-nums">{item.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function Mark({ state }: { state?: 'working' | 'waiting' }) {
  if (state === 'working') return <Spinner className="text-[#181E33]" />;
  if (state === 'waiting') return <Waiting className="text-amber-600" />;

  return <span className="size-1.5 shrink-0 rounded-full bg-zinc-300" />;
}

function Choice({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-7 items-center gap-1.5 rounded-lg pr-1.5 pl-2 text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950">
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-zinc-400" />
    </button>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-900 [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {children}
    </button>
  );
}
