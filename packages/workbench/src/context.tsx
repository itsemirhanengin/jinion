import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Layout } from './layout.js';
import type { Workbench } from './workbench.js';

export const WorkbenchContext = createContext<Workbench | undefined>(undefined);

export const TabContext = createContext<string | undefined>(undefined);

export function useWorkbench() {
  const workbench = useContext(WorkbenchContext);
  if (!workbench) throw new Error('useWorkbench is used outside a WorkbenchView.');

  return workbench;
}

/** A part of the layout; the component redraws only when that part changes. */
export function useLayout<T>(select: (layout: Layout) => T) {
  const workbench = useWorkbench();

  return useSyncExternalStore(workbench.subscribe, () => select(workbench.getLayout()));
}

/** Inside a tab's content: its key, and `pin` to keep a preview once the user works in it. */
export function useTab() {
  const workbench = useWorkbench();
  const key = useContext(TabContext);
  if (!key) throw new Error('useTab is used outside a tab.');

  return { key, pin: () => workbench.pin(key) };
}
