import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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

export const usePanels = () => useContext(PanelsContext);

export function usePanel() {
  const panel = useContext(CurrentPanelContext);
  if (!panel) throw new Error('usePanel() must be called inside an open panel.');

  return panel;
}

export function PanelOutlet({ panel }: { panel: PanelSpec }) {
  const { close } = usePanels();

  const current = useMemo(() => ({ id: panel.id, close: () => close(panel.id) }), [panel.id, close]);

  return <CurrentPanelContext.Provider value={current}>{panel.element}</CurrentPanelContext.Provider>;
}
