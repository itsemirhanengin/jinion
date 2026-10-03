import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box, measureElement, Text, useInput, type DOMElement } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { useWheelZone } from '../runtime/wheel.js';

export interface ScrollBoxProps {
  /** Rows it grows to before it scrolls. */
  maxHeight: number;
  /** Takes shift+up/down; the wheel scrolls it whenever the pointer is over it. */
  isActive?: boolean;
  children: ReactNode;
}

export function ScrollBox({ maxHeight, isActive = true, children }: ScrollBoxProps) {
  const theme = useTheme();

  const viewport = useRef<DOMElement>(null);
  const content = useRef<DOMElement>(null);
  const [total, setTotal] = useState(0);
  const [top, setTop] = useState(0);

  const overflowing = total > maxHeight;
  const maxTop = Math.max(0, total - maxHeight);
  const first = Math.min(top, maxTop);

  useLayoutEffect(() => {
    if (!content.current) return;

    const height = measureElement(content.current).height;

    if (height !== total) setTotal(height);
  });

  const scrollBy = (rows: number) => setTop((current) => Math.min(maxTop, Math.max(0, Math.min(current, maxTop) + rows)));

  useWheelZone(viewport, (direction) => scrollBy(direction === 'up' ? -3 : 3), { isActive: overflowing });

  useInput(
    (_, key) => {
      if (key.shift && key.upArrow) scrollBy(-1);
      else if (key.shift && key.downArrow) scrollBy(1);
    },
    { isActive: isActive && overflowing },
  );

  return (
    <Box flexDirection="column">
      <Box ref={viewport} flexDirection="column" height={overflowing ? maxHeight : undefined} overflow="hidden">
        <Box ref={content} flexDirection="column" flexShrink={0} marginTop={-first}>
          {children}
        </Box>
      </Box>
      {overflowing && (
        <Text color={theme.muted}>
          … lines {first + 1}-{first + maxHeight} of {total} · shift+up/down or the wheel scrolls
        </Text>
      )}
    </Box>
  );
}
