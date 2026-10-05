import { useLayout, useWorkbench } from './context.js';
import { Splitter } from './splitter.js';

export function Sidebar() {
  const workbench = useWorkbench();
  const id = useLayout((layout) => layout.activity);
  const width = useLayout((layout) => layout.sidebarWidth);

  const activity = workbench.activities.find((candidate) => candidate.id === id);
  if (!activity?.Sidebar) return null;

  const { Sidebar: Content, Actions } = activity;

  return (
    <>
      <aside style={{ width }} className="flex shrink-0 flex-col gap-3 pt-1 pb-3">
        <header className="flex h-7 shrink-0 items-center gap-1 pr-2 pl-2">
          <h2 className="min-w-0 flex-1 truncate font-medium">{activity.title}</h2>
          {Actions && <Actions />}
        </header>
        <div key={activity.id} className="min-h-0 flex-1 animate-fade overflow-y-auto pr-2">
          <Content />
        </div>
      </aside>
      <Splitter axis="x" size={width} min={200} max={480} onResize={(size) => workbench.resize('sidebar', size)} />
    </>
  );
}
