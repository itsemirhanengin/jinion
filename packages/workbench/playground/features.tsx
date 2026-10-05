import { classNames, Frame } from '@jinion/ui';
import { Count, type Feature, StatusButton, useWorkbench } from '@jinion/workbench';
import { BookOpen, GitBranch, MessagesSquare, Search, Settings } from 'lucide-react';

type ThreadState = 'working' | 'waiting' | 'done';

const threads = new Map<string, { title: string; state: ThreadState }>([
  ['rate-limits', { title: 'Rate limiting for the API', state: 'working' }],
  ['express', { title: 'Upgrade to Express 5', state: 'waiting' }],
  ['queue', { title: 'Explain the job queue', state: 'done' }],
]);

const changes = [
  { path: 'apps/api/src/limits.ts', added: 41, removed: 0 },
  { path: 'apps/api/src/server.ts', added: 6, removed: 2 },
  { path: 'apps/api/package.json', added: 1, removed: 1 },
];

const pages: Record<string, string> = { skills: 'Skills', settings: 'Settings' };

let created = 0;

export function newThread() {
  const id = `new-${++created}`;

  threads.set(id, { title: 'New thread', state: 'done' });

  return { kind: 'thread', id };
}

export const features: Feature[] = [
  {
    id: 'threads',
    activity: {
      title: 'Threads',
      icon: <MessagesSquare />,
      Badge: () => <Count value={[...threads.values()].filter((thread) => thread.state === 'waiting').length} tone="warning" />,
      Sidebar: ThreadList,
    },
    tabs: [
      {
        kind: 'thread',
        Title: ({ id }) => threads.get(id)?.title ?? id,
        Mark: ({ id }) => <StateDot state={threads.get(id)?.state ?? 'done'} />,
        Content: ({ id }) => <Thread title={threads.get(id)?.title ?? id} />,
      },
    ],
    commands: [{ id: 'thread.new', title: 'New thread', keys: 'mod+t', run: (workbench) => workbench.open(newThread()) }],
  },
  {
    id: 'search',
    activity: { title: 'Search', icon: <Search />, Sidebar: SearchBox },
  },
  {
    id: 'git',
    activity: { title: 'Git', icon: <GitBranch />, Badge: () => <Count value={changes.length} />, Sidebar: ChangeList },
    tabs: [{ kind: 'diff', Title: ({ id }) => id.split('/').at(-1), Content: ({ id }) => <Diff path={id} /> }],
    status: [
      { id: 'branch', side: 'left', Item: () => <StatusButton><GitBranch />main</StatusButton> },
      { id: 'changes', side: 'left', Item: () => <StatusButton>3 changed</StatusButton> },
    ],
  },
  {
    id: 'skills',
    activity: { title: 'Skills', icon: <BookOpen />, page: { kind: 'page', id: 'skills' } },
    tabs: [{ kind: 'page', Title: ({ id }) => pages[id] ?? id, Content: ({ id }) => <Page title={pages[id] ?? id} /> }],
  },
  {
    id: 'settings',
    activity: { title: 'Settings', icon: <Settings />, foot: true, page: { kind: 'page', id: 'settings' } },
  },
  {
    id: 'agent',
    views: [{ id: 'agent', title: 'Agent', place: 'right', Content: () => <Thread title="Upgrade to Express 5" narrow /> }],
    status: [
      { id: 'model', side: 'right', Item: () => <StatusButton className="text-accent">Opus 5.5</StatusButton> },
      { id: 'context', side: 'right', Item: () => <StatusButton>ctx 40%</StatusButton> },
      { id: 'limits', side: 'right', Item: () => <StatusButton>5h 67% left</StatusButton> },
    ],
  },
  {
    id: 'terminal',
    views: [
      { id: 'terminal', title: 'Terminal', place: 'bottom', Content: Terminal },
      { id: 'output', title: 'Output', place: 'bottom', Content: () => <Lines lines={['[vite] ready in 312 ms', '[vite] page reload src/app.tsx']} /> },
      {
        id: 'problems',
        title: 'Problems',
        place: 'bottom',
        Badge: () => <Count value={1} tone="warning" />,
        Content: () => <Lines lines={["src/app.tsx:48:7 error TS2322: Type 'string' is not assignable to type 'View'."]} />,
      },
    ],
  },
];

function ThreadList() {
  const workbench = useWorkbench();

  return (
    <div className="flex flex-col p-1.5">
      <button type="button" onClick={() => workbench.open(newThread())} className="hover-shade mb-1 flex h-7 items-center rounded-inner px-2 text-left">
        New thread
      </button>
      {[...threads].map(([id, thread]) => (
        <button
          key={id}
          type="button"
          onClick={() => workbench.open({ kind: 'thread', id })}
          className="hover-shade flex h-7 items-center gap-2 rounded-inner px-2 text-left"
        >
          <StateDot state={thread.state} />
          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
          <span className="text-small text-muted">4m</span>
        </button>
      ))}
    </div>
  );
}

function ChangeList() {
  const workbench = useWorkbench();

  return (
    <div className="flex flex-col p-1.5 font-mono text-mono">
      {changes.map((change) => (
        <button
          key={change.path}
          type="button"
          onClick={() => workbench.open({ kind: 'diff', id: change.path }, { preview: true })}
          onDoubleClick={() => workbench.open({ kind: 'diff', id: change.path })}
          className="hover-shade flex h-7 items-center gap-2 rounded-inner px-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-code">{change.path}</span>
          <span className="text-added">+{change.added}</span>
          {change.removed > 0 && <span className="text-removed">-{change.removed}</span>}
        </button>
      ))}
    </div>
  );
}

function SearchBox() {
  return (
    <div className="p-2">
      <input placeholder="Search the project" className="h-7 w-full rounded-surface border border-line bg-background px-2.5 outline-none focus:border-accent" />
    </div>
  );
}

function Thread({ title, narrow }: { title: string; narrow?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className={classNames('mx-auto flex flex-col gap-4 py-6', narrow ? 'px-4' : 'max-w-190 px-8')}>
          <div className="rounded-surface bg-surface-user px-4 py-2">{title}</div>
          <p>I read the routes and the middleware. The limits go in front of the API, keyed by the caller.</p>
          <Frame tone="success">
            <p>
              <span className="text-muted">$</span> <span className="text-warning">pnpm</span> test <span className="text-code">--filter</span> api
            </p>
            <p className="text-muted">… +12 lines</p>
          </Frame>
          <Frame title={<strong>3 files changed</strong>}>
            {changes.map((change) => (
              <p key={change.path}>
                <span className="text-code">{change.path}</span> <span className="text-added">+{change.added}</span>
              </p>
            ))}
          </Frame>
        </div>
      </div>
      <div className={classNames('mx-auto w-full pb-4', narrow ? 'px-3' : 'max-w-190 px-8')}>
        <div className="rounded-surface border border-line bg-floating px-3 py-2.5 text-muted">Ask for a change, / for commands, @ for files</div>
      </div>
    </div>
  );
}

function Diff({ path }: { path: string }) {
  const lines = [
    { sign: ' ', text: "import express from 'express';" },
    { sign: '-', text: "import { json } from 'body-parser';" },
    { sign: '+', text: "import { limits } from './limits.js';" },
    { sign: ' ', text: '' },
    { sign: ' ', text: 'const app = express();' },
    { sign: '+', text: 'app.use(limits({ perMinute: 60 }));' },
  ];

  return (
    <div className="h-full overflow-auto py-2 font-mono text-mono">
      <p className="px-4 pb-2 text-muted">{path}</p>
      {lines.map((line, index) => (
        <p
          key={index}
          className={classNames('px-4 whitespace-pre', line.sign === '+' && 'bg-added-surface', line.sign === '-' && 'bg-removed-surface')}
        >
          <span className={classNames('inline-block w-[2ch]', line.sign === '+' ? 'text-added' : 'text-removed')}>{line.sign}</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}

function Page({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-190 flex-col gap-4 px-8 py-8">
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="text-muted">A page of its own, opened from the activity bar as a tab.</p>
    </div>
  );
}

function Terminal() {
  return <Lines lines={['~/projects/acme-api main', '$ pnpm dev', '[vite] ready in 312 ms', '  > Local: http://localhost:5173/']} />;
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="px-3 py-1 font-mono text-mono">
      {lines.map((line, index) => (
        <p key={index} className="whitespace-pre">
          {line}
        </p>
      ))}
    </div>
  );
}

function StateDot({ state }: { state: ThreadState }) {
  return (
    <span
      className={classNames(
        'size-1.5 shrink-0 rounded-full',
        state === 'working' && 'bg-accent',
        state === 'waiting' && 'bg-warning',
        state === 'done' && 'bg-frame',
      )}
    />
  );
}
