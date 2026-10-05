import './playground.css';
import { WindowTabs } from '@jinion/native-tabs';
import { StatusIcon } from '@jinion/ui';
import { emptyLayout, IconButton, LayoutToggles, Workbench, WorkbenchProvider, WorkbenchView } from '@jinion/workbench';
import { Moon, Plus, Sun } from 'lucide-react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { features, NewThread, newThread } from './features.js';

const projects = [
  { id: 'acme-api', title: 'acme-api', mark: <StatusIcon status="working" /> },
  { id: 'bugece-web', title: 'bugece-web', mark: <StatusIcon status="waiting" /> },
  { id: 'jinion', title: 'jinion', mark: <StatusIcon status="idle" /> },
];

const layout = { ...emptyLayout, activity: 'threads', lastActivity: 'threads', right: { open: true, size: 224, view: 'tools' } };

const workbenches = new Map(projects.map((project) => [project.id, new Workbench(features, layout)]));

function Playground() {
  const [tabs, setTabs] = useState(projects);
  const [active, setActive] = useState(projects[0]!.id);
  const [scheme, setScheme] = useState<'light' | 'dark'>(location.hash === '#dark' ? 'dark' : 'light');

  const workbench = workbenches.get(active)!;

  const move = (from: number, to: number) =>
    setTabs((current) => {
      const next = [...current];
      const [tab] = next.splice(from, 1);

      next.splice(to, 0, tab!);

      return next;
    });

  return (
    <div className={`${scheme} flex h-full flex-col bg-chrome text-ink`}>
      <WorkbenchProvider workbench={workbench}>
        <WindowTabs
          tabs={tabs}
          active={active}
          onSelect={setActive}
          onMove={move}
          onClose={() => undefined}
          adding={
            <IconButton label="Open a project" onClick={() => undefined}>
              <Plus />
            </IconButton>
          }
          inset={12}
          trailing={
            <>
              <IconButton label={scheme === 'light' ? 'Dark' : 'Light'} onClick={() => setScheme(scheme === 'light' ? 'dark' : 'light')}>
                {scheme === 'light' ? <Moon /> : <Sun />}
              </IconButton>
              <LayoutToggles />
            </>
          }
        />
      </WorkbenchProvider>
      <div className="min-h-0 flex-1">
        <WorkbenchView key={active} workbench={workbench} onNewTab={() => workbench.open(newThread())} Empty={NewThread} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
