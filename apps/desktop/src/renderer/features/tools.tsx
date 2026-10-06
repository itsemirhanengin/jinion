import { classNames } from '@jinion/ui';
import { type Feature, useLayout, useWorkbench } from '@jinion/workbench';
import { useAtomValue } from 'jotai';
import { ClipboardList, GitCompare, ListChecks, SquareTerminal } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { changesOf, useActiveSession, useCore } from '../state/session.js';
import { openChanges } from './changes/changes.js';
import { openPlan, plansOf } from './plan/plans.js';
import { useHasTasks } from './tasks.js';

/** The right panel: what there is to look at in the project, as a list that opens it. */
export function tools(): Feature {
  return { id: 'tools', views: [{ id: 'tools', title: 'Tools', place: 'right', Content: Tools }] };
}

function Tools() {
  const core = useCore();
  const workbench = useWorkbench();
  const session = useActiveSession();
  const terminals = useAtomValue(core.terminalsAtom);
  const shown = useLayout((layout) => layout.groups[layout.focused]?.active);
  const open = useLayout((layout) => (layout.bottom.open ? layout.bottom.view : undefined));
  const hasTasks = useHasTasks();

  const [hovered, setHovered] = useState<string>();

  // With no tasks, a panel left on Tasks shows the terminal instead.
  const bottom = open === 'tasks' && !hasTasks ? 'terminal' : open;
  const changed = session ? changesOf(session).length : 0;
  const plans = session ? plansOf(session.state.entries) : [];
  const latestPlan = plans.at(-1);
  const running = session?.fields.tasks.filter((task) => task.status === 'running').length ?? 0;

  // A view of the bottom panel opens there, and closes it when it is the one showing.
  const toggle = (view: string) => (bottom === view ? workbench.togglePanel('bottom') : workbench.showView('bottom', view));

  const items: ItemProps[] = [
    {
      icon: <GitCompare />,
      label: 'Changes',
      detail: changed || undefined,
      active: session !== undefined && shown === `changes:${session.id}`,
      onClick: () => session && openChanges(core, workbench, session.id),
    },
    ...(session && latestPlan
      ? [
          {
            icon: <ClipboardList />,
            label: 'Plan',
            detail: plans.length > 1 ? plans.length : undefined,
            active: shown?.startsWith(`plan:${session.id}|`) ?? false,
            onClick: () => openPlan(workbench, session.id, latestPlan.id),
          },
        ]
      : []),
    ...(hasTasks ? [{ icon: <ListChecks />, label: 'Tasks', detail: running || undefined, active: bottom === 'tasks', onClick: () => toggle('tasks') }] : []),
    { icon: <SquareTerminal />, label: 'Terminal', detail: terminals.length || undefined, active: bottom === 'terminal', onClick: () => toggle('terminal') },
  ];

  // Selected or under the pointer, an item is shaded; shaded items side by side draw as one block.
  const shaded = (index: number) => items[index] !== undefined && (items[index].active || items[index].label === hovered);

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate px-2 text-muted">{core.project.name}</p>
      <ul className="flex flex-col" onMouseLeave={() => setHovered(undefined)}>
        {items.map((item, index) => (
          <Item
            key={item.label}
            {...item}
            joinsAbove={shaded(index) && shaded(index - 1)}
            joinsBelow={shaded(index) && shaded(index + 1)}
            onHover={() => setHovered(item.label)}
          />
        ))}
      </ul>
    </div>
  );
}

interface ItemProps {
  icon: ReactNode;
  label: string;
  detail?: number;
  active: boolean;
  /** Selected with the item above or below it, so they draw as one block: no corners where they meet. */
  joinsAbove?: boolean;
  joinsBelow?: boolean;
  onClick: () => void;
  onHover?: () => void;
}

function Item({ icon, label, detail, active, joinsAbove, joinsBelow, onClick, onHover }: ItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onHover}
        className={classNames(
          'flex h-8 w-full cursor-default items-center gap-2 rounded-lg px-2 text-left [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-faint',
          active ? 'bg-selected text-ink' : 'text-ink/80 hover:bg-shade hover:text-ink',
          joinsAbove && 'rounded-t-none',
          joinsBelow && 'rounded-b-none',
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {detail !== undefined && <span className="text-faint tabular-nums">{detail}</span>}
      </button>
    </li>
  );
}
