import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Box, measureElement, Text, useInput, type DOMElement } from 'ink';
import { useVirtual } from '@jinion/virtualization';
import { contains, screenRect } from '../runtime/click.js';
import { useMouse } from '../runtime/mouse.js';
import { useTerminal } from '../runtime/terminal.js';
import { useTheme } from '../runtime/theme.js';
import { hoverColor } from '../theme/themes.js';
import { Hover, useHoveredId, useIsHovered } from './hover.js';

export interface ScrollViewProps {
  children?: ReactNode;
  wheelStep?: number;
}

interface ScrollArea {
  viewport: RefObject<DOMElement | null>;
  /** Before a click changes an item's height: following the bottom would move it from under the pointer. */
  hold(): void;
  hoverable(id: string, ref: RefObject<DOMElement | null>): () => void;
  hover: Hover;
}

const ScrollAreaContext = createContext<ScrollArea | undefined>(undefined);

export const useScrollArea = () => useContext(ScrollAreaContext);

export const useHoveredItem = () => useHoveredId(useScrollArea()?.hover);

const JUMP = '\0jump';

export function ScrollView({ children, wheelStep = 3 }: ScrollViewProps) {
  const terminal = useTerminal();
  const viewportRef = useRef<DOMElement>(null);
  const jumpRef = useRef<DOMElement>(null);
  // `undefined` pins the view to the bottom; a number is the first visible line.
  const [top, setTop] = useState<number>();
  const virtual = useVirtual(children, {
    viewport: viewportRef,
    top,
    onShift: (rows) => setTop((current) => (current === undefined ? current : Math.max(0, current + rows))),
  });
  const { height, maxTop, contentRef } = virtual;
  const latestMaxTop = useRef(maxTop);
  latestMaxTop.current = maxTop;
  const latestTop = useRef(top);
  latestTop.current = top;
  // Until the items are measured again, `maxTop` still says the view is at the bottom, which would pin it again.
  const held = useRef<{ top: number; rows: number; measured?: boolean }>(undefined);

  const scrollBy = (delta: number) => {
    held.current = undefined;
    setTop((current) => {
      const limit = latestMaxTop.current;
      const next = Math.min(limit, Math.max(0, (current ?? limit) + delta));
      return next >= limit ? undefined : next;
    });
  };

  // Laid out after the click: if nothing grew there is nothing to keep in place, and the view follows the bottom again.
  useLayoutEffect(() => {
    const hold = held.current;
    if (!hold || hold.measured || !contentRef.current) return;
    hold.measured = true;
    if (measureElement(contentRef.current).height <= hold.rows) {
      held.current = undefined;
      setTop(undefined);
    }
  });

  useEffect(() => {
    if (held.current && maxTop <= held.current.top) return;
    held.current = undefined;
    // The jump row takes the view's last line: with only that line left below, the view is at the bottom.
    if (top !== undefined && top >= maxTop - 1) setTop(undefined);
  }, [top, maxTop]);

  const pointer = useRef<{ x: number; y: number }>(undefined);
  const hoverables = useRef(new Map<string, RefObject<DOMElement | null>>([[JUMP, jumpRef]]));
  const [hover] = useState(() => new Hover());
  const underPointer = () => {
    const at = pointer.current;
    if (!at) return undefined;
    if (jumpRef.current && contains(screenRect(jumpRef.current), at.x, at.y)) return JUMP;
    if (!viewportRef.current || !contains(screenRect(viewportRef.current), at.x, at.y)) return undefined;
    for (const [id, ref] of hoverables.current) {
      if (id !== JUMP && ref.current && contains(screenRect(ref.current), at.x, at.y)) return id;
    }
    return undefined;
  };

  // Items move under a still pointer as the view scrolls or they grow; what is under it now is hovered.
  useLayoutEffect(() => hover.set(underPointer()));

  useEffect(() => hover.subscribe(() => terminal.pointer(hover.current() ? 'pointer' : 'default')), [hover, terminal]);
  useEffect(() => () => terminal.pointer('default'), [terminal]);

  useMouse((event) => {
    pointer.current = { x: event.x, y: event.y };
    if (event.type === 'move') hover.set(underPointer());
    else if (event.type === 'wheel') scrollBy(event.direction === 'up' ? -wheelStep : wheelStep);
    else if (event.type === 'press' && jumpRef.current && event.y === screenRect(jumpRef.current).y) setTop(undefined);
  });

  const area = useMemo<ScrollArea>(
    () => ({
      viewport: viewportRef,
      hold: () => {
        if (latestTop.current !== undefined || !contentRef.current) return;
        held.current = { top: latestMaxTop.current, rows: measureElement(contentRef.current).height };
        setTop(latestMaxTop.current);
      },
      hoverable: (id, ref) => {
        hoverables.current.set(id, ref);
        return () => void hoverables.current.delete(id);
      },
      hover,
    }),
    [contentRef, hover],
  );

  useInput((_, key) => {
    const page = Math.max(1, height - 2);
    if (key.pageUp) scrollBy(-page);
    else if (key.pageDown) scrollBy(page);
  });

  const pinned = top === undefined;

  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0}>
      <ScrollAreaContext.Provider value={area}>
        <Box
          ref={viewportRef}
          flexDirection="column"
          flexGrow={1}
          flexBasis={0}
          overflow="hidden"
          justifyContent={pinned && virtual.total > height ? 'flex-end' : 'flex-start'}
        >
          <Box ref={contentRef} flexDirection="column" flexShrink={0} marginTop={pinned ? 0 : -virtual.first}>
            {virtual.content}
          </Box>
          {virtual.offscreen}
        </Box>
      </ScrollAreaContext.Provider>
      {!pinned && <JumpRow rowRef={jumpRef} hover={hover} />}
    </Box>
  );
}

function JumpRow({ rowRef, hover }: { rowRef: RefObject<DOMElement | null>; hover: Hover }) {
  const theme = useTheme();
  const hovered = useIsHovered(hover, JUMP);
  return (
    <Box ref={rowRef} flexShrink={0} justifyContent="center">
      <Text color={hovered ? undefined : theme.muted} backgroundColor={hovered ? hoverColor(theme) : undefined}>
        Jump to bottom (click) ↓
      </Text>
    </Box>
  );
}
