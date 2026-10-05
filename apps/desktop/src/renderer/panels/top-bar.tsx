import { Button, ChoiceMenu, Pill, Tab, Tabs } from '@jinion/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { PanelLeft, PanelRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RecentProject } from '../../main/bridge.js';
import type { Core } from '../core/core.js';
import { openProject, panelAtom, seenChangesAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { changesOf, statusOf, useActiveSession, useCore, useSession } from '../state/session.js';

export function TopBar() {
  const core = useCore();
  const [sidebar, setSidebar] = useAtom(sidebarAtom);
  const [panel, setPanel] = useAtom(panelAtom);
  const [view, setView] = useAtom(viewAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);
  const shown = useAtomValue(core.client.shownAtom);
  const seen = useAtomValue(seenChangesAtom);
  const session = useActiveSession();
  const [recent, setRecent] = useState<RecentProject[]>([core.project]);

  useEffect(() => {
    void window.desktop.recentProjects().then(setRecent);
  }, []);

  const changed = session ? changesOf(session).length : 0;
  const marked = !panel.open && changed > (session ? (seen[session.id] ?? 0) : 0);

  const goTo = (go: () => unknown) => {
    void go();
    setView('thread');
  };

  return (
    <>
      {!sidebar && (
        <>
          <span className="w-16 shrink-0" />
          <Button size="icon" aria-label="Show the sidebar" onClick={() => setSidebar(true)} className="[&_svg]:size-4">
            <PanelLeft />
          </Button>
        </>
      )}
      <ChoiceMenu
        value={core.project.path}
        onChange={(path) => void openProject(path)}
        groups={[{ label: 'Projects', choices: recent.map((project) => ({ value: project.path, label: project.name, description: project.path })) }]}
        trigger={
          <Pill tone="accent" chevron="up-down">
            {core.project.name}
          </Pill>
        }
      />
      <Tabs>
        {sessions.map((each) => (
          <SessionTab key={each.id} core={core} id={each.id} active={view === 'thread' && each.id === shown} onClick={() => goTo(() => core.activate(each.id))} />
        ))}
        <Button size="icon" aria-label="New thread" onClick={() => goTo(() => core.open())} className="[&_svg]:size-4">
          <Plus />
        </Button>
      </Tabs>
      <Button
        size="icon"
        aria-label={panel.open ? 'Hide the side panel' : 'Show the side panel'}
        onClick={() => setPanel({ ...panel, open: !panel.open })}
        className="relative [&_svg]:size-4"
      >
        <PanelRight />
        {marked && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-working" />}
      </Button>
    </>
  );
}

function SessionTab({ core, id, active, onClick }: { core: Core; id: string; active: boolean; onClick: () => void }) {
  const snapshot = useSession(core, id);
  const setView = useSetAtom(viewAtom);

  const files = snapshot ? changesOf(snapshot) : [];
  const status = snapshot && statusOf(snapshot);

  return (
    <Tab
      title={snapshot?.state.title ?? 'New thread'}
      status={status}
      added={files.reduce((sum, file) => sum + file.added, 0)}
      removed={files.reduce((sum, file) => sum + file.removed, 0)}
      badge={status ? undefined : 'New'}
      active={active}
      onClick={onClick}
      onClose={() => {
        void core.close(id);
        setView('thread');
      }}
    />
  );
}
