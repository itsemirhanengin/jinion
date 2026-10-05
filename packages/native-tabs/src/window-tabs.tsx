import { classNames } from '@jinion/ui';
import { Plus, X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useRef } from 'react';

export interface WindowTab {
  id: string;
  title: string;
  /** After the title: a dot for a project with a thread that waits. */
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
    const target = event.currentTarget;
    let index = from;

    dragged.current = false;
    target.setPointerCapture(event.pointerId);

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
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  return (
    <div
      style={{ paddingLeft: inset }}
      className="flex h-10 shrink-0 items-stretch border-b border-line bg-raised bg-linear-to-b from-(--shade) to-(--shade) [-webkit-app-region:drag]"
    >
      <div ref={row} className="flex min-w-0 items-stretch [-webkit-app-region:no-drag]">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            onPointerDown={(event) => pointerDown(event, index)}
            className={classNames(
              'group relative flex w-56 min-w-28 shrink items-center border-r border-line transition-colors duration-120 first:border-l',
              tab.id === active ? 'bg-raised text-ink' : 'hover-shade text-muted hover:text-ink',
            )}
          >
            {tab.id === active && <span className="absolute inset-x-0 -bottom-px h-px bg-raised" />}
            {onClose && (
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                onClick={() => onClose(tab.id)}
                className="hover-shade absolute left-1.5 flex size-5 cursor-default items-center justify-center rounded-full text-muted opacity-0 transition-opacity duration-120 group-hover:opacity-100 hover:text-ink [&_svg]:size-3"
              >
                <X />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!dragged.current) onSelect(tab.id);
              }}
              className="flex h-full min-w-0 flex-1 cursor-default items-center justify-center gap-1.5 px-7"
            >
              <span className="min-w-0 truncate">{tab.title}</span>
              {tab.mark}
            </button>
          </div>
        ))}
      </div>
      {onNew && (
        <div className="flex shrink-0 items-center px-1.5 [-webkit-app-region:no-drag]">
          <button
            type="button"
            aria-label="New tab"
            title="New tab"
            onClick={onNew}
            className="hover-shade flex size-6 cursor-default items-center justify-center rounded-full text-muted transition-colors duration-120 hover:text-ink [&_svg]:size-3.5"
          >
            <Plus />
          </button>
        </div>
      )}
      <div className="flex-1" />
      {trailing && <div className="flex shrink-0 items-center px-2 [-webkit-app-region:no-drag]">{trailing}</div>}
    </div>
  );
}
