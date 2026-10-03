import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Box, type DOMElement } from 'ink';
import { useClick } from '../runtime/click.js';
import { useTheme } from '../runtime/theme.js';
import { hoverColor } from '../theme/themes.js';
import { useIsHovered } from './hover.js';
import { useScrollArea } from './scroll-view.js';

export interface ClickableProps {
  /** Unique within its scroll view. */
  id: string;
  onClick(): void;
  fit?: boolean;
  children: ReactNode;
}

const PointerOverContext = createContext(false);

export const useHovered = () => useContext(PointerOverContext);

export function Clickable({ id, onClick, fit = false, children }: ClickableProps) {
  const theme = useTheme();
  const area = useScrollArea();
  const hovered = useIsHovered(area?.hover, id);

  const ref = useRef<DOMElement>(null);

  useEffect(() => area?.hoverable(id, ref), [area, id]);
  useClick(ref, onClick, { clip: area?.viewport });

  return (
    <Box
      ref={ref}
      flexDirection="column"
      alignSelf={fit ? 'flex-start' : undefined}
      backgroundColor={hovered ? hoverColor(theme) : undefined}
    >
      <PointerOverContext.Provider value={hovered}>{children}</PointerOverContext.Provider>
    </Box>
  );
}
