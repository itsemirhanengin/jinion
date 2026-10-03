import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, useWindowSize } from 'ink';
import { darkTheme, type Theme } from '../theme/themes.js';
import type { MouseListener } from './input.js';
import { PanelsProvider } from './panels.js';
import { createTerminalControl, type TerminalControl } from './terminal.js';

interface View {
  /** Whether long output is shown in full: everywhere after ctrl+o, or in one item opened on its own. */
  expanded: boolean;
  /** ctrl+o: opens or closes everything, and forgets the items opened or closed on their own. */
  toggleExpanded(): void;
  /** Items opened or closed on their own, by id. Kept here rather than in the items, which unmount out of view. */
  items: ReadonlyMap<string, boolean>;
  setItem(id: string, expanded: boolean): void;
}

const ThemeContext = createContext<Theme>(darkTheme);
const WidthContext = createContext<number>(80);
const ViewContext = createContext<View>({ expanded: false, toggleExpanded: () => {}, items: new Map(), setItem: () => {} });
const MouseContext = createContext<Set<MouseListener>>(new Set());
/** Outside `run()` nothing reaches a terminal. */
const NO_TERMINAL = createTerminalControl(() => {}, 'bell').control;
const TerminalContext = createContext<TerminalControl>(NO_TERMINAL);

export const useTheme = () => useContext(ThemeContext);

/** Whether the terminal window has focus, and desktop notifications. */
export const useTerminal = () => useContext(TerminalContext);

/** Columns available to the current component, accounting for enclosing frames and indents. */
export const useContentWidth = () => useContext(WidthContext);

export const useView = () => useContext(ViewContext);

/** Gives what is inside `id` its own `expanded`: as set for it when it was opened or closed on its own, else ctrl+o's. */
export function ViewItem({ id, children }: { id: string; children: ReactNode }) {
  const view = useView();
  const own = view.items.get(id);
  const scoped = useMemo(() => (own === undefined ? view : { ...view, expanded: own }), [view, own]);
  return <ViewContext.Provider value={scoped}>{children}</ViewContext.Provider>;
}

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
  terminal?: TerminalControl;
  children: ReactNode;
}

/** Provides theme, width, view state, mouse events, the terminal and panels, and fills the whole terminal. */
export function Root({ theme, mouse, terminal, children }: RootProps) {
  const { columns, rows } = useWindowSize();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ReadonlyMap<string, boolean>>(new Map());
  const toggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
    setItems(new Map());
  }, []);
  const setItem = useCallback((id: string, value: boolean) => setItems((current) => new Map(current).set(id, value)), []);
  const view = useMemo(() => ({ expanded, toggleExpanded, items, setItem }), [expanded, toggleExpanded, items, setItem]);
  const listeners = useMemo(() => mouse ?? new Set<MouseListener>(), [mouse]);

  return (
    <ThemeContext.Provider value={theme}>
      <WidthContext.Provider value={columns}>
        <ViewContext.Provider value={view}>
          <MouseContext.Provider value={listeners}>
            <TerminalContext.Provider value={terminal ?? NO_TERMINAL}>
              <PanelsProvider>
                <Box flexDirection="column" width={columns} height={rows}>
                  {children}
                </Box>
              </PanelsProvider>
            </TerminalContext.Provider>
          </MouseContext.Provider>
        </ViewContext.Provider>
      </WidthContext.Provider>
    </ThemeContext.Provider>
  );
}
