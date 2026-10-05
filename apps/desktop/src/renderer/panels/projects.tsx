import { Avatar, Button, Empty } from '@jinion/ui';
import { FolderGit2, FolderOpen, GitBranch, Search, X } from 'lucide-react';
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
    <div className="flex h-full flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 pr-4 pl-24 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
        <span className="font-medium">Jinion</span>
        <span className="flex-1" />
        <Avatar name="Jinion" />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-200 flex-col gap-5 px-8 pt-10 pb-12">
          <div className="flex items-center gap-3">
            <h1 className="flex-1 text-xl font-semibold">Projects</h1>
            {projects && projects.length > 0 && (
              <label className="flex h-8 w-56 items-center gap-2 rounded-full border border-line px-3 focus-within:border-ink/30">
                <Search className="size-3.5 text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
                />
              </label>
            )}
            <Button variant="primary" size="small" onClick={pick} className="[&_svg]:size-3.5">
              <FolderOpen />
              Open folder
            </Button>
          </div>
          {projects?.length === 0 && <Empty>Open a folder to start: the agent works in it, and it shows here next time.</Empty>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {shown.map((project) => (
              <div key={project.path} className="group relative">
                <button
                  type="button"
                  onClick={() => void openProject(project.path)}
                  className="flex w-full cursor-default flex-col gap-3 rounded-xl border border-line bg-raised p-4 text-left transition-colors hover:border-ink/20 hover:bg-hover/30"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line">
                      <FolderGit2 className="size-4 text-muted" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{project.name}</span>
                      <span className="truncate text-small text-faint" title={project.path}>
                        {project.path}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-small text-muted">
                    <GitBranch className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">{project.branch ?? 'no git'}</span>
                    <span className="text-faint">{ago(project.openedAt)} ago</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Forget ${project.name}`}
                  onClick={() => void forget(project.path)}
                  className="absolute top-2 right-2 flex size-6 cursor-default items-center justify-center rounded-full text-faint opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
