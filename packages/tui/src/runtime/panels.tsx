import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Box } from 'ink';

/**
 * Where an open panel goes. `bottom` takes the prompt's place and keeps the
 * conversation and status line visible; `fullscreen` takes the whole screen.
 */
export type PanelPlacement = 'bottom' | 'fullscreen';

export interface PanelSpec {
  /** Opening a panel with an id that is already open replaces it. */
  id: string;
  placement: PanelPlacement;
  element: ReactNode;
}

export interface Panels {
  stack: PanelSpec[];
  top: PanelSpec | undefined;
  open(panel: PanelSpec): void;
  /** Closes the panel with this id, or the top one. */
  close(id?: string): void;
}

const PanelsContext = createContext<Panels>({ stack: [], top: undefined, open: () => {}, close: () => {} });
const CurrentPanelContext = createContext<{ id: string; close(): void } | undefined>(undefined);

export function PanelsProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PanelSpec[]>([]);

  const open = useCallback((panel: PanelSpec) => {
    setStack((current) => [...current.filter((item) => item.id !== panel.id), panel]);
  }, []);
  const close = useCallback((id?: string) => {
    setStack((current) => (id === undefined ? current.slice(0, -1) : current.filter((item) => item.id !== id)));
  }, []);

  const panels = useMemo(() => ({ stack, top: stack.at(-1), open, close }), [stack, open, close]);
  return <PanelsContext.Provider value={panels}>{children}</PanelsContext.Provider>;
}

/** Opens and closes panels from anywhere: commands, key handlers, the agent. */
export const usePanels = () => useContext(PanelsContext);

/** The panel the calling component was opened in. */
export function usePanel() {
  const panel = useContext(CurrentPanelContext);
  if (!panel) throw new Error('usePanel() must be called inside an open panel.');
  return panel;
}

function PanelOutlet({ panel }: { panel: PanelSpec }) {
  const { close } = usePanels();
  const current = useMemo(() => ({ id: panel.id, close: () => close(panel.id) }), [panel.id, close]);
  return <CurrentPanelContext.Provider value={current}>{panel.element}</CurrentPanelContext.Provider>;
}

export interface ShellProps {
  /** The main area, usually a `ScrollView` with the conversation. */
  content: ReactNode;
  /** Pinned above the prompt, e.g. activity and the todo panel. */
  aside?: ReactNode;
  prompt: ReactNode;
  status?: ReactNode;
}

/** The screen layout: content on top, then aside, prompt and status pinned to the bottom. Hosts open panels. */
export function Shell({ content, aside, prompt, status }: ShellProps) {
  const { top } = usePanels();

  if (top?.placement === 'fullscreen') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <PanelOutlet key={top.id} panel={top} />
      </Box>
    );
  }

  return (
    <>
      {content}
      <Box flexDirection="column" flexShrink={0}>
        {aside}
        <Box marginTop={1} flexDirection="column">
          {top ? <PanelOutlet key={top.id} panel={top} /> : prompt}
        </Box>
        {status}
      </Box>
    </>
  );
}
