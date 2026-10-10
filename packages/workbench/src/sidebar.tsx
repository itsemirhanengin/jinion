import { PillTabs } from '@jinion/ui';
import { useLayout, useMode, useWorkbench } from './context.js';
import { Splitter } from './splitter.js';

/**
 * The open activity's sidebar, on the chrome: under its title when it is its mode's only one, under the mode's activities
 * as pill tabs otherwise, the open one named beside its icon.
 */
export function Sidebar() {
  const workbench = useWorkbench();
  const mode = useMode();
  const id = useLayout((layout) => layout.activity);
  const width = useLayout((layout) => layout.sidebarWidth);

  const activities = workbench.activitiesOf(mode).filter((activity) => activity.Sidebar);
  const activity = activities.find((candidate) => candidate.id === id);
  if (!activity?.Sidebar) return <div className="w-2 shrink-0" />;

  const { Sidebar: Content, Actions } = activity;

  return (
    <>
      <aside style={{ width }} className="flex shrink-0 flex-col gap-2 pb-2 pl-2">
        <header className="flex h-8 shrink-0 items-center gap-0.5">
          {activities.length > 1 ? (
            <div className="flex min-w-0 flex-1 items-center">
              <PillTabs
                value={activity.id}
                onChange={(next) => workbench.show(next)}
                tabs={activities.map(({ id, title, icon, Badge }) => ({ id, label: title, icon, badge: Badge && <Badge /> }))}
              />
            </div>
          ) : (
            <h2 className="min-w-0 flex-1 truncate px-3 font-medium text-muted">{activity.title}</h2>
          )}
          {Actions && <Actions />}
        </header>
        <div key={activity.id} className="min-h-0 flex-1 animate-fade overflow-y-auto">
          <Content />
        </div>
      </aside>
      <Splitter axis="x" size={width} min={200} max={480} onResize={(size) => workbench.resize('sidebar', size)} />
    </>
  );
}
