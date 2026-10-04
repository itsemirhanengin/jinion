import { useRef, useState } from 'react';
import { useApp, usePanels, useTerminal, useView } from '@jinion/tui';
import type { Screen } from '@jinion/core/controllers/context';
import { DialogView } from './dialogs.js';
import { viewPanel } from './views.js';

/** Created once, so controllers can hold it, and reading the TUI as it is now on every call. */
export function useScreen(): Screen {
  const tui = { panels: usePanels(), terminal: useTerminal(), view: useView(), app: useApp() };
  const latest = useRef(tui);

  latest.current = tui;

  const [screen] = useState<Screen>(() => ({
    openView: (view) => latest.current.panels.open(viewPanel(view)),
    showDialog: (dialog) =>
      latest.current.panels.open({ id: dialog.id, placement: 'bottom', element: <DialogView dialog={dialog} /> }),
    closeDialog: (id) => latest.current.panels.close(id),
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
