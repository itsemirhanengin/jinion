import { createContext, type PointerEvent, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useWorkbench } from './context.js';
import type { Side } from './layout.js';

/** Where a dragged tab would go: an edge or the middle of a group's content, or a place in its row of tabs. */
export type DropTarget = { group: number; zone: Side | 'center' } | { group: number; index: number; at: number };

interface Drag {
  key: string;
  from: number;
  title: string;
  /** Where the pointer holds the tab, so the tab stays under the hand as it moves. */
  grip: { x: number; y: number };
  width: number;
  x: number;
  y: number;
  target?: DropTarget;
}

interface TabDragValue {
  drag?: Drag;
  start: (event: PointerEvent<HTMLElement>, key: string, group: number) => void;
  /** Whether the click that ends a press was a drag, so it doesn't also pick the tab. */
  dragged: () => boolean;
}

const TabDragContext = createContext<TabDragValue | undefined>(undefined);

/** How far the pointer moves before a press on a tab becomes a drag. */
const THRESHOLD = 4;

/** How near an edge, as a share of the content's width or height, a drop splits rather than moves into the group. */
const EDGE = 0.3;

export function useTabDrag() {
  const value = useContext(TabDragContext);
  if (!value) throw new Error('useTabDrag is used outside the groups.');

  return value;
}

/** Drags tabs between and around the groups: to an edge to split, to the middle or a row of tabs to move. */
export function TabDrag({ children }: { children: ReactNode }) {
  const workbench = useWorkbench();

  const [drag, setDrag] = useState<Drag>();
  const moved = useRef(false);

  useEffect(() => {
    if (!drag) return;

    document.documentElement.classList.add('tab-dragging');

    return () => document.documentElement.classList.remove('tab-dragging');
  }, [drag !== undefined]);

  const start = (event: PointerEvent<HTMLElement>, key: string, from: number) => {
    if (event.button !== 0 || (event.target as Element).closest('[data-tab-close]')) return;

    const tab = event.currentTarget;
    const box = tab.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY };

    event.preventDefault();
    moved.current = false;

    let current: Drag | undefined;

    const move = (pointer: globalThis.PointerEvent) => {
      if (!current && Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) < THRESHOLD) return;

      const base = current ?? {
        key,
        from,
        title: tab.textContent ?? '',
        grip: { x: origin.x - box.left, y: origin.y - box.top },
        width: box.width,
        x: 0,
        y: 0,
      };

      moved.current = true;
      current = { ...base, x: pointer.clientX, y: pointer.clientY, target: targetAt(pointer.clientX, pointer.clientY, key, from) };
      setDrag(current);
    };

    const stop = (drop: boolean) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', cancel);
      setDrag(undefined);
      if (drop && current?.target) land(current.key, current.target);
    };

    const up = () => stop(true);

    const cancel = (key: KeyboardEvent) => {
      if (key.key === 'Escape') stop(false);
    };

    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('keydown', cancel);
  };

  const targetAt = (x: number, y: number, key: string, from: number): DropTarget | undefined => {
    const under = document.elementFromPoint(x, y);
    const row = under?.closest<HTMLElement>('[data-drop-tabs]');

    if (row) {
      const group = Number(row.dataset.group);
      const tabs = [...row.querySelectorAll<HTMLElement>('[data-tab-key]')];

      const after = tabs.findIndex((tab) => {
        const box = tab.getBoundingClientRect();

        return x < box.left + box.width / 2;
      });

      const index = after < 0 ? tabs.length : after;
      const edge = tabs[index] ?? tabs.at(-1);
      const at = edge ? edge.offsetLeft + (index < tabs.length ? 0 : edge.offsetWidth) : 0;

      return { group, index, at };
    }

    const content = under?.closest<HTMLElement>('[data-drop-content]');
    if (!content) return undefined;

    const group = Number(content.dataset.group);
    const layout = workbench.getLayout();
    const box = content.getBoundingClientRect();
    const sides = workbench.canSplit(key) && (layout.groups.length === 1 || group !== from);

    if (sides) {
      const distances: [Side, number][] = [
        ['left', (x - box.left) / box.width],
        ['right', (box.right - x) / box.width],
        ['top', (y - box.top) / box.height],
        ['bottom', (box.bottom - y) / box.height],
      ];

      const [side, distance] = distances.reduce((nearest, each) => (each[1] < nearest[1] ? each : nearest));

      if (distance < EDGE) return { group, zone: side };
    }

    return group === from ? undefined : { group, zone: 'center' };
  };

  const land = (key: string, target: DropTarget) => {
    if ('index' in target) workbench.moveTab(key, target.group, target.index);
    else if (target.zone === 'center') workbench.moveTab(key, target.group);
    else workbench.splitTo(key, target.zone);
  };

  return (
    <TabDragContext.Provider value={{ drag, start, dragged: () => moved.current }}>
      {children}
      {drag && (
        <div
          aria-hidden
          style={{ left: drag.x - drag.grip.x, top: drag.y - drag.grip.y, width: drag.width }}
          className="pointer-events-none fixed z-50 flex h-7 animate-enter items-center rounded-lg bg-floating px-2.5 text-ink shadow-lg ring-1 ring-edge"
        >
          <span className="min-w-0 truncate">{drag.title}</span>
        </div>
      )}
    </TabDragContext.Provider>
  );
}

const PREVIEWS: Record<Side | 'center', string> = {
  center: 'inset-2',
  left: 'top-2 bottom-2 left-2 right-1/2',
  right: 'top-2 bottom-2 left-1/2 right-2',
  top: 'top-2 left-2 right-2 bottom-1/2',
  bottom: 'top-1/2 left-2 right-2 bottom-2',
};

/** Over a group's content while a tab is dragged there: the part the tab would take, moving as the pointer does. */
export function DropPreview({ group }: { group: number }) {
  const { drag } = useTabDrag();
  const target = drag?.target;
  const zone = target && target.group === group && 'zone' in target ? target.zone : undefined;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-20 rounded-lg bg-primary/6 ring-1 ring-primary/20 transition-[top,right,bottom,left,opacity] duration-200 ease-out ${zone ? `opacity-100 ${PREVIEWS[zone]}` : `opacity-0 ${PREVIEWS.center}`}`}
    />
  );
}

/** In a row of tabs while a tab is dragged over it: a thin line where the tab would go. */
export function DropCaret({ group }: { group: number }) {
  const { drag } = useTabDrag();
  const target = drag?.target;
  if (!target || target.group !== group || !('index' in target)) return null;

  return <span aria-hidden style={{ left: target.at - 1 }} className="pointer-events-none absolute top-2 bottom-2 w-0.5 rounded-full bg-primary transition-[left] duration-100 ease-out" />;
}
