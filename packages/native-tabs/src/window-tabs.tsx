import { classNames } from '@jinion/ui';
import { Plus, X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useRef } from 'react';

export interface WindowTab {
  id: string;
  title: string;
  /** After the title, dimmed, such as the branch. */
  detail?: string;
  /** Before the title: a project's thread at work, or one waiting. */
  mark?: ReactNode;
}

export interface WindowTabsProps {
  tabs: WindowTab[];
  active?: string;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
  onMove?: (from: number, to: number) => void;
  /** Room at the left for the window's own buttons, as macOS's traffic lights. */
  inset?: number;
  trailing?: ReactNode;
}

const DRAG_DISTANCE = 4;

/** The title bar as a row of tabs, one per window's content, which drag to reorder as macOS's do. */
export function WindowTabs({ tabs, active, onSelect, onClose, onNew, onMove, inset = 0, trailing }: WindowTabsProps) {
  const row = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  const pointerDown = (event: PointerEvent<HTMLDivElement>, from: number) => {
    if (!onMove || event.button !== 0) return;

    const start = event.clientX;
    let index = from;

    dragged.current = false;

    // Followed on the window rather than captured: a capture would send the click to the tab's box, not its button.
    const move = (moved: globalThis.PointerEvent) => {
      if (Math.abs(moved.clientX - start) < DRAG_DISTANCE && !dragged.current) return;

      dragged.current = true;

      const boxes = [...(row.current?.children ?? [])].map((child) => child.getBoundingClientRect());
      const over = boxes.findIndex((box) => moved.clientX < box.left + box.width / 2);
      const to = over < 0 ? boxes.length - 1 : over > index ? over - 1 : over;

      if (to !== index) {
        onMove(index, to);
        index = to;
      }
    };

    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
    };

    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  return (
    <div style={{ paddingLeft: inset }} className="flex h-11 shrink-0 items-center gap-1 bg-chrome pr-3 [-webkit-app-region:drag]">
      {/* A row that scrolls sideways clips up and down too, so it leaves room for the shown tab's ring and shadow. */}
      <div ref={row} className="flex min-w-0 items-center gap-1 overflow-x-auto px-0.5 py-1.5 [scrollbar-width:none] [-webkit-app-region:no-drag]">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            onPointerDown={(event) => pointerDown(event, index)}
            className={classNames(
              'group relative flex h-7 w-44 min-w-24 shrink items-center rounded-lg',
              tab.id === active ? 'bg-floating text-ink shadow-xs ring-1 ring-edge' : 'text-muted hover:bg-shade hover:text-ink',
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (!dragged.current) onSelect(tab.id);
              }}
              className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 px-2.5 group-hover:pr-7"
            >
              {tab.mark}
              <span className="min-w-0 truncate">{tab.title}</span>
              {tab.detail && <span className="min-w-0 truncate text-faint">{tab.detail}</span>}
            </button>
            {onClose && (
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                title="Close"
                onClick={() => onClose(tab.id)}
                className="absolute right-1 hidden size-5 cursor-default items-center justify-center rounded-md text-muted group-hover:flex hover:bg-shade hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {onNew && (
        <button
          type="button"
          aria-label="Open a project"
          title="Open a project"
          onClick={onNew}
          className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg text-muted hover:bg-shade hover:text-ink [-webkit-app-region:no-drag]"
        >
          <Plus className="size-4" />
        </button>
      )}
      <div className="flex-1" />
      {trailing && <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">{trailing}</div>}
    </div>
  );
}
