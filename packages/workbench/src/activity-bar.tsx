import { classNames } from '@jinion/ui';
import { useLayout, useWorkbench } from './context.js';
import type { Activity } from './feature.js';

export function ActivityBar() {
  const workbench = useWorkbench();
  const top = workbench.activities.filter((activity) => !activity.foot);
  const foot = workbench.activities.filter((activity) => activity.foot);

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 pt-1 pb-3">
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
        'relative flex size-8 cursor-default items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
        open ? 'bg-selected text-ink' : 'text-muted hover:bg-shade hover:text-ink',
      )}
    >
      {activity.icon}
      {Badge && (
        <span className="absolute top-1.5 right-1.5">
          <Badge />
        </span>
      )}
    </button>
  );
}
