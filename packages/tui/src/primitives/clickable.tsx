import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Box, type DOMElement } from 'ink';
import { useClick } from '../runtime/click.js';
import { useTheme } from '../runtime/context.js';
import { hoverColor } from '../theme/themes.js';
import { useHoveredItem, useScrollArea } from './scroll-view.js';

export interface ClickableProps {
  /** Unique in the scroll view it is in, which tracks what the pointer is over by it. */
  id: string;
  onClick(): void;
  /** As wide as its content, so a line lights up only as far as its text goes, rather than the full width. */
  fit?: boolean;
  children: ReactNode;
}

const HoveredContext = createContext(false);

/** Whether the pointer is over the clickable thing around this component, for text to stand out while it is. */
export const useHovered = () => useContext(HoveredContext);

/** Something a click does something with. In a scroll view it lights up while the pointer is over it, as a button does. */
export function Clickable({ id, onClick, fit = false, children }: ClickableProps) {
  const theme = useTheme();
  const ref = useRef<DOMElement>(null);
  const area = useScrollArea();
  const hovered = useHoveredItem() === id;

  useEffect(() => area?.hoverable(id, ref), [area, id]);
  useClick(ref, onClick, { clip: area?.viewport });

  return (
    <Box
      ref={ref}
      flexDirection="column"
      alignSelf={fit ? 'flex-start' : undefined}
      backgroundColor={hovered ? hoverColor(theme) : undefined}
    >
      <HoveredContext.Provider value={hovered}>{children}</HoveredContext.Provider>
    </Box>
  );
}
