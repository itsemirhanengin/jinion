import { useLayout, useWorkbench } from './context.js';
import { Splitter } from './splitter.js';

export function Sidebar() {
  const workbench = useWorkbench();
  const id = useLayout((layout) => layout.activity);
  const width = useLayout((layout) => layout.sidebarWidth);

  const activity = workbench.activities.find((candidate) => candidate.id === id);
  if (!activity?.Sidebar) return null;

  const { Sidebar: Content } = activity;

  return (
    <>
      <aside style={{ width }} className="flex shrink-0 flex-col bg-raised">
        <header className="flex h-9 shrink-0 items-center px-3 text-small font-medium text-muted">{activity.title}</header>
        <div className="min-h-0 flex-1 overflow-auto">
          <Content />
        </div>
      </aside>
      <Splitter axis="x" size={width} min={180} max={520} onResize={(size) => workbench.resize('sidebar', size)} />
    </>
  );
}
