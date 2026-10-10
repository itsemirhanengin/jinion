import { type ItemKey, Virtualizer } from '@jinion/virtualization/virtualizer';
import { type ReactNode, type Ref, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { OverlayScrollbar } from './overlay-scrollbar.js';

export interface VirtualListHandle {
  /** Scrolls to the item, drawn or not. */
  scrollTo(key: string): void;
  /** Glides to the end and follows it again. */
  scrollToEnd(): void;
}

export interface VirtualListProps<Item> {
  items: readonly Item[];
  keyOf: (item: Item) => string;
  /** How tall an item likely is before it is drawn, in pixels; the closer, the steadier the scrollbar. */
  estimate: (item: Item) => number;
  children: (item: Item, index: number) => ReactNode;
  /**
   * Keeps the end in view as the list grows, as a conversation follows its newest message: only the user's own scrolling
   * up lets go, and coming back down to the end follows again.
   */
  follow?: boolean;
  /** Told when the user has scrolled up from the end and away from it, so a way back can show. */
  onAway?: (away: boolean) => void;
  /** Room under each item, in pixels. */
  gap?: number;
  /** The scrolling box's classes. */
  className?: string;
  /** The classes of the column inside it, which holds the header, the items and the footer. */
  innerClassName?: string;
  /** Before and after the items, scrolled with them, as a heading, or the room a floating composer takes. */
  header?: ReactNode;
  footer?: ReactNode;
  handle?: Ref<VirtualListHandle>;
}

/** Before an item is measured, without an estimate of its own. */
const FALLBACK = 48;

/** How close to the end still counts as there, in pixels. */
const END = 24;

/**
 * A long list that mounts only what is in view and a screen's worth around it, however many items it has. What is
 * drawn is measured, and a height that changes above the view moves the scroll by as much, so what is in view stays put.
 */
export function VirtualList<Item>({
  items,
  keyOf,
  estimate,
  children,
  follow,
  onAway,
  gap = 0,
  className,
  innerClassName,
  header,
  footer,
  handle,
}: VirtualListProps<Item>) {
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const estimates = useRef(new Map<ItemKey, number>());
  const nodes = useRef(new Map<ItemKey, HTMLElement>());
  const refs = useRef(new Map<ItemKey, (node: HTMLDivElement | null) => () => void>());
  const keys = useRef<ItemKey[]>([]);
  const lastTop = useRef(0);

  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const [view, setView] = useState({ height: 0, top: 0 });
  const [following, setFollowing] = useState(Boolean(follow));
  const [virtualizer] = useState(() => new Virtualizer({ estimate: (key) => estimates.current.get(key) ?? FALLBACK }));

  const [observer] = useState(() =>
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          const box = scroller.current;

          if (box && entries.some((entry) => entry.target === box)) setView({ height: box.clientHeight, top: box.scrollTop });
          redraw();
        }),
  );

  const byKey = new Map(items.map((item) => [keyOf(item), item]));

  for (const [key, item] of byKey) estimates.current.set(key, estimate(item) + gap);
  keys.current = [...byKey.keys()];

  // The window is counted from the first item, under whatever header scrolls above it.
  const above = list.current?.offsetTop ?? 0;
  const range = virtualizer.window(keys.current, { height: view.height || 1000, top: follow && following ? undefined : Math.max(0, view.top - above) });
  const drawn = useRef(range);

  drawn.current = range;

  useImperativeHandle(handle, () => ({
    scrollTo: (key) => {
      const box = scroller.current;
      if (!box) return;

      setFollowing(false);
      box.scrollTop = (list.current?.offsetTop ?? 0) + virtualizer.startOf(keys.current, key);
    },
    scrollToEnd: () => {
      setFollowing(true);
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
    },
  }));

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;

    const measured = new Map([...nodes.current].map(([key, node]) => [key, node.offsetHeight]));
    const { changed, shift } = virtualizer.measure(drawn.current, measured, box.clientWidth);

    if (follow && following) box.scrollTop = box.scrollHeight;
    else if (shift !== 0) box.scrollTop += shift;

    if (changed) redraw();
  });

  // The box once, for its height; the items as they mount, for theirs.
  useLayoutEffect(() => {
    if (scroller.current) observer?.observe(scroller.current);

    return () => observer?.disconnect();
  }, [observer]);

  // One ref for each key across draws, so an item that stays isn't watched again, which would draw it again.
  const refOf = (key: ItemKey) => {
    let ref = refs.current.get(key);

    if (!ref) {
      ref = (node) => {
        if (node) {
          nodes.current.set(key, node);
          observer?.observe(node);
        }

        return () => {
          nodes.current.delete(key);
          refs.current.delete(key);
          if (node) observer?.unobserve(node);
        };
      };

      refs.current.set(key, ref);
    }

    return ref;
  };

  const scrolled = () => {
    const box = scroller.current;
    if (!box) return;

    const top = box.scrollTop;
    const atEnd = box.scrollHeight - top - box.clientHeight < END;
    const still = Boolean(follow) && !(top < lastTop.current - 1) && (following || atEnd);

    lastTop.current = top;
    setView({ height: box.clientHeight, top });

    if (!follow) return;

    setFollowing(still);
    onAway?.(!still && !atEnd);
  };

  return (
    // The scrollbar is drawn over the edge, so the items keep their width whether the list scrolls or not.
    <div className={classNames('relative', className)}>
      <div ref={scroller} onScroll={scrolled} className="h-full overflow-y-auto [overflow-anchor:none] [scrollbar-width:none]">
        <div className={innerClassName}>
          {header}
          <div ref={list}>
            {range.before > 0 && <div style={{ height: range.before }} />}
            {range.slots.map((slot) => (
              <div key={slot.key} ref={refOf(slot.key)} style={gap ? { paddingBottom: gap } : undefined}>
                {children(byKey.get(slot.key as string)!, slot.index)}
              </div>
            ))}
            {range.after > 0 && <div style={{ height: range.after }} />}
          </div>
          {footer}
        </div>
      </div>
      <OverlayScrollbar target={scroller} />
    </div>
  );
}
