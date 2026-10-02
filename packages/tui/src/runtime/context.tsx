import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, useWindowSize } from 'ink';
import { darkTheme, type Theme } from '../theme/themes.js';
import type { MouseListener } from './input.js';
import { PanelsProvider } from './panels.js';

interface View {
  expanded: boolean;
  toggleExpanded(): void;
}

const ThemeContext = createContext<Theme>(darkTheme);
const WidthContext = createContext<number>(80);
const ViewContext = createContext<View>({ expanded: false, toggleExpanded: () => {} });
const MouseContext = createContext<Set<MouseListener>>(new Set());

export const useTheme = () => useContext(ThemeContext);

/** Columns available to the current component, accounting for enclosing frames and indents. */
export const useContentWidth = () => useContext(WidthContext);

export const useView = () => useContext(ViewContext);

export function useMouse(handler: MouseListener, { isActive = true }: { isActive?: boolean } = {}) {
  const listeners = useContext(MouseContext);
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!isActive) return;
    const listener: MouseListener = (event) => latest.current(event);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [listeners, isActive]);
}

export function Inset({ by, children }: { by: number; children: ReactNode }) {
  const width = useContentWidth();
  return <WidthContext.Provider value={Math.max(1, width - by)}>{children}</WidthContext.Provider>;
}

export interface RootProps {
  theme: Theme;
  mouse?: Set<MouseListener>;
  children: ReactNode;
}

/** Provides theme, width, view state, mouse events and panels, and fills the whole terminal. */
export function Root({ theme, mouse, children }: RootProps) {
  const { columns, rows } = useWindowSize();
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);
  const view = useMemo(() => ({ expanded, toggleExpanded }), [expanded, toggleExpanded]);
  const listeners = useMemo(() => mouse ?? new Set<MouseListener>(), [mouse]);

  return (
    <ThemeContext.Provider value={theme}>
      <WidthContext.Provider value={columns}>
        <ViewContext.Provider value={view}>
          <MouseContext.Provider value={listeners}>
            <PanelsProvider>
              <Box flexDirection="column" width={columns} height={rows}>
                {children}
              </Box>
            </PanelsProvider>
          </MouseContext.Provider>
        </ViewContext.Provider>
      </WidthContext.Provider>
    </ThemeContext.Provider>
  );
}
