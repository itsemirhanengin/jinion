import { Button, Sidebar as Frame, SidebarHeader, SidebarItem, SidebarSection, StatusIcon } from '@jinion/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Brain, ChevronLeft, PanelLeft, Shapes, SquarePen } from 'lucide-react';
import { ago } from '../lib/time.js';
import type { MockJinion } from '../mock/jinion.js';
import { projectAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { statusOf, useJinion, useSession } from '../state/session.js';

export function Sidebar() {
  const jinion = useJinion();
  const [view, setView] = useAtom(viewAtom);
  const setProject = useSetAtom(projectAtom);
  const setSidebar = useSetAtom(sidebarAtom);
  const { sessions, active } = useAtomValue(jinion.sessionsAtom);
  const saved = useAtomValue(jinion.savedAtom);

  const show = (go: () => void) => {
    go();
    setView('thread');
  };

  return (
    <Frame>
      <SidebarHeader>
        <Button size="icon" aria-label="Hide the sidebar" onClick={() => setSidebar(false)} className="[&_svg]:size-4">
          <PanelLeft />
        </Button>
        <span className="flex-1" />
        <Button size="small" onClick={() => setProject(undefined)} className="[&_svg]:size-3.5">
          <ChevronLeft />
          Projects
        </Button>
      </SidebarHeader>
      <SidebarSection>
        <SidebarItem icon={<SquarePen />} label="New thread" onClick={() => show(() => jinion.open())} />
        <SidebarItem icon={<Shapes />} label="Skills" active={view === 'skills'} onClick={() => setView('skills')} />
        <SidebarItem icon={<Brain />} label="Memory" active={view === 'memory'} onClick={() => setView('memory')} />
      </SidebarSection>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarSection title="Threads">
          {sessions.map((session) => (
            <OpenThread
              key={session.id}
              jinion={jinion}
              id={session.id}
              active={view === 'thread' && session.id === active}
              onClick={() => show(() => jinion.activate(session.id))}
            />
          ))}
          {saved.map((thread) => (
            <SidebarItem
              key={thread.id}
              icon={<StatusIcon status="idle" />}
              label={thread.title}
              trailing={ago(thread.updatedAt)}
              onClick={() => show(() => jinion.resume(thread.id))}
            />
          ))}
        </SidebarSection>
      </div>
    </Frame>
  );
}

function OpenThread({ jinion, id, active, onClick }: { jinion: MockJinion; id: string; active: boolean; onClick: () => void }) {
  const snapshot = useSession(jinion, id);

  const status = statusOf(snapshot) ?? 'idle';

  return <SidebarItem icon={<StatusIcon status={status} />} label={snapshot.state.title ?? 'New thread'} trailing="open" active={active} onClick={onClick} />;
}
