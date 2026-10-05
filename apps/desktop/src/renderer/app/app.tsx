import { Window } from '@jinion/ui';
import { useAtomValue } from 'jotai';
import { Memory } from '../panels/memory.js';
import { Projects } from '../panels/projects.js';
import { SidePanel } from '../panels/side-panel/side-panel.js';
import { Sidebar } from '../panels/sidebar.js';
import { Skills } from '../panels/skills.js';
import { Thread } from '../panels/thread/thread.js';
import { TopBar } from '../panels/top-bar.js';
import { panelAtom, projectAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { useShortcuts } from './keys.js';

export function App() {
  const project = useAtomValue(projectAtom);

  if (!project) return <Projects />;

  return <ProjectWindow key={project} />;
}

function ProjectWindow() {
  const sidebar = useAtomValue(sidebarAtom);
  const panel = useAtomValue(panelAtom);
  const view = useAtomValue(viewAtom);

  useShortcuts();

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1">
        <Window sidebar={sidebar && <Sidebar />} top={<TopBar />}>
          {view === 'thread' && <Thread />}
          {view === 'skills' && <Skills />}
          {view === 'memory' && <Memory />}
        </Window>
      </div>
      {panel.open && <SidePanel />}
    </div>
  );
}
