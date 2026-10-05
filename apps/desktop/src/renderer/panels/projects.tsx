import { Button } from '@jinion/ui';
import { FolderOpen, GitBranch, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RecentProject } from '../../main/bridge.js';
import { ago } from '../lib/time.js';
import { openProject } from '../state/app.js';

/** The folders opened before, kept by the desktop app; opening a project is picking its folder, the core's cwd. */
export function Projects() {
  const [projects, setProjects] = useState<RecentProject[]>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void window.desktop.recentProjects().then(setProjects);
  }, []);

  const shown = (projects ?? []).filter((project) => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));

  const pick = async () => {
    const path = await window.desktop.pickFolder();

    if (path) void openProject(path);
  };

  const forget = async (path: string) => {
    await window.desktop.forgetProject(path);
    setProjects((all) => all?.filter((project) => project.path !== path));
  };

  return (
    <div className="mr-2 mb-2 ml-2 h-[calc(100%-0.5rem)] overflow-y-auto rounded-xl bg-background shadow-xs ring-1 ring-edge">
      <div className="mx-auto flex w-full max-w-176 flex-col gap-6 px-8 pt-16 pb-12">
        <div className="flex items-center gap-3">
          <h1 className="flex-1 text-title font-semibold">Projects</h1>
          <Button variant="primary" size="small" onClick={pick}>
            <FolderOpen />
            Open folder
          </Button>
        </div>
        {projects && projects.length > 0 && (
          <label className="flex h-9 items-center gap-2 rounded-lg bg-shade px-3">
            <Search className="size-4 shrink-0 text-faint" />
            <input
              name="search"
              aria-label="Search the projects"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            />
          </label>
        )}
        {projects?.length === 0 && <p className="text-pretty text-muted">Open a folder to start: the agent works in it, and it shows here next time.</p>}
        {shown.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="px-2 text-muted">Recent</p>
            <ul className="flex flex-col">
              {shown.map((project) => (
                <li key={project.path} className="group relative">
                  <button
                    type="button"
                    onClick={() => void openProject(project.path)}
                    className="flex h-12 w-full cursor-default items-center gap-3 rounded-lg px-2 pr-10 text-left hover:bg-shade"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-small font-semibold text-on-primary uppercase">
                      {project.name.slice(0, 1)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{project.name}</span>
                      <span className="truncate text-faint" title={project.path}>
                        {project.path}
                      </span>
                    </span>
                    {project.branch && (
                      <span className="flex shrink-0 items-center gap-1.5 text-muted">
                        <GitBranch className="size-4 shrink-0" />
                        {project.branch}
                      </span>
                    )}
                    <span className="w-12 shrink-0 text-right text-faint tabular-nums">{ago(project.openedAt)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Forget ${project.name}`}
                    title="Forget"
                    onClick={() => void forget(project.path)}
                    className="absolute top-3 right-2 hidden size-6 cursor-default items-center justify-center rounded-md text-faint group-hover:flex hover:bg-shade hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
