import type { SavedSummary } from '@jinion/core/api/schemas';
import { Button, classNames } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { FolderOpen, FolderPlus, GitBranch, MessageSquare, Search, SquarePen, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RecentProject } from '../../main/bridge.js';
import { ago } from '../lib/time.js';
import { forgetRecent, openThread, pickFolder, recentAtom, refreshRecent } from '../state/app.js';
import { ProjectInitial } from './project-initial.js';

/** The folders opened before on the left, the picked one's threads on the right; opening a thread opens its project. */
export function Projects() {
  const projects = useAtomValue(recentAtom);

  const [picked, setPicked] = useState<string>();

  useEffect(() => {
    void refreshRecent();
  }, []);

  const project = projects?.find((each) => each.path === picked) ?? projects?.[0];

  return (
    <div className="mr-2 mb-2 ml-2 h-[calc(100%-0.5rem)] overflow-y-auto rounded-xl bg-background shadow-xs ring-1 ring-edge">
      {projects?.length === 0 && <NoProjects />}
      {project && projects && (
        <div className="mx-auto grid w-full max-w-240 grid-cols-[15rem_minmax(0,1fr)] gap-x-10 px-8 pt-16 pb-12">
          <ProjectList projects={projects} picked={project.path} onPick={setPicked} />
          <Sessions key={project.path} project={project} />
        </div>
      )}
    </div>
  );
}

function ProjectList({ projects, picked, onPick }: { projects: RecentProject[]; picked: string; onPick: (path: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-9 items-center justify-between pl-2">
        <h1 className="font-medium">Projects</h1>
        <Button size="icon" aria-label="Open folder" title="Open folder" onClick={() => void pickFolder()}>
          <FolderPlus />
        </Button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {projects.map((project) => (
          <li key={project.path} className="group relative">
            <button
              type="button"
              title={project.path}
              onClick={() => onPick(project.path)}
              className={classNames(
                'flex h-8 w-full cursor-default items-center gap-2.5 rounded-lg px-2 pr-8 text-left',
                project.path === picked ? 'bg-selected' : 'hover:bg-shade',
              )}
            >
              <ProjectInitial name={project.name} selected={project.path === picked} />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Forget ${project.name}`}
              title="Forget"
              onClick={() => void forgetRecent(project.path)}
              className="absolute top-1.5 right-1.5 hidden size-5 cursor-default items-center justify-center rounded-md text-faint group-hover:flex hover:bg-shade hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sessions({ project }: { project: RecentProject }) {
  const [sessions, setSessions] = useState<SavedSummary[]>();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void window.desktop.projectSessions(project.path).then(setSessions);
  }, [project.path]);

  const shown = (sessions ?? []).filter((session) => `${session.title} ${session.firstPrompt ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label className="mb-4 flex h-9 items-center gap-2 rounded-lg bg-shade px-3">
        <Search className="size-4 shrink-0 text-faint" />
        <input
          name="search"
          aria-label={`Search the sessions in ${project.name}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search sessions in ${project.name}`}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex h-7 items-center gap-3 pl-2">
        <h2 className="font-medium">Recent sessions</h2>
        {project.branch && (
          <span className="flex min-w-0 items-center gap-1.5 text-faint">
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate">{project.branch}</span>
          </span>
        )}
        <div className="flex-1" />
        {sessions && sessions.length > 0 && (
          <Button size="small" onClick={() => void openThread(project.path)}>
            <SquarePen />
            New session
          </Button>
        )}
      </div>
      {sessions?.length === 0 && <NoSessions project={project} />}
      {sessions && sessions.length > 0 && shown.length === 0 && <p className="px-2 py-1.5 text-pretty text-muted">No sessions match “{query}”.</p>}
      {shown.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {shown.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => void openThread(project.path, session.id)}
                className="flex h-8 w-full cursor-default items-center gap-2.5 rounded-lg px-2 text-left hover:bg-shade"
              >
                <MessageSquare className="size-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                {session.worktree && (
                  <span className="flex min-w-0 shrink items-center gap-1.5 text-faint">
                    <GitBranch className="size-3.5 shrink-0" />
                    <span className="truncate">{session.worktree}</span>
                  </span>
                )}
                <span className="w-10 shrink-0 text-right text-faint tabular-nums">{ago(session.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoSessions({ project }: { project: RecentProject }) {
  return (
    <div className="mt-2 flex flex-col items-center gap-3 rounded-xl bg-raised px-6 py-12 text-center ring-1 ring-edge">
      <div className="flex flex-col gap-1">
        <p className="font-medium">No sessions in {project.name} yet</p>
        <p className="max-w-[44ch] text-pretty text-muted">Start one and tell the agent what to change. It works in this folder, and the session shows here.</p>
      </div>
      <Button variant="primary" size="small" onClick={() => void openThread(project.path)}>
        <SquarePen />
        New session
      </Button>
    </div>
  );
}

function NoProjects() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 pb-[8vh] text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-shade text-muted">
        <FolderOpen className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-semibold">No projects yet</h1>
        <p className="max-w-[44ch] text-pretty text-muted">Open a folder to start. The agent works in it, and it shows here next time.</p>
      </div>
      <Button variant="primary" size="small" onClick={() => void pickFolder()}>
        <FolderOpen />
        Open folder
      </Button>
    </div>
  );
}
