import { Avatar, Button } from '@jinion/ui';
import { useSetAtom } from 'jotai';
import { FolderGit2, FolderOpen, GitBranch, Search } from 'lucide-react';
import { useState } from 'react';
import { ago } from '../lib/time.js';
import { projects } from '../mock/projects.js';
import { projectAtom } from '../state/app.js';

/** The recent projects, kept by the desktop app; one opens in the window. */
export function Projects() {
  const setProject = useSetAtom(projectAtom);
  const [query, setQuery] = useState('');

  const shown = projects.filter((project) => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 pr-4 pl-24 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
        <span className="font-medium">Jinion</span>
        <span className="flex-1" />
        <Avatar name="Emirhan" />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-200 flex-col gap-5 px-8 pt-10 pb-12">
          <div className="flex items-center gap-3">
            <h1 className="flex-1 text-xl font-semibold">Projects</h1>
            <label className="flex h-8 w-56 items-center gap-2 rounded-full border border-line px-3 focus-within:border-ink/30">
              <Search className="size-3.5 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
              />
            </label>
            <Button variant="primary" size="small" onClick={() => setProject(projects[0]!.id)} className="[&_svg]:size-3.5">
              <FolderOpen />
              Open folder
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {shown.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setProject(project.id)}
                className="flex cursor-default flex-col gap-3 rounded-xl border border-line bg-raised p-4 text-left transition-colors hover:border-ink/20 hover:bg-hover/30"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line">
                    <FolderGit2 className="size-4 text-muted" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{project.name}</span>
                    <span className="truncate text-small text-faint">{project.path}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-small text-muted">
                  <GitBranch className="size-3.5" />
                  <span className="min-w-0 flex-1 truncate">{project.branch}</span>
                  <span className="text-faint">{ago(project.openedAt)} ago</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
