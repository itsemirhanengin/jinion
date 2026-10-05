import { Window } from '@jinion/ui';
import { Provider, useAtomValue } from 'jotai';
import { LoaderCircle } from 'lucide-react';
import type { Core } from '../core/core.js';
import { Accounts } from '../panels/accounts.js';
import { Memory } from '../panels/memory.js';
import { Problem } from '../panels/problem.js';
import { Projects } from '../panels/projects.js';
import { SidePanel } from '../panels/side-panel/side-panel.js';
import { Sidebar } from '../panels/sidebar.js';
import { Skills } from '../panels/skills.js';
import { Thread } from '../panels/thread/thread.js';
import { TopBar } from '../panels/top-bar.js';
import { closeProject, coreAtom, panelAtom, projectAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { useShortcuts } from './keys.js';

export function App() {
  const project = useAtomValue(projectAtom);
  const core = useAtomValue(coreAtom);

  if (!project) return <Projects />;
  if (!core) return <Waiting text={`Opening ${project}`} />;
  if ('error' in core) return <Failed text={core.error} />;

  // The project's window reads its core's store, where the client keeps what the core says.
  return (
    <Provider store={core.client.store}>
      <ProjectWindow key={project} core={core} />
    </Provider>
  );
}

function ProjectWindow({ core }: { core: Core }) {
  const sidebar = useAtomValue(sidebarAtom);
  const panel = useAtomValue(panelAtom);
  const view = useAtomValue(viewAtom);
  const gone = useAtomValue(core.goneAtom);

  useShortcuts();

  if (gone) return <Failed text="This project's core stopped. Open the project again to start it." />;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1">
        <Window sidebar={sidebar && <Sidebar />} top={<TopBar />}>
          <Problem />
          {view === 'thread' && <Thread />}
          {view === 'skills' && <Skills />}
          {view === 'memory' && <Memory />}
          {view === 'accounts' && <Accounts />}
        </Window>
      </div>
      {panel.open && <SidePanel />}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-muted [-webkit-app-region:drag]">
      <LoaderCircle className="size-4 animate-spin" />
      {text}
    </div>
  );
}

function Failed({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted [-webkit-app-region:drag]">
      <p className="max-w-120">{text}</p>
      <button type="button" onClick={closeProject} className="cursor-default rounded-full bg-primary px-3 py-1 text-small text-on-primary [-webkit-app-region:no-drag]">
        Projects
      </button>
    </div>
  );
}
