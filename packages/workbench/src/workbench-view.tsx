import type { ComponentType, ReactNode } from 'react';
import { ActivityBar } from './activity-bar.js';
import { useLayout, WorkbenchContext } from './context.js';
import { Group } from './group.js';
import { useShortcuts } from './keys.js';
import { Panel } from './panel.js';
import { Sidebar } from './sidebar.js';
import { StatusBar } from './status-bar.js';
import type { Workbench } from './workbench.js';

export function WorkbenchProvider({ workbench, children }: { workbench: Workbench; children: ReactNode }) {
  return <WorkbenchContext.Provider value={workbench}>{children}</WorkbenchContext.Provider>;
}

export interface WorkbenchViewProps {
  workbench: Workbench;
  /** What `+` in a row of tabs does: in Jinion, a new thread rather than a file. */
  onNewTab?: () => void;
  /** What a group with no tab shows. */
  Empty?: ComponentType;
}

/**
 * A project's window under the row of project tabs: gray chrome holding the activity bar, the sidebar and the right
 * panel, around a white sheet with the tabs and the bottom panel.
 */
export function WorkbenchView({ workbench, onNewTab, Empty }: WorkbenchViewProps) {
  useShortcuts(workbench);

  return (
    <WorkbenchProvider workbench={workbench}>
      <div className="flex h-full min-h-0 animate-fade flex-col bg-chrome text-ink">
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <Sidebar />
          <div className="mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
            <Groups onNewTab={onNewTab} Empty={Empty} />
            <Panel place="bottom" />
          </div>
          <Panel place="right" />
        </div>
        <StatusBar />
      </div>
    </WorkbenchProvider>
  );
}

function Groups({ onNewTab, Empty }: Omit<WorkbenchViewProps, 'workbench'>) {
  const count = useLayout((layout) => layout.groups.length);

  return (
    <div className="flex min-h-0 flex-1">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 flex-1 border-line not-first:border-l">
          <Group index={index} onNewTab={onNewTab} Empty={Empty} />
        </div>
      ))}
    </div>
  );
}
