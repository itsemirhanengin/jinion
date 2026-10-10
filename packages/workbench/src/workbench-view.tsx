import { classNames } from '@jinion/ui';
import { type ComponentType, Fragment, type PointerEvent, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { useLayout, useWorkbench, WorkbenchContext } from './context.js';
import { Group } from './group.js';
import { useShortcuts } from './keys.js';
import { Panel } from './panel.js';
import { Sidebar } from './sidebar.js';
import { StatusBar } from './status-bar.js';
import { TabDrag } from './tab-drag.js';
import type { Workbench } from './workbench.js';

export function WorkbenchProvider({ workbench, children }: { workbench: Workbench; children: ReactNode }) {
  return <WorkbenchContext.Provider value={workbench}>{children}</WorkbenchContext.Provider>;
}

export interface WorkbenchViewProps {
  workbench: Workbench;
  /** What `+` in a row of tabs does, such as a new thread in Jinion's Agent mode. */
  onNewTab?: () => void;
  /** What `+` says it does. */
  newTabLabel?: string;
  /** What a group with no tab shows. */
  Empty?: ComponentType;
}

/**
 * A project's window under the title bar: the chrome holding the sidebar and the right panel, around a white sheet with
 * the tabs, split or not, and the bottom panel, all of the mode shown.
 */
export function WorkbenchView({ workbench, onNewTab, newTabLabel, Empty }: WorkbenchViewProps) {
  useShortcuts(workbench);

  return (
    <WorkbenchProvider workbench={workbench}>
      <div className="flex h-full min-h-0 animate-fade flex-col bg-chrome text-ink">
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
            <Groups onNewTab={onNewTab} newTabLabel={newTabLabel} Empty={Empty} />
            <Panel place="bottom" />
          </div>
          <Panel place="right" />
        </div>
        <StatusBar />
      </div>
    </WorkbenchProvider>
  );
}

/**
 * The groups, one or two beside or above each other, the line between them dragged to share the room. A new second
 * group grows from nothing to its share, so a split opens rather than appears.
 */
function Groups({ onNewTab, newTabLabel, Empty }: Omit<WorkbenchViewProps, 'workbench'>) {
  const workbench = useWorkbench();
  const count = useLayout((layout) => layout.groups.length);
  const direction = useLayout((layout) => layout.split ?? 'row');
  const share = useLayout((layout) => layout.share ?? 0.5);
  const focused = useLayout((layout) => layout.focused);

  const container = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState(false);
  const [resizing, setResizing] = useState(false);
  const before = useRef(count);

  useLayoutEffect(() => {
    if (count === 2 && before.current === 1) {
      setOpening(true);

      // Two frames: one drawn at nothing, then the share, so the change animates.
      requestAnimationFrame(() => requestAnimationFrame(() => setOpening(false)));
    }

    before.current = count;
  }, [count]);

  const row = direction === 'row';
  const first = opening ? (focused === 0 ? 0 : 1) : share;

  const resize = (event: PointerEvent<HTMLDivElement>) => {
    const box = container.current?.getBoundingClientRect();
    if (!box) return;

    const handle = event.currentTarget;

    handle.setPointerCapture(event.pointerId);
    setResizing(true);

    const move = (pointer: globalThis.PointerEvent) =>
      workbench.resizeSplit(row ? (pointer.clientX - box.left) / box.width : (pointer.clientY - box.top) / box.height);

    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      setResizing(false);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };

  return (
    <TabDrag>
      <div ref={container} className={classNames('flex min-h-0 min-w-0 flex-1', !row && 'flex-col')}>
        {Array.from({ length: count }, (_, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <div
                aria-hidden
                onPointerDown={resize}
                className={classNames(
                  'group/split relative z-10 shrink-0 bg-line',
                  row ? 'w-px cursor-col-resize before:absolute before:inset-y-0 before:-inset-x-1' : 'h-px cursor-row-resize before:absolute before:inset-x-0 before:-inset-y-1',
                )}
              >
                <span
                  className={classNames(
                    'absolute bg-primary/25 opacity-0 transition-opacity duration-150 group-hover/split:opacity-100',
                    row ? 'inset-y-0 -left-px w-[3px]' : 'inset-x-0 -top-px h-[3px]',
                    resizing && 'opacity-100',
                  )}
                />
              </div>
            )}
            <div
              style={count === 2 ? { flexBasis: `${(index === 0 ? first : 1 - first) * 100}%` } : undefined}
              className={classNames(
                'flex min-h-0 min-w-0 overflow-hidden',
                count === 2 ? 'shrink grow-0' : 'flex-1',
                !resizing && 'transition-[flex-basis] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              )}
            >
              <Group index={index} onNewTab={onNewTab} newTabLabel={newTabLabel} Empty={Empty} />
            </div>
          </Fragment>
        ))}
      </div>
    </TabDrag>
  );
}
