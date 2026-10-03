import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Subscribable } from '../utils/subscribable.js';

interface View {
  expanded: boolean;
  toggleExpanded(): void;
  /** Kept here because items unmount out of view. Reading it doesn't redraw; `ViewItem` does that for its item. */
  items: ReadonlyMap<string, boolean>;
  setItem(id: string, expanded: boolean): void;
}

// Outside React, so an item opened on its own redraws only itself, not everything that reads the view.
class ViewState extends Subscribable {
  expanded = false;
  readonly items = new Map<string, boolean>();

  readonly toggleExpanded = () => {
    this.expanded = !this.expanded;
    this.items.clear();
    this.changed();
  };

  readonly setItem = (id: string, expanded: boolean) => {
    this.items.set(id, expanded);
    this.changed();
  };
}

const StateContext = createContext(new ViewState());
const ExpandedContext = createContext(false);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [state] = useState(() => new ViewState());
  const expanded = useSyncExternalStore(state.subscribe, () => state.expanded);
  return (
    <StateContext.Provider value={state}>
      <ExpandedContext.Provider value={expanded}>{children}</ExpandedContext.Provider>
    </StateContext.Provider>
  );
}

export function useView(): View {
  const state = useContext(StateContext);
  const expanded = useContext(ExpandedContext);
  return useMemo(
    () => ({ expanded, toggleExpanded: state.toggleExpanded, items: state.items, setItem: state.setItem }),
    [state, expanded],
  );
}

export function ViewItem({ id, children }: { id: string; children: ReactNode }) {
  const state = useContext(StateContext);
  const inherited = useContext(ExpandedContext);
  const own = useSyncExternalStore(state.subscribe, () => state.items.get(id));
  return <ExpandedContext.Provider value={own ?? inherited}>{children}</ExpandedContext.Provider>;
}
