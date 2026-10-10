import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { classNames, Popover, StatusIcon } from '@jinion/ui';
import { atom, useAtomValue } from 'jotai';
import { ChevronsUpDown, FolderOpen, LayoutGrid, Search, X } from 'lucide-react';
import { type KeyboardEvent, useMemo, useState } from 'react';
import type { Core } from '../core/core.js';
import { ProjectInitial } from '../panels/project-initial.js';
import {
  appStore,
  closeProject,
  coresAtom,
  openProject,
  pickFolder,
  projectAtom,
  projectsAtom,
  recentAtom,
  refreshRecent,
  showProjects,
} from '../state/app.js';
import { statusOf } from '../state/session.js';

interface Entry {
  path: string;
  name: string;
  open: boolean;
}

/**
 * The project shown, as the title bar's first item; it opens a menu of the projects open now, each with whether a thread
 * there works or waits, then the ones opened before, with a search, the folder picker and the projects screen under them.
 */
export function ProjectSwitcher() {
  const shown = useAtomValue(projectAtom, { store: appStore });
  const open = useAtomValue(projectsAtom, { store: appStore });
  const recent = useAtomValue(recentAtom, { store: appStore });
  const cores = useAtomValue(coresAtom, { store: appStore });

  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const nameOf = (path: string) => cores[path]?.project.name ?? recent?.find((project) => project.path === path)?.name ?? path.slice(path.lastIndexOf('/') + 1);
  const wanted = query.trim().toLowerCase();

  const entries: Entry[] = [
    ...open.map((path) => ({ path, name: nameOf(path), open: true })),
    ...(recent ?? []).filter((project) => !open.includes(project.path)).map((project) => ({ path: project.path, name: project.name, open: false })),
  ].filter((entry) => `${entry.name} ${entry.path}`.toLowerCase().includes(wanted));

  const toggle = (next: boolean) => {
    setMenu(next);
    if (!next) return;

    setQuery('');
    setHighlighted(0);
    void refreshRecent();
  };

  const go = (action: () => void) => {
    setMenu(false);
    action();
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), Math.max(entries.length - 1, 0)));
    }

    if (event.key === 'Enter' && entries[highlighted]) go(() => void openProject(entries[highlighted]!.path));
  };

  return (
    <Popover
      open={menu}
      onOpenChange={toggle}
      returnFocus={false}
      trigger={
        <button
          type="button"
          className={classNames('flex h-7 min-w-0 cursor-default items-center gap-2 rounded-lg px-2 font-medium hover:bg-shade', menu && 'bg-shade')}
        >
          {shown ? <ProjectInitial name={nameOf(shown)} selected /> : <LayoutGrid className="size-4 shrink-0 text-muted" />}
          <span className="truncate">{shown ? nameOf(shown) : 'Projects'}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-faint" />
        </button>
      }
    >
      <label className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          name="search"
          aria-label="Search the projects"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={keyDown}
          placeholder="Search projects"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex min-h-0 flex-col overflow-y-auto p-1">
        {recent?.length === 0 && open.length === 0 && <p className="px-2 py-1.5 text-pretty text-muted">No projects yet. Open a folder to start.</p>}
        {entries.length === 0 && (open.length > 0 || (recent?.length ?? 0) > 0) && (
          <p className="px-2 py-1.5 text-pretty text-muted">No projects match “{query}”.</p>
        )}
        {entries.map((entry, index) => (
          <div key={entry.path} className="flex flex-col">
            {entry.open !== entries[index - 1]?.open && <p className="menu-label">{entry.open ? 'Open' : 'Recent'}</p>}
            <div
              onPointerMove={() => setHighlighted(index)}
              className={classNames('group flex h-11 items-center gap-1 rounded-lg pr-1', index === highlighted && 'bg-shade')}
            >
              <button
                type="button"
                onClick={() => go(() => void openProject(entry.path))}
                className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2.5 pl-2 text-left"
              >
                <ProjectInitial name={entry.name} selected={entry.path === shown} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{entry.name}</span>
                    {cores[entry.path] && <ProjectMark core={cores[entry.path]!} />}
                  </span>
                  <span className="truncate text-small text-faint">{entry.path}</span>
                </span>
              </button>
              {entry.open && (
                <button
                  type="button"
                  aria-label={`Close ${entry.name}`}
                  title="Close the project"
                  onClick={() => closeProject(entry.path)}
                  className="flex size-6 shrink-0 cursor-default items-center justify-center rounded-md text-muted opacity-0 group-hover:opacity-100 hover:bg-shade hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col border-t border-line p-1">
        <button type="button" onClick={() => go(() => void pickFolder())} className="menu-row w-full text-left hover:bg-shade">
          <FolderOpen className="size-4 shrink-0 text-muted" />
          Open folder…
        </button>
        <button type="button" onClick={() => go(showProjects)} className="menu-row w-full text-left hover:bg-shade">
          <LayoutGrid className="size-4 shrink-0 text-muted" />
          All projects
        </button>
      </div>
    </Popover>
  );
}

/** Beside an open project: the spinner while a thread there works, `?` while one waits on the user. */
function ProjectMark({ core }: { core: Core }) {
  const { store } = core.client;
  const { sessions } = useAtomValue(core.sessionsAtom, { store });

  const ids = sessions.map((session) => session.id).join();

  const statuses = useMemo(
    () => atom((get) => sessions.map((session) => get(core.session(session.id)) as SessionSnapshot | undefined).map((each) => each && statusOf(each))),
    [core, ids],
  );

  const all = useAtomValue(statuses, { store });

  if (all.includes('waiting')) return <StatusIcon status="waiting" />;
  if (all.includes('working')) return <StatusIcon status="working" />;

  return null;
}
