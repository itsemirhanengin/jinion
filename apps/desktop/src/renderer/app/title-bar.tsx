import { PillTabs } from '@jinion/ui';
import { IconButton, useMode, useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { BookOpen, Brain, Code, MessagesSquare, UserRound } from 'lucide-react';
import { QuickOpen } from '../features/quick-open.js';
import { Waiting } from '../features/threads/thread-list.js';
import { useCore } from '../state/session.js';
import { ProjectSwitcher } from './project-switcher.js';

/** Room at the left for macOS's traffic lights. */
const TRAFFIC_LIGHTS = 84;

const modes = [
  { mode: 'agent', label: 'Agent', icon: <MessagesSquare /> },
  { mode: 'code', label: 'Code', icon: <Code /> },
];

/**
 * The window's top, which drags it: the project as a dropdown and, in a project, its Agent and Code modes; the search in
 * the middle; the pages and the profile at the end.
 */
export function TitleBar({ project }: { project?: boolean }) {
  return (
    <header
      style={{ paddingLeft: TRAFFIC_LIGHTS }}
      className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 bg-chrome pr-3 [-webkit-app-region:drag]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <ProjectSwitcher />
          {project && <ModeSwitch />}
        </div>
      </div>
      {project ? <QuickOpen /> : <span />}
      <div className="flex items-center justify-end">{project && <Pages />}</div>
    </header>
  );
}

/** Agent and Code as pill tabs; Agent marks a thread waiting on the user while Code shows. */
function ModeSwitch() {
  const workbench = useWorkbench();
  const mode = useMode();

  return (
    <PillTabs
      value={mode}
      onChange={(next) => workbench.setMode(next)}
      tabs={modes.map((each) => ({ id: each.mode, label: each.label, icon: each.icon, hint: '⌘E', badge: each.mode === 'agent' && mode !== 'agent' && <Waiting /> }))}
    />
  );
}

function Pages() {
  const core = useCore();
  const workbench = useWorkbench();
  const app = useAtomValue(core.appAtom);

  const email = Object.values(app?.identities ?? {}).find((identity) => identity.email)?.email;

  return (
    <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
      <IconButton label="Skills" onClick={() => workbench.open({ kind: 'page', id: 'skills' })}>
        <BookOpen />
      </IconButton>
      <IconButton label="Memory" onClick={() => workbench.open({ kind: 'page', id: 'memory' })}>
        <Brain />
      </IconButton>
      <button
        type="button"
        aria-label="Profile"
        title="Profile"
        onClick={() => workbench.open({ kind: 'page', id: 'profile' })}
        className="ml-1.5 flex size-6 cursor-default items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary uppercase hover:bg-primary/20"
      >
        {email?.[0] ?? <UserRound className="size-3.5" />}
      </button>
    </div>
  );
}
