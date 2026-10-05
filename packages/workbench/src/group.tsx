import { classNames } from '@jinion/ui';
import { Columns2, Plus, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { TabContext, useLayout, useWorkbench } from './context.js';
import { IconButton } from './icon-button.js';
import { keyOf, type TabRef } from './layout.js';

export interface GroupProps {
  index: number;
  onNewTab?: () => void;
  Empty?: ComponentType;
}

/** A row of tabs and the one shown; the sheet holds one or two of them side by side. */
export function Group({ index, onNewTab, Empty }: GroupProps) {
  const workbench = useWorkbench();
  const group = useLayout((layout) => layout.groups[index]);
  const groups = useLayout((layout) => layout.groups.length);

  if (!group) return null;

  const shown = group.tabs.find((tab) => keyOf(tab) === group.active);
  const kind = shown && workbench.tabKind(shown.kind);

  return (
    <section className="flex min-w-0 flex-1 flex-col" onPointerDownCapture={() => workbench.focusGroup(index)}>
      <div className="flex h-11 shrink-0 items-center gap-1 px-3">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {group.tabs.map((tab) => (
            <Tab key={keyOf(tab)} tab={tab} active={keyOf(tab) === group.active} preview={keyOf(tab) === group.preview} />
          ))}
        </div>
        {onNewTab && (
          <IconButton label="New thread" onClick={onNewTab}>
            <Plus />
          </IconButton>
        )}
        <div className="flex-1" />
        {shown && (groups > 1 || group.tabs.length > 1) && (
          <IconButton label="Split" onClick={() => workbench.split(keyOf(shown))}>
            <Columns2 />
          </IconButton>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {shown && kind ? (
          <TabContext.Provider value={keyOf(shown)}>
            <div key={keyOf(shown)} className="h-full animate-fade">
              <kind.Content id={shown.id} />
            </div>
          </TabContext.Provider>
        ) : (
          Empty && <Empty />
        )}
      </div>
    </section>
  );
}

function Tab({ tab, active, preview }: { tab: TabRef; active: boolean; preview: boolean }) {
  const workbench = useWorkbench();
  const kind = workbench.tabKind(tab.kind);
  if (!kind) return null;

  const key = keyOf(tab);
  const { Title, Mark } = kind;

  return (
    <div
      className={classNames(
        'group relative flex h-7 max-w-56 min-w-0 shrink-0 items-center rounded-lg',
        active ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink',
      )}
    >
      <button
        type="button"
        onClick={() => workbench.open(tab, { preview })}
        onDoubleClick={() => workbench.pin(key)}
        onAuxClick={(event) => event.button === 1 && workbench.close(key)}
        className="flex h-full min-w-0 cursor-default items-center gap-2 pr-2.5 pl-2.5 group-hover:pr-7"
      >
        {Mark && <Mark id={tab.id} />}
        <span className={classNames('min-w-0 truncate', preview && 'italic')}>
          <Title id={tab.id} />
        </span>
      </button>
      <button
        type="button"
        aria-label="Close"
        title="Close"
        onClick={() => workbench.close(key)}
        className="absolute right-1 hidden size-5 cursor-default items-center justify-center rounded-md text-muted group-hover:flex hover:bg-shade hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
