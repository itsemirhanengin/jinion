import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { classNames, Popover, StatusIcon } from '@jinion/ui';
import { type Feature, layoutCommands, useWorkbench } from '@jinion/workbench';
import { atom, useAtom, useAtomValue } from 'jotai';
import { FileText, Search, SquareChevronRight } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { filesByName } from '../lib/find.js';
import { appStore } from '../state/app.js';
import { quickOpenAtom } from '../state/quick-open.js';
import { statusOf, useCore } from '../state/session.js';

const THREADS = 6;
const FILES = 8;
const COMMANDS = 6;

/** ⌘K opens the title bar's search. */
export function quickOpen(): Feature {
  return { id: 'quick-open', commands: [{ id: 'quick-open', title: 'Search', keys: 'mod+k', run: () => appStore.set(quickOpenAtom, true) }] };
}

interface Result {
  key: string;
  group: 'Threads' | 'Files' | 'Commands';
  icon: ReactNode;
  label: string;
  detail?: string;
  run: () => void;
}

/** The title bar's search: the project's threads, files and commands by name, the one picked opening with Enter. */
export function QuickOpen() {
  const core = useCore();
  const workbench = useWorkbench();
  const [open, setOpen] = useAtom(quickOpenAtom, { store: appStore });
  const shown = useAtomValue(core.client.shownAtom);
  const files = useAtomValue(core.filesAtom);
  const saved = useAtomValue(core.savedAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);

  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const ids = sessions.map((session) => session.id).join();
  const snapshots = useMemo(() => atom((get) => sessions.map((session) => get(core.session(session.id)) as SessionSnapshot | undefined)), [core, ids]);
  const live = useAtomValue(snapshots);

  useEffect(() => {
    if (open && shown && files.length === 0) void core.refreshFiles(shown);
  }, [open]);

  const wanted = query.trim().toLowerCase();
  const close = () => setOpen(false);

  const listed: { id: string; title: string; open: boolean; snapshot?: SessionSnapshot }[] = [
    ...sessions.map((session, index) => ({ id: session.id, title: live[index]?.state.title ?? 'New thread', open: true, snapshot: live[index] })),
    ...saved.filter((thread) => !sessions.some((session) => session.id === thread.id)).map((thread) => ({ id: thread.id, title: thread.title, open: false })),
  ];

  const threads = listed
    .filter((thread) => thread.title.toLowerCase().includes(wanted))
    .slice(0, THREADS)
    .map(
      (thread): Result => ({
        key: `thread:${thread.id}`,
        group: 'Threads',
        icon: <StatusIcon status={(thread.snapshot && statusOf(thread.snapshot)) ?? 'idle'} />,
        label: thread.title,
        run: () => (thread.open ? workbench.open({ kind: 'thread', id: thread.id }) : core.act(core.resume(thread.id))),
      }),
    );

  const found: Result[] =
    wanted && shown
      ? filesByName(files, wanted)
          .slice(0, FILES)
          .map((path): Result => {
            const name = path.slice(path.lastIndexOf('/') + 1);

            return {
              key: `file:${path}`,
              group: 'Files',
              icon: <FileText />,
              label: name,
              detail: path.slice(0, -name.length - 1),
              run: () => workbench.open({ kind: 'file', id: `${shown}|${path}` }, { preview: true }),
            };
          })
      : [];

  // Two commands can do one thing under two keys, as New thread does; the list names it once.
  const matching = [...workbench.commands, ...layoutCommands].filter(
    (command) => command.id !== 'quick-open' && command.title.toLowerCase().includes(wanted) && (command.when?.(workbench) ?? true),
  );

  const commands: Result[] = wanted
    ? [...new Map(matching.map((command) => [command.title, command])).values()]
        .slice(0, COMMANDS)
        .map((command): Result => ({
          key: `command:${command.id}`,
          group: 'Commands',
          icon: <SquareChevronRight />,
          label: command.title,
          detail: command.keys && keysOf(command.keys),
          run: () => command.run(workbench),
        }))
    : [];

  const results = [...threads, ...found, ...commands];

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) return;

    setQuery('');
    setHighlighted(0);
  };

  const pick = (result: Result) => {
    close();
    result.run();
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), Math.max(results.length - 1, 0)));
    }

    if (event.key === 'Enter' && results[highlighted]) pick(results[highlighted]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      align="center"
      width="w-[36rem]"
      returnFocus={false}
      trigger={
        <button
          type="button"
          className="flex h-7 w-96 max-w-full cursor-default items-center gap-2 rounded-lg bg-background/70 px-3 text-faint ring-1 ring-edge [-webkit-app-region:no-drag] hover:bg-background"
        >
          <Search className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Search threads, files and commands</span>
          <span className="shrink-0">⌘K</span>
        </button>
      }
    >
      <label className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          name="quick-open"
          aria-label="Search threads, files and commands"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={keyDown}
          placeholder="Threads, files and commands"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex min-h-0 flex-col overflow-y-auto p-1">
        {results.length === 0 && <p className="px-2 py-1.5 text-pretty text-muted">{wanted ? `Nothing is named like “${query}”.` : 'No threads yet.'}</p>}
        {results.map((result, index) => (
          <div key={result.key} className="flex flex-col">
            {result.group !== results[index - 1]?.group && <p className="menu-label">{result.group}</p>}
            <button
              type="button"
              onClick={() => pick(result)}
              onPointerMove={() => setHighlighted(index)}
              className={classNames(
                'menu-row w-full text-left [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-faint',
                index === highlighted && 'bg-shade',
              )}
            >
              <span className="flex w-4 shrink-0 justify-center">{result.icon}</span>
              <span className="max-w-[60%] shrink-0 truncate">{result.label}</span>
              <span className="min-w-0 flex-1 truncate text-faint">{result.detail}</span>
            </button>
          </div>
        ))}
      </div>
    </Popover>
  );
}

/** `mod+shift+t` as a Mac writes it: ⇧⌘T. */
function keysOf(keys: string) {
  const parts = keys.split('+');
  const key = parts.pop()!;
  const marks = { alt: '⌥', shift: '⇧', mod: '⌘' } as const;

  return `${(['alt', 'shift', 'mod'] as const).filter((mark) => parts.includes(mark)).map((mark) => marks[mark]).join('')}${key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1)}`;
}
