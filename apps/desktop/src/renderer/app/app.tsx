import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { WindowTabs } from '@jinion/native-tabs';
import { Button, Spinner, StatusIcon } from '@jinion/ui';
import { LayoutToggles, WorkbenchProvider, WorkbenchView } from '@jinion/workbench';
import { atom, Provider, useAtomValue } from 'jotai';
import { useMemo } from 'react';
import type { Core } from '../core/core.js';
import { NoThread } from '../features/threads/no-thread.js';
import { Projects } from '../panels/projects.js';
import { closeProject, coreAtom, coresAtom, moveProject, openProject, projectAtom, projectsAtom, showProjects } from '../state/app.js';
import { statusOf } from '../state/session.js';
import { useThreadTabs } from './thread-tabs.js';
import { workbenchOf } from './workbench.js';

/** Room at the left of the title bar for macOS's traffic lights. */
const TRAFFIC_LIGHTS = 84;

export function App() {
  const projects = useAtomValue(projectsAtom);
  const project = useAtomValue(projectAtom);
  const core = useAtomValue(coreAtom);
  const cores = useAtomValue(coresAtom);

  const ready = core && !('error' in core) ? core : undefined;
  const workbench = ready && workbenchOf(ready);

  return (
    <div className="flex h-full flex-col bg-chrome text-ink">
      <WindowTabs
        tabs={projects.map((path) => ({
          id: path,
          title: cores[path]?.project.name ?? path.slice(path.lastIndexOf('/') + 1),
          mark: cores[path] && <ProjectMark core={cores[path]} />,
        }))}
        active={project}
        onSelect={(path) => void openProject(path)}
        onClose={closeProject}
        onNew={showProjects}
        onMove={moveProject}
        inset={TRAFFIC_LIGHTS}
        trailing={
          workbench && (
            <WorkbenchProvider workbench={workbench}>
              <LayoutToggles />
            </WorkbenchProvider>
          )
        }
      />
      <div className="min-h-0 flex-1">
        {!project && <Projects />}
        {project && !core && <Waiting text="Opening the project" />}
        {core && 'error' in core && <Failed text={core.error} />}
        {ready && (
          // The project's window reads its core's store, where the client keeps what the core says.
          <Provider store={ready.client.store}>
            <ProjectWindow key={project} core={ready} />
          </Provider>
        )}
      </div>
    </div>
  );
}

function ProjectWindow({ core }: { core: Core }) {
  const workbench = workbenchOf(core);
  const gone = useAtomValue(core.goneAtom);

  useThreadTabs(core, workbench);

  if (gone) return <Failed text="This project's core stopped. Open the project again to start it." />;

  return <WorkbenchView workbench={workbench} onNewTab={() => core.act(core.open())} Empty={NoThread} />;
}

/** On a project's tab: the spinner while a thread there works, `?` while one waits on the user. */
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

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-muted">
      <Spinner />
      {text}
    </div>
  );
}

function Failed({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted">
      <p className="max-w-120 text-pretty">{text}</p>
      <Button variant="outline" size="small" onClick={showProjects}>
        Projects
      </Button>
    </div>
  );
}
