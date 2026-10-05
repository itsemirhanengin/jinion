import { SidePanel as Frame } from '@jinion/ui';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { type PanelTab, panelAtom, panelFileAtom, seenChangesAtom } from '../../state/app.js';
import { changesOf, useActiveSession } from '../../state/session.js';
import { Changes } from './changes.js';
import { Files } from './files.js';
import { Tasks } from './tasks.js';

export function SidePanel() {
  const [panel, setPanel] = useAtom(panelAtom);
  const [panelFiles, setPanelFiles] = useAtom(panelFileAtom);
  const setSeen = useSetAtom(seenChangesAtom);
  const session = useActiveSession();

  const changes = session ? changesOf(session) : [];
  const selected = session ? panelFiles[session.id] : undefined;
  const running = session?.fields.tasks.some((task) => task.status === 'running') ?? false;

  useEffect(() => {
    if (session && panel.tab === 'changes') setSeen((seen) => ({ ...seen, [session.id]: changes.length }));
  }, [session?.id, panel.tab, changes.length]);

  const select = (path: string) => session && setPanelFiles((files) => ({ ...files, [session.id]: path }));

  return (
    <Frame
      tabs={[
        { id: 'changes', label: changes.length > 0 ? `Changes ${changes.length}` : 'Changes' },
        { id: 'files', label: 'Files' },
        { id: 'tasks', label: 'Tasks', marked: running && panel.tab !== 'tasks' },
      ]}
      active={panel.tab}
      onSelect={(tab) => setPanel({ ...panel, tab: tab as PanelTab })}
      onClose={() => setPanel({ ...panel, open: false })}
      width={panel.width}
      onResize={(width) => setPanel((current) => ({ ...current, width }))}
    >
      {panel.tab === 'changes' && <Changes files={changes} selected={selected} onSelect={select} />}
      {panel.tab === 'files' && <Files touched={changes.map((file) => file.path)} selected={selected} onSelect={select} />}
      {panel.tab === 'tasks' && session && <Tasks session={session} />}
    </Frame>
  );
}
