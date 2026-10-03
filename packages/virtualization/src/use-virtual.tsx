import {
  Children,
  isValidElement,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { Box, measureElement, useBoxMetrics, useWindowSize, type DOMElement } from 'ink';
import { Virtualizer, type ItemKey, type VirtualizerOptions } from './virtualizer.js';

export interface VirtualOptions extends VirtualizerOptions {
  /** The box the items scroll in, which clips them; its height is the view's, its width the items'. */
  viewport: RefObject<DOMElement | null>;
  /** The first row in view; `undefined` follows the newest row at the bottom. */
  top: number | undefined;
  /** The view has to move by `rows` to keep still, as items above it turned out taller or shorter. */
  onShift(rows: number): void;
}

/**
 * Mounts only the children in and around the view, for an Ink box that scrolls them. Each child is an item with a
 * stable `key`. Put `content` in a box with `contentRef`, offset by `-first` rows while scrolled, and `offscreen` in the
 * viewport after it: that is where items are laid out out of sight before they take their place.
 */
export function useVirtual(children: ReactNode, { viewport, top, onShift, ...options }: VirtualOptions) {
  const { rows } = useWindowSize();
  const view = useBoxMetrics(viewport);
  const contentRef = useRef<DOMElement>(null);
  // An item that drew again on its own, e.g. a section expanded, shows up as a new content height.
  useBoxMetrics(contentRef);
  const [virtualizer] = useState(() => new Virtualizer(options));
  const nodes = useRef(new Map<ItemKey, DOMElement>());
  const [, remeasured] = useReducer((count: number) => count + 1, 0);

  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const byKey = new Map(items.map((item) => [item.key!, item]));
  const height = view.height || rows;
  const window = virtualizer.window([...byKey.keys()], { height, top });
  const drawn = useRef(window);
  drawn.current = window;

  const mount = (key: ItemKey) => (
    <Box
      key={key}
      ref={(node: DOMElement | null) => {
        if (!node) return;
        nodes.current.set(key, node);
        return () => void nodes.current.delete(key);
      }}
      flexDirection="column"
      flexShrink={0}
    >
      {byKey.get(key as string)}
    </Box>
  );
  const pending = window.slots.filter((slot) => !slot.ready);

  // Ink has laid everything out by now, so what was mounted has its height.
  useLayoutEffect(() => {
    const width = viewport.current ? measureElement(viewport.current).width : 0;
    const measured = new Map([...nodes.current].map(([key, node]) => [key, measureElement(node).height]));
    const { changed, shift } = virtualizer.measure(drawn.current, measured, width);
    if (shift !== 0) onShift(shift);
    else if (changed) remeasured();
  });

  return {
    contentRef,
    content: (
      <>
        {window.before > 0 && <Box height={window.before} flexShrink={0} />}
        {window.slots.map((slot) =>
          slot.ready ? mount(slot.key) : <Box key={slot.key} height={slot.size} flexShrink={0} />,
        )}
        {window.after > 0 && <Box height={window.after} flexShrink={0} />}
      </>
    ),
    offscreen: pending.length > 0 && (
      // Below the view, where it is cut off: laid out at the items' width, never drawn.
      <Box position="absolute" top={height} width="100%" flexDirection="column">
        {pending.map((slot) => mount(slot.key))}
      </Box>
    ),
    /** Rows in view. */
    height,
    total: window.total,
    first: window.first,
    maxTop: window.maxTop,
  };
}
