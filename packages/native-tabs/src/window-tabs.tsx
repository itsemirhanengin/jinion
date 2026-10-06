import { classNames, FadeText } from '@jinion/ui';
import { X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useRef, useState } from 'react';

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
  onMove?: (from: number, to: number) => void;
  /** Room at the left for the window's own buttons, as macOS's traffic lights. */
  inset?: number;
  /** Before the tabs, such as a way home. */
  leading?: ReactNode;
  /** Right after the last tab, such as a `+` that opens one. */
  adding?: ReactNode;
  trailing?: ReactNode;
}

const DRAG_DISTANCE = 4;

/** How long a tab takes to make way for the dragged one, or to settle where it was dropped. */
const SETTLE = 180;

interface Sorting {
  from: number;
  to: number;
  /** How far the dragged tab is from its place, along the row. */
  offset: number;
  /** How far the others move to make way: the dragged tab's width and the gap after it. */
  room: number;
  /** Dropped, and gliding into its place before the order changes. */
  settling: boolean;
}

/** The title bar as a row of tabs, one per window's content, which drag along the row to reorder as macOS's do. */
export function WindowTabs({ tabs, active, onSelect, onClose, onMove, inset = 0, leading, adding, trailing }: WindowTabsProps) {
  const row = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);

  const [sorting, setSorting] = useState<Sorting>();

  const pointerDown = (event: PointerEvent<HTMLDivElement>, from: number) => {
    if (!onMove || event.button !== 0 || sorting) return;

    const start = event.clientX;
    const boxes = [...(row.current?.querySelectorAll('[data-window-tab]') ?? [])].map((tab) => tab.getBoundingClientRect());
    const own = boxes[from];
    if (!own) return;

    // The tabs share one width, so a tab's room is its width and the gap that follows it.
    const gap = boxes.length > 1 ? boxes[1]!.left - boxes[0]!.right : 0;
    const room = own.width + gap;
    const least = boxes[0]!.left - own.left;
    const most = boxes.at(-1)!.right - own.right;
    let current: Sorting | undefined;

    dragged.current = false;

    // Followed on the window rather than captured: a capture would send the click to the tab's box, not its button.
    const move = (moved: globalThis.PointerEvent) => {
      if (Math.abs(moved.clientX - start) < DRAG_DISTANCE && !dragged.current) return;

      dragged.current = true;

      const offset = Math.min(most, Math.max(least, moved.clientX - start));
      const middle = own.left + own.width / 2 + offset;
      const to = boxes.filter((box, index) => index !== from && box.left + box.width / 2 < middle).length;

      current = { from, to, offset, room, settling: false };
      setSorting(current);
    };

    const stop = (drop: boolean) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', cancel);
      if (!current) return;

      const to = drop ? current.to : from;
      const place = (to - from) * room;

      setSorting({ ...current, to, offset: place, settling: true });

      setTimeout(() => {
        if (to !== from) onMove(from, to);
        setSorting(undefined);
      }, SETTLE);
    };

    const up = () => stop(true);

    const cancel = (key: KeyboardEvent) => {
      if (key.key === 'Escape') stop(false);
    };

    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('keydown', cancel);
  };

  // The dragged tab follows the hand; those between its place and where it would go step aside by its room.
  const shift = (index: number) => {
    if (!sorting) return undefined;
    if (index === sorting.from) return sorting.offset;
    if (sorting.from < sorting.to && index > sorting.from && index <= sorting.to) return -sorting.room;
    if (sorting.to < sorting.from && index >= sorting.to && index < sorting.from) return sorting.room;

    return 0;
  };

  return (
    <div style={{ paddingLeft: inset }} className="flex h-11 shrink-0 items-center gap-1 bg-chrome pr-3 [-webkit-app-region:drag]">
      {leading && <div className="mr-1 flex shrink-0 items-center [-webkit-app-region:no-drag]">{leading}</div>}
      {/* A row that scrolls sideways clips up and down too, so it leaves room for the shown tab's ring and shadow. */}
      <div ref={row} className="flex min-w-0 items-center gap-1 overflow-x-auto py-1.5 pl-0.5 [scrollbar-width:none] [-webkit-app-region:no-drag]">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            data-window-tab
            onPointerDown={(event) => pointerDown(event, index)}
            style={sorting ? { transform: `translateX(${shift(index)}px)` } : undefined}
            className={classNames(
              'group flex h-7 w-44 min-w-24 shrink items-center rounded-lg pr-1',
              tab.id === active ? 'bg-floating text-ink shadow-xs ring-1 ring-edge' : 'text-muted hover:bg-shade hover:text-ink',
              sorting && (index !== sorting.from || sorting.settling) && 'transition-transform duration-[180ms] ease-out',
              sorting?.from === index && 'relative z-10 cursor-grabbing',
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (!dragged.current) onSelect(tab.id);
              }}
              className="flex h-full min-w-0 flex-1 cursor-default items-center gap-2 pr-1 pl-2.5"
            >
              {tab.mark}
              <FadeText>
                {tab.title}
                {tab.detail && <span className="ml-2 text-faint">{tab.detail}</span>}
              </FadeText>
            </button>
            {onClose && (
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                title="Close"
                onClick={() => onClose(tab.id)}
                className={classNames(
                  'flex size-5 shrink-0 cursor-default items-center justify-center rounded-md text-muted hover:bg-shade hover:text-ink focus-visible:opacity-100',
                  tab.id === active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {/* A scrolling row leaves its end padding out of what it scrolls, so the last tab's ring would be clipped. */}
        <span aria-hidden className="w-0.5 shrink-0 self-stretch" />
      </div>
      {adding && <div className="flex shrink-0 items-center [-webkit-app-region:no-drag]">{adding}</div>}
      <div className="flex-1" />
      {trailing && <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">{trailing}</div>}
    </div>
  );
}
