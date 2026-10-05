import { classNames, Popover } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import type { RecentProject } from '../../main/bridge.js';
import { ProjectInitial } from '../panels/project-initial.js';
import { openProject, pickFolder, recentAtom, refreshRecent } from '../state/app.js';

/** How many of the newest projects the menu calls recent; the rest follow under their own label. */
const RECENT = 5;

/** The title bar's `+`: a menu of the projects opened before, with a search, and the folder picker under them. */
export function ProjectPicker() {
  const projects = useAtomValue(recentAtom);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const shown = (projects ?? []).filter((project) => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));
  const recent = query ? shown : shown.slice(0, RECENT);
  const others = query ? [] : shown.slice(RECENT);

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) return;

    setQuery('');
    setHighlighted(0);
    void refreshRecent();
  };

  const pick = (project: RecentProject) => {
    setOpen(false);
    void openProject(project.path);
  };

  const openFolder = () => {
    setOpen(false);
    void pickFolder();
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), Math.max(shown.length - 1, 0)));
    }

    if (event.key === 'Enter' && shown[highlighted]) pick(shown[highlighted]);
  };

  const row = (project: RecentProject) => {
    const index = shown.indexOf(project);

    return (
      <button
        key={project.path}
        type="button"
        onClick={() => pick(project)}
        onPointerMove={() => setHighlighted(index)}
        className={classNames('flex h-11 w-full cursor-default items-center gap-2.5 rounded-lg px-2 text-left', index === highlighted && 'bg-shade')}
      >
        <ProjectInitial name={project.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{project.name}</span>
          <span className="truncate text-small text-faint">{project.path}</span>
        </span>
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      returnFocus={false}
      trigger={
        <button
          type="button"
          aria-label="Open a project"
          title="Open a project"
          className={classNames(
            'flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg hover:bg-shade hover:text-ink',
            open ? 'bg-shade text-ink' : 'text-muted',
          )}
        >
          <Plus className="size-4" />
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
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-1">
        {projects?.length === 0 && <p className="px-2 py-1.5 text-pretty text-muted">No projects yet. Open a folder to start.</p>}
        {projects && projects.length > 0 && shown.length === 0 && <p className="px-2 py-1.5 text-pretty text-muted">No projects match “{query}”.</p>}
        {recent.length > 0 && (
          <div className="flex flex-col">
            {!query && <p className="px-2 pt-1.5 pb-1 text-small text-muted">Recent</p>}
            {recent.map(row)}
          </div>
        )}
        {others.length > 0 && (
          <div className="flex flex-col">
            <p className="px-2 pt-1.5 pb-1 text-small text-muted">Other projects</p>
            {others.map(row)}
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-line p-1">
        <button type="button" onClick={openFolder} className="flex h-8 w-full cursor-default items-center gap-2.5 rounded-lg px-2 text-left hover:bg-shade">
          <FolderOpen className="size-4 shrink-0 text-muted" />
          Open folder…
        </button>
      </div>
    </Popover>
  );
}
