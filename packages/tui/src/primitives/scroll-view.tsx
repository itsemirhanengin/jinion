import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Text, useInput, type DOMElement } from 'ink';
import { useVirtual } from '@jinion/virtualization';
import { useMouse, useTheme } from '../runtime/context.js';

export interface ScrollViewProps {
  /**
   * The items, one per child, each with a stable `key`. Only those in view and about a screen around it are mounted, so
   * a long conversation costs what a few screens of it do.
   */
  children?: ReactNode;
  /** Lines moved per wheel notch. */
  wheelStep?: number;
}

function screenRow(element: DOMElement) {
  let row = 0;
  for (let node: DOMElement | undefined = element; node; node = node.parentNode) {
    row += node.yogaNode?.getComputedTop() ?? 0;
  }
  return row;
}

/**
 * A vertically scrolling region that fills the remaining height.
 *
 * Follows the newest line until the user scrolls up with the wheel or PageUp; from then on the view stays put while
 * content grows below it, and a "Jump to bottom" row brings it back. Which children are mounted is up to
 * `@jinion/virtualization`.
 */
export function ScrollView({ children, wheelStep = 3 }: ScrollViewProps) {
  const theme = useTheme();
  const viewportRef = useRef<DOMElement>(null);
  const jumpRef = useRef<DOMElement>(null);
  // `undefined` pins the view to the bottom; a number is the first visible line.
  const [top, setTop] = useState<number>();
  const virtual = useVirtual(children, {
    viewport: viewportRef,
    top,
    onShift: (rows) => setTop((current) => (current === undefined ? current : Math.max(0, current + rows))),
  });
  const { height, maxTop } = virtual;
  const latestMaxTop = useRef(maxTop);
  latestMaxTop.current = maxTop;

  const scrollBy = (delta: number) =>
    setTop((current) => {
      const limit = latestMaxTop.current;
      const next = Math.min(limit, Math.max(0, (current ?? limit) + delta));
      return next >= limit ? undefined : next;
    });

  useEffect(() => {
    if (top !== undefined && top >= maxTop) setTop(undefined);
  }, [top, maxTop]);

  useMouse((event) => {
    if (event.type === 'wheel') scrollBy(event.direction === 'up' ? -wheelStep : wheelStep);
    else if (event.type === 'press' && jumpRef.current && event.y === screenRow(jumpRef.current)) setTop(undefined);
  });

  useInput((_, key) => {
    const page = Math.max(1, height - 2);
    if (key.pageUp) scrollBy(-page);
    else if (key.pageDown) scrollBy(page);
  });

  const pinned = top === undefined;

  return (
    <Box flexDirection="column" flexGrow={1} flexBasis={0}>
      <Box
        ref={viewportRef}
        flexDirection="column"
        flexGrow={1}
        flexBasis={0}
        overflow="hidden"
        justifyContent={pinned && virtual.total > height ? 'flex-end' : 'flex-start'}
      >
        <Box ref={virtual.contentRef} flexDirection="column" flexShrink={0} marginTop={pinned ? 0 : -virtual.first}>
          {virtual.content}
        </Box>
        {virtual.offscreen}
      </Box>
      {!pinned && (
        <Box ref={jumpRef} flexShrink={0} justifyContent="center">
          <Text color={theme.muted}>Jump to bottom (click) ↓</Text>
        </Box>
      )}
    </Box>
  );
}
