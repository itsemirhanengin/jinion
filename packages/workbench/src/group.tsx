import { classNames, FadeText } from '@jinion/ui';
import { Plus, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { TabContext, useLayout, useWorkbench } from './context.js';
import { IconButton } from './icon-button.js';
import { keyOf, type TabRef } from './layout.js';
import { DropCaret, DropPreview, useTabDrag } from './tab-drag.js';

export interface GroupProps {
  index: number;
  onNewTab?: () => void;
  newTabLabel?: string;
  Empty?: ComponentType;
}

/** A row of tabs and the one shown; the sheet holds one or two of them, beside or above each other. */
export function Group({ index, onNewTab, newTabLabel = 'New tab', Empty }: GroupProps) {
  const workbench = useWorkbench();
  const group = useLayout((layout) => layout.groups[index]);

  if (!group) return null;

  const shown = group.tabs.find((tab) => keyOf(tab) === group.active);
  const kind = shown && workbench.tabKind(shown.kind);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" onPointerDownCapture={() => workbench.focusGroup(index)}>
      <div data-drop-tabs data-group={index} className="flex h-11 shrink-0 items-center gap-1 px-3">
        <div className="relative flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {group.tabs.map((tab) => (
            <Tab key={keyOf(tab)} tab={tab} group={index} active={keyOf(tab) === group.active} preview={keyOf(tab) === group.preview} />
          ))}
          <DropCaret group={index} />
        </div>
        {onNewTab && (
          <IconButton label={newTabLabel} onClick={onNewTab}>
            <Plus />
          </IconButton>
        )}
      </div>
      <div data-drop-content data-group={index} className="relative min-h-0 flex-1">
        <DropPreview group={index} />
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

function Tab({ tab, group, active, preview }: { tab: TabRef; group: number; active: boolean; preview: boolean }) {
  const workbench = useWorkbench();
  const { drag, start, dragged } = useTabDrag();
  const kind = workbench.tabKind(tab.kind);
  if (!kind) return null;

  const key = keyOf(tab);
  const { Title, Mark } = kind;

  return (
    <div
      data-tab-key={key}
      onPointerDown={(event) => start(event, key, group)}
      className={classNames(
        'group flex h-7 w-44 min-w-24 shrink items-center rounded-lg pr-1 transition-opacity duration-150',
        active ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink',
        drag?.key === key && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (!dragged()) workbench.open(tab, { preview });
        }}
        onDoubleClick={() => workbench.pin(key)}
        onAuxClick={(event) => event.button === 1 && workbench.close(key)}
        className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 pr-1 pl-2.5"
      >
        {Mark && <Mark id={tab.id} />}
        <FadeText className={classNames(preview && 'italic')}>
          <Title id={tab.id} />
        </FadeText>
      </button>
      <button
        type="button"
        aria-label="Close"
        title="Close"
        data-tab-close
        onClick={() => workbench.close(key)}
        className={classNames(
          'flex size-5 shrink-0 cursor-default items-center justify-center rounded-md text-muted hover:bg-shade hover:text-ink focus-visible:opacity-100',
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
