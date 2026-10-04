import { useRef, useState } from 'react';
import { useApp, usePanels, useTerminal, useView } from '@jinion/tui';
import type { Screen } from '@jinion/core/controllers/context';
import { viewPanel } from './views.js';

/** Created once, so controllers can hold it, and reading the TUI as it is now on every call. */
export function useScreen(): Screen {
  const tui = { panels: usePanels(), terminal: useTerminal(), view: useView(), app: useApp() };
  const latest = useRef(tui);

  latest.current = tui;

  const [screen] = useState<Screen>(() => ({
    openView: (view) => latest.current.panels.open(viewPanel(view)),
    focused: () => latest.current.terminal.focused(),
    notify: (title, body) => latest.current.terminal.notify(title, body),
    get notifications() {
      return latest.current.terminal.method === 'bell' ? 'bell' : 'desktop';
    },
    toggleExpanded: () => latest.current.view.toggleExpanded(),
    exit: () => latest.current.app.exit(),
  }));

  return screen;
}
