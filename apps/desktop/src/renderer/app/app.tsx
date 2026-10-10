import { Button, Spinner } from '@jinion/ui';
import { useMode, useWorkbench, WorkbenchProvider, WorkbenchView } from '@jinion/workbench';
import { Provider, useAtomValue } from 'jotai';
import type { Core } from '../core/core.js';
import { NoFile } from '../features/files/files.js';
import { NoThread } from '../features/threads/no-thread.js';
import { newThread } from '../features/threads/spare.js';
import { Projects } from '../panels/projects.js';
import { appStore, coreAtom, projectAtom, showProjects } from '../state/app.js';
import { quickOpenAtom } from '../state/quick-open.js';
import { useThreadTabs } from './thread-tabs.js';
import { TitleBar } from './title-bar.js';
import { useViews } from './views.js';
import { workbenchOf } from './workbench.js';

export function App() {
  const project = useAtomValue(projectAtom);
  const core = useAtomValue(coreAtom);

  const ready = core && !('error' in core) ? core : undefined;

  if (ready) {
    return (
      // The project's window reads its core's store, where the client keeps what the core says.
      <Provider store={ready.client.store}>
        <ProjectWindow key={project} core={ready} />
      </Provider>
    );
  }

  return (
    <div className="flex h-full flex-col bg-chrome text-ink">
      <TitleBar />
      <div className="min-h-0 flex-1">
        {!project && <Projects />}
        {project && !core && <Waiting text="Opening the project" />}
        {core && 'error' in core && <Failed text={core.error} />}
      </div>
    </div>
  );
}

function ProjectWindow({ core }: { core: Core }) {
  const workbench = workbenchOf(core);
  const gone = useAtomValue(core.goneAtom);

  useThreadTabs(core, workbench);
  useViews(core, workbench);

  return (
    <WorkbenchProvider workbench={workbench}>
      <div className="flex h-full flex-col bg-chrome text-ink">
        <TitleBar project />
        <div className="min-h-0 flex-1">{gone ? <Failed text="This project's core stopped. Open the project again to start it." /> : <Workspace core={core} />}</div>
      </div>
    </WorkbenchProvider>
  );
}

/** The window under the title bar: in Agent, `+` and an empty group start a thread; in Code, they find a file. */
function Workspace({ core }: { core: Core }) {
  const workbench = useWorkbench();
  const agent = useMode() === 'agent';

  return (
    <WorkbenchView
      workbench={workbench}
      onNewTab={agent ? () => core.act(newThread(core, workbench)) : () => appStore.set(quickOpenAtom, true)}
      newTabLabel={agent ? 'New thread' : 'Open a file'}
      Empty={agent ? NoThread : NoFile}
    />
  );
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
