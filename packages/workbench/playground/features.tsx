import { classNames } from '@jinion/ui';
import { Count, Dot, type Feature, IconButton, useWorkbench } from '@jinion/workbench';
import { BookOpen, Folder, GitCompare, Globe, MessagesSquare, Plus, Search, Settings as SettingsIcon, SquareTerminal } from 'lucide-react';
import { type Change, DiffView, Settings, Skills, StateMark, type Thread, ThreadView } from './pieces.js';

const threads = new Map<string, Thread>([
  ['rate-limits', { title: 'Rate limiting for the API', state: 'working', ago: '25s', started: true }],
  ['express', { title: 'Upgrade to Express 5', state: 'waiting', ago: '4m', started: true }],
  ['queue', { title: 'Explain the job queue', state: 'idle', ago: '1h', started: true }],
  ['tokens', { title: 'Move the tokens to CSS variables', state: 'idle', ago: '2d', started: true }],
]);

const changes: Change[] = [
  { path: 'apps/api/src/limits.ts', added: 41, removed: 0, created: true },
  { path: 'apps/api/src/server.ts', added: 6, removed: 2 },
  { path: 'apps/api/package.json', added: 1, removed: 1 },
];

let created = 0;

export function newThread() {
  const id = `new-${++created}`;

  threads.set(id, { title: 'New thread', state: 'idle', ago: 'now', started: false });

  return { kind: 'thread', id };
}

export const features: Feature[] = [
  {
    id: 'threads',
    activity: {
      title: 'Threads',
      icon: <MessagesSquare />,
      Badge: () => ([...threads.values()].some((thread) => thread.state === 'waiting') ? <Dot tone="warning" /> : null),
      Sidebar: ThreadList,
      Actions: () => {
        const workbench = useWorkbench();

        return (
          <IconButton label="New thread" onClick={() => workbench.open(newThread())}>
            <Plus />
          </IconButton>
        );
      },
    },
    tabs: [
      {
        kind: 'thread',
        Title: ({ id }) => threads.get(id)?.title,
        Mark: ({ id }) => <StateMark state={threads.get(id)?.state ?? 'idle'} />,
        Content: ({ id }) => <ThreadView thread={threads.get(id)!} changes={changes} />,
      },
    ],
    commands: [{ id: 'thread.new', title: 'New thread', keys: 'mod+t', run: (workbench) => workbench.open(newThread()) }],
  },
  {
    id: 'search',
    activity: { title: 'Search', icon: <Search />, Sidebar: () => <p className="px-2 text-muted">Search the project.</p> },
  },
  {
    id: 'changes',
    activity: { title: 'Changes', icon: <GitCompare />, Badge: () => <Dot />, Sidebar: ChangeList },
    tabs: [{ kind: 'diff', Title: ({ id }) => id.split('/').at(-1), Content: ({ id }) => <DiffView path={id} /> }],
  },
  {
    id: 'skills',
    activity: { title: 'Skills', icon: <BookOpen />, page: { kind: 'page', id: 'skills' } },
    tabs: [{ kind: 'page', Title: ({ id }) => (id === 'skills' ? 'Skills' : 'Settings'), Content: ({ id }) => (id === 'skills' ? <Skills /> : <Settings />) }],
  },
  {
    id: 'settings',
    activity: { title: 'Settings', icon: <SettingsIcon />, foot: true, page: { kind: 'page', id: 'settings' } },
  },
  {
    id: 'tools',
    views: [{ id: 'tools', title: 'Tools', place: 'right', Content: Outline }],
  },
  {
    id: 'terminal',
    views: [
      { id: 'terminal', title: 'Terminal', place: 'bottom', Content: () => <Lines lines={['$ pnpm dev', '[vite] ready in 312 ms']} /> },
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

  const groups = [
    { title: 'Working', threads: [...threads].filter(([, thread]) => thread.state !== 'idle') },
    { title: 'Earlier', threads: [...threads].filter(([, thread]) => thread.state === 'idle') },
  ];

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-2 text-muted">{group.title}</p>
          <ul className="flex flex-col">
            {group.threads.map(([id, thread]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => workbench.open({ kind: 'thread', id })}
                  className="flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left hover:bg-shade"
                >
                  <span className="flex w-3 shrink-0 justify-center">
                    <StateMark state={thread.state} />
                  </span>
                  <span className={classNames('min-w-0 flex-1 truncate', thread.state === 'idle' && 'text-ink/70')}>{thread.title}</span>
                  <span className="shrink-0 text-faint tabular-nums">{thread.ago}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ChangeList() {
  const workbench = useWorkbench();

  return (
    <ul className="flex flex-col">
      {changes.map((change) => {
        const name = change.path.split('/').at(-1)!;

        return (
          <li key={change.path}>
            <button
              type="button"
              onClick={() => workbench.open({ kind: 'diff', id: change.path }, { preview: true })}
              onDoubleClick={() => workbench.open({ kind: 'diff', id: change.path })}
              className="flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left hover:bg-shade"
            >
              <span className="shrink-0">{name}</span>
              <span className="min-w-0 flex-1 truncate text-faint">{change.path.slice(0, -name.length - 1)}</span>
              <span className="text-added tabular-nums">+{change.added}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Outline() {
  const items = [
    { icon: <GitCompare />, label: 'Changes', detail: '3' },
    { icon: <Globe />, label: 'Browser' },
    { icon: <SquareTerminal />, label: 'Terminal', detail: '1' },
    { icon: <Folder />, label: 'Files' },
  ];

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-muted">acme-api</p>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left text-ink/80 hover:bg-shade hover:text-ink [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-faint"
        >
          {item.icon}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.detail && <span className="text-faint tabular-nums">{item.detail}</span>}
        </button>
      ))}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <div className="px-4 pb-3 font-mono text-mono">
      {lines.map((line) => (
        <p key={line} className="whitespace-pre">
          {line}
        </p>
      ))}
    </div>
  );
}

export function NewThread() {
  return <ThreadView thread={{ title: 'New thread', state: 'idle', ago: 'now', started: false }} changes={[]} />;
}
