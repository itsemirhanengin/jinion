import { classNames } from '@jinion/ui';
import type { Activity } from './feature.js';
import { useLayout, useWorkbench } from './context.js';

export function ActivityBar() {
  const workbench = useWorkbench();
  const top = workbench.activities.filter((activity) => !activity.foot);
  const foot = workbench.activities.filter((activity) => activity.foot);

  return (
    <nav className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line bg-raised py-2">
      {top.map((activity) => (
        <Item key={activity.id} activity={activity} />
      ))}
      <div className="flex-1" />
      {foot.map((activity) => (
        <Item key={activity.id} activity={activity} />
      ))}
    </nav>
  );
}

function Item({ activity }: { activity: Activity & { id: string } }) {
  const workbench = useWorkbench();
  const open = useLayout((layout) => layout.activity === activity.id);
  const { Badge } = activity;

  return (
    <button
      type="button"
      title={activity.title}
      aria-label={activity.title}
      aria-pressed={open}
      onClick={() => workbench.activate(activity.id)}
      className={classNames(
        'hover-shade relative flex size-8 cursor-default items-center justify-center rounded-full transition-colors duration-120 [&_svg]:size-4.5',
        open ? 'bg-surface-neutral text-ink' : 'text-muted hover:text-ink',
      )}
    >
      {activity.icon}
      {Badge && (
        <span className="absolute -top-0.5 -right-0.5">
          <Badge />
        </span>
      )}
    </button>
  );
}
