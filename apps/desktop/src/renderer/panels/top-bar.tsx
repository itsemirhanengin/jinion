import { Avatar, Button, ChoiceMenu, Pill, Tab, Tabs } from '@jinion/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { PanelLeft, PanelRight, Plus } from 'lucide-react';
import type { MockJinion } from '../mock/jinion.js';
import { projects } from '../mock/projects.js';
import { panelAtom, projectAtom, seenChangesAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { changesOf, statusOf, useActiveSession, useJinion, useSession } from '../state/session.js';

export function TopBar() {
  const jinion = useJinion();
  const [sidebar, setSidebar] = useAtom(sidebarAtom);
  const [panel, setPanel] = useAtom(panelAtom);
  const setProject = useSetAtom(projectAtom);
  const [view, setView] = useAtom(viewAtom);
  const { sessions, active } = useAtomValue(jinion.sessionsAtom);
  const seen = useAtomValue(seenChangesAtom);
  const session = useActiveSession();

  const changed = session ? changesOf(session).length : 0;
  const marked = !panel.open && changed > (session ? (seen[session.id] ?? 0) : 0);

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
        value={jinion.project.id}
        onChange={(id) => setProject(id)}
        groups={[{ label: 'Projects', choices: projects.map((project) => ({ value: project.id, label: project.name, description: project.path })) }]}
        trigger={
          <Pill tone="accent" chevron="up-down">
            {jinion.project.name}
          </Pill>
        }
      />
      <Tabs>
        {sessions.map((each) => (
          <SessionTab
            key={each.id}
            jinion={jinion}
            id={each.id}
            active={view === 'thread' && each.id === active}
            onClick={() => {
              jinion.activate(each.id);
              setView('thread');
            }}
          />
        ))}
        <Button
          size="icon"
          aria-label="New thread"
          onClick={() => {
            jinion.open();
            setView('thread');
          }}
          className="[&_svg]:size-4"
        >
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
      <Avatar name="Emirhan" />
    </>
  );
}

function SessionTab({ jinion, id, active, onClick }: { jinion: MockJinion; id: string; active: boolean; onClick: () => void }) {
  const snapshot = useSession(jinion, id);

  const files = changesOf(snapshot);
  const status = statusOf(snapshot);

  return (
    <Tab
      title={snapshot.state.title ?? 'New thread'}
      status={status}
      added={files.reduce((sum, file) => sum + file.added, 0)}
      removed={files.reduce((sum, file) => sum + file.removed, 0)}
      badge={status ? undefined : 'New'}
      active={active}
      onClick={onClick}
      onClose={() => jinion.close(id)}
    />
  );
}
