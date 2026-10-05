import { accountLabel } from '@jinion/core/agent/accounts';
import { Button, Sidebar as Frame, SidebarHeader, SidebarItem, SidebarSection, StatusIcon } from '@jinion/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Brain, ChevronLeft, CircleUserRound, PanelLeft, Shapes, SquarePen } from 'lucide-react';
import type { Core } from '../core/core.js';
import { ago } from '../lib/time.js';
import { closeProject, sidebarAtom, viewAtom } from '../state/app.js';
import { statusOf, useActiveSession, useCore, useSession } from '../state/session.js';

export function Sidebar() {
  const core = useCore();
  const [view, setView] = useAtom(viewAtom);
  const setSidebar = useSetAtom(sidebarAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);
  const shown = useAtomValue(core.client.shownAtom);
  const saved = useAtomValue(core.savedAtom);
  const app = useAtomValue(core.appAtom);
  const session = useActiveSession();

  const agent = session?.fields.agent;
  const identity = agent ? app?.identities[agent] : undefined;

  const show = (go: () => unknown) => {
    void go();
    setView('thread');
  };

  return (
    <Frame>
      <SidebarHeader>
        <Button size="icon" aria-label="Hide the sidebar" onClick={() => setSidebar(false)} className="[&_svg]:size-4">
          <PanelLeft />
        </Button>
        <span className="flex-1" />
        <Button size="small" onClick={closeProject} className="[&_svg]:size-3.5">
          <ChevronLeft />
          Projects
        </Button>
      </SidebarHeader>
      <SidebarSection>
        <SidebarItem icon={<SquarePen />} label="New thread" onClick={() => show(() => core.open())} />
        <SidebarItem icon={<Shapes />} label="Skills" active={view === 'skills'} onClick={() => setView('skills')} />
        <SidebarItem icon={<Brain />} label="Memory" active={view === 'memory'} onClick={() => setView('memory')} />
      </SidebarSection>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarSection title="Threads">
          {sessions.map((each) => (
            <OpenThread
              key={each.id}
              core={core}
              id={each.id}
              active={view === 'thread' && each.id === shown}
              onClick={() => show(() => core.activate(each.id))}
            />
          ))}
          {saved.map((thread) => (
            <SidebarItem
              key={thread.id}
              icon={<StatusIcon status="idle" />}
              label={thread.title}
              trailing={ago(thread.updatedAt)}
              onClick={() => show(() => core.resume(thread.id))}
            />
          ))}
        </SidebarSection>
      </div>
      <SidebarSection>
        <SidebarItem
          icon={<CircleUserRound />}
          label={identity?.signedIn ? accountLabel(identity) || identity.name : 'Sign in'}
          trailing={agent}
          active={view === 'accounts'}
          onClick={() => setView('accounts')}
        />
      </SidebarSection>
    </Frame>
  );
}

function OpenThread({ core, id, active, onClick }: { core: Core; id: string; active: boolean; onClick: () => void }) {
  const snapshot = useSession(core, id);

  const status = (snapshot && statusOf(snapshot)) ?? 'idle';

  return <SidebarItem icon={<StatusIcon status={status} />} label={snapshot?.state.title ?? 'New thread'} trailing="open" active={active} onClick={onClick} />;
}
