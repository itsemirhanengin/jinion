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

/** A row of tabs and the one shown; the middle holds one or two of them side by side. */
export function Group({ index, onNewTab, Empty }: GroupProps) {
  const workbench = useWorkbench();
  const group = useLayout((layout) => layout.groups[index]);
  const focused = useLayout((layout) => layout.focused === index);
  const groups = useLayout((layout) => layout.groups.length);

  if (!group) return null;

  const shown = group.tabs.find((tab) => keyOf(tab) === group.active);
  const kind = shown && workbench.tabKind(shown.kind);

  return (
    <section className="flex min-w-0 flex-1 flex-col" onPointerDownCapture={() => workbench.focusGroup(index)}>
      <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-raised">
        <div className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]">
          {group.tabs.map((tab) => (
            <Tab key={keyOf(tab)} tab={tab} active={keyOf(tab) === group.active} preview={keyOf(tab) === group.preview} focused={focused} />
          ))}
        </div>
        {onNewTab && (
          <div className="flex shrink-0 items-center px-1.5">
            <IconButton label="New tab" onClick={onNewTab}>
              <Plus />
            </IconButton>
          </div>
        )}
        <div className="flex-1" />
        {shown && (groups > 1 || group.tabs.length > 1) && (
          <div className="flex shrink-0 items-center px-1.5">
            <IconButton label="Split" onClick={() => workbench.split(keyOf(shown))}>
              <Columns2 />
            </IconButton>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
        {shown && kind ? (
          <TabContext.Provider value={keyOf(shown)}>
            <kind.Content key={keyOf(shown)} id={shown.id} />
          </TabContext.Provider>
        ) : (
          Empty && <Empty />
        )}
      </div>
    </section>
  );
}

function Tab({ tab, active, preview, focused }: { tab: TabRef; active: boolean; preview: boolean; focused: boolean }) {
  const workbench = useWorkbench();
  const kind = workbench.tabKind(tab.kind);
  if (!kind) return null;

  const key = keyOf(tab);
  const { Title, Mark } = kind;

  return (
    <div
      className={classNames(
        'group relative flex max-w-56 min-w-0 shrink-0 items-center border-r border-line transition-colors duration-120',
        active ? 'bg-background text-ink' : 'hover-shade text-muted hover:text-ink',
      )}
    >
      {active && focused && <span className="absolute inset-x-0 top-0 h-px bg-accent" />}
      {active && <span className="absolute inset-x-0 -bottom-px h-px bg-background" />}
      <button
        type="button"
        onClick={() => workbench.open(tab, { preview })}
        onDoubleClick={() => workbench.pin(key)}
        onAuxClick={(event) => event.button === 1 && workbench.close(key)}
        className="flex h-full min-w-0 cursor-default items-center gap-2 pr-1 pl-3"
      >
        {Mark && <Mark id={tab.id} />}
        <span className={classNames('min-w-0 truncate', preview && 'italic')}>
          <Title id={tab.id} />
        </span>
      </button>
      <span className={classNames('pr-1.5', !active && 'opacity-0 group-hover:opacity-100')}>
        <IconButton label="Close" onClick={() => workbench.close(key)}>
          <X />
        </IconButton>
      </span>
    </div>
  );
}
