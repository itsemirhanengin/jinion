import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Box, type DOMElement } from 'ink';
import { useClick } from '../runtime/click.js';
import { useTheme, useView, ViewItem } from '../runtime/context.js';
import { hoverColor } from '../theme/themes.js';
import { useHoveredItem, useScrollArea } from './scroll-view.js';

export interface ExpandableProps {
  /** Stable across renders and unique in the view, so the item stays open after it scrolls out of view and back. */
  id: string;
  /** As wide as its content, so a line lights up only as far as its text goes, rather than the full width. */
  fit?: boolean;
  children: ReactNode;
}

const HoveredContext = createContext(false);

/** Whether the pointer is over the expandable item around this component, for text to stand out while it is. */
export const useHovered = () => useContext(HoveredContext);

/**
 * Something that opens and closes on its own with a click, such as a command's output: what is inside reads
 * `useView().expanded` as set for it. In a scroll view it lights up while the pointer is over it, as a button does.
 * ctrl+o still opens or closes everything at once.
 */
export function Expandable({ id, fit = false, children }: ExpandableProps) {
  const theme = useTheme();
  const ref = useRef<DOMElement>(null);
  const area = useScrollArea();
  const hovered = useHoveredItem() === id;
  const { expanded, items, setItem } = useView();
  const open = items.get(id) ?? expanded;

  useEffect(() => area?.hoverable(id, ref), [area, id]);
  useClick(
    ref,
    () => {
      area?.hold();
      setItem(id, !open);
    },
    { clip: area?.viewport },
  );

  return (
    <Box
      ref={ref}
      flexDirection="column"
      alignSelf={fit ? 'flex-start' : undefined}
      backgroundColor={hovered ? hoverColor(theme) : undefined}
    >
      <HoveredContext.Provider value={hovered}>
        <ViewItem id={id}>{children}</ViewItem>
      </HoveredContext.Provider>
    </Box>
  );
}
