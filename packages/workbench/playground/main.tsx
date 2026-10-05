import './playground.css';
import { WindowTabs } from '@jinion/native-tabs';
import { LayoutToggles, Workbench, WorkbenchProvider, WorkbenchView } from '@jinion/workbench';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { features, newThread } from './features.js';

const projects = [
  { id: 'acme-api', title: 'acme-api' },
  { id: 'bugece-web', title: 'bugece-web' },
];

const workbenches = new Map(projects.map((project) => [project.id, new Workbench(features)]));

function Playground() {
  const [tabs, setTabs] = useState(projects);
  const [active, setActive] = useState(projects[0]!.id);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');

  const workbench = workbenches.get(active)!;

  const move = (from: number, to: number) =>
    setTabs((current) => {
      const next = [...current];
      const [tab] = next.splice(from, 1);

      next.splice(to, 0, tab!);

      return next;
    });

  return (
    <div className={`${scheme} flex h-full flex-col bg-background text-ink`}>
      <WorkbenchProvider workbench={workbench}>
        <WindowTabs
          tabs={tabs.map((tab) => ({ ...tab, mark: tab.id === 'bugece-web' && <span className="size-1.5 rounded-full bg-warning" /> }))}
          active={active}
          onSelect={setActive}
          onMove={move}
          inset={12}
          trailing={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setScheme(scheme === 'light' ? 'dark' : 'light')} className="hover-shade rounded-full px-2.5 text-small text-muted">
                {scheme === 'light' ? 'Dark' : 'Light'}
              </button>
              <LayoutToggles />
            </div>
          }
        />
      </WorkbenchProvider>
      <div className="min-h-0 flex-1">
        <WorkbenchView key={active} workbench={workbench} onNewTab={() => workbench.open(newThread())} Empty={Empty} />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="w-full max-w-160 rounded-surface border border-line bg-floating px-3 py-2.5 text-muted">Ask for a change, / for commands, @ for files</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
