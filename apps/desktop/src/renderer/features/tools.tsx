import { type Feature, useLayout, useWorkbench } from '@jinion/workbench';
import { GitCompare, SquareTerminal } from 'lucide-react';
import type { ReactNode } from 'react';
import { changesOf, useActiveSession, useCore } from '../state/session.js';
import { openChanges } from './changes/changes.js';

/** The right panel: what there is to look at in the project, as a list that opens it. */
export function tools(): Feature {
  return { id: 'tools', views: [{ id: 'tools', title: 'Tools', place: 'right', Content: Tools }] };
}

function Tools() {
  const core = useCore();
  const workbench = useWorkbench();
  const session = useActiveSession();
  const shown = useLayout((layout) => layout.groups[layout.focused]?.active);
  const bottom = useLayout((layout) => layout.bottom.open);

  const changed = session ? changesOf(session).length : 0;
  const running = session?.fields.tasks.filter((task) => task.status === 'running').length ?? 0;

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate px-2 text-muted">{core.project.name}</p>
      <ul className="flex flex-col">
        <Item
          icon={<GitCompare />}
          label="Changes"
          detail={changed || undefined}
          active={session !== undefined && shown === `changes:${session.id}`}
          onClick={() => session && openChanges(core, workbench, session.id)}
        />
        <Item icon={<SquareTerminal />} label="Tasks" detail={running || undefined} active={bottom} onClick={() => workbench.togglePanel('bottom')} />
      </ul>
    </div>
  );
}

function Item({ icon, label, detail, active, onClick }: { icon: ReactNode; label: string; detail?: number; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-faint ${active ? 'bg-selected text-ink' : 'text-ink/80 hover:bg-shade hover:text-ink'}`}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {detail !== undefined && <span className="text-faint tabular-nums">{detail}</span>}
      </button>
    </li>
  );
}
