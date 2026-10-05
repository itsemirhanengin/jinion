import { X } from 'lucide-react';
import type { PointerEvent, ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';

export interface SidePanelTab {
  id: string;
  label: string;
  /** A dot on the tab, for something new in it the user hasn't seen. */
  marked?: boolean;
}

export interface SidePanelProps {
  tabs: SidePanelTab[];
  active: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  width: number;
  onResize: (width: number) => void;
  children: ReactNode;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 960;

/** The panel on the window's right, its width dragged from its left edge. */
export function SidePanel({ tabs, active, onSelect, onClose, width, onResize, children }: SidePanelProps) {
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = width;
    const handle = event.currentTarget;

    handle.setPointerCapture(event.pointerId);

    const move = (moved: globalThis.PointerEvent) =>
      onResize(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + startX - moved.clientX)));

    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
  };

  return (
    <aside className="relative flex shrink-0 flex-col border-l border-line bg-canvas" style={{ width }}>
      <div onPointerDown={drag} className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize" />
      <div className="flex h-13 shrink-0 items-center gap-0.5 border-b border-line px-2 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={classNames(
              'relative flex h-7 cursor-default items-center rounded-md px-2.5 transition-colors',
              tab.id === active ? 'bg-hover text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.marked && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-working" />}
          </button>
        ))}
        <span className="flex-1" />
        <Button size="icon" aria-label="Close the panel" onClick={onClose} className="[&_svg]:size-3.5">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
