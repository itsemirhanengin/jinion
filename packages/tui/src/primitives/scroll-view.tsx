import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Text, useBoxMetrics, useInput, type DOMElement } from 'ink';
import { useMouse, useTheme } from '../runtime/context.js';

export interface ScrollViewProps {
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
 * Follows the newest line until the user scrolls up with the wheel or
 * PageUp; from then on the view stays put while content grows below it, and
 * a "Jump to bottom" row brings it back.
 */
export function ScrollView({ children, wheelStep = 3 }: ScrollViewProps) {
  const theme = useTheme();
  const viewportRef = useRef<DOMElement>(null);
  const contentRef = useRef<DOMElement>(null);
  const jumpRef = useRef<DOMElement>(null);
  const viewport = useBoxMetrics(viewportRef);
  const content = useBoxMetrics(contentRef);
  // `undefined` pins the view to the bottom; a number is the first visible line.
  const [top, setTop] = useState<number>();
  const maxTop = Math.max(0, content.height - viewport.height);
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
    const page = Math.max(1, viewport.height - 2);
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
        justifyContent={pinned && maxTop > 0 ? 'flex-end' : 'flex-start'}
      >
        <Box ref={contentRef} flexDirection="column" flexShrink={0} marginTop={pinned ? 0 : -top}>
          {children}
        </Box>
      </Box>
      {!pinned && (
        <Box ref={jumpRef} flexShrink={0} justifyContent="center">
          <Text color={theme.muted}>Jump to bottom (click) ↓</Text>
        </Box>
      )}
    </Box>
  );
}
