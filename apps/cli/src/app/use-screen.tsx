import { useRef, useState } from 'react';
import { useApp, usePanels, useTerminal, useView } from '@jinion/tui';
import type { Screen } from '../controllers/context.js';
import { DialogView } from './dialogs.js';

/** Created once, so controllers can hold it, and reading the TUI as it is now on every call. */
export function useScreen(): Screen {
  const tui = { panels: usePanels(), terminal: useTerminal(), view: useView(), app: useApp() };
  const latest = useRef(tui);

  latest.current = tui;

  const [screen] = useState<Screen>(() => ({
    openPanel: (panel) => latest.current.panels.open(panel),
    closePanel: (id) => latest.current.panels.close(id),
    topPanel: () => latest.current.panels.top?.id,
    showDialog: (dialog) =>
      latest.current.panels.open({ id: dialog.id, placement: 'bottom', element: <DialogView dialog={dialog} /> }),
    focused: () => latest.current.terminal.focused(),
    notify: (title, body) => latest.current.terminal.notify(title, body),
    get notificationMethod() {
      return latest.current.terminal.method;
    },
    toggleExpanded: () => latest.current.view.toggleExpanded(),
    exit: () => latest.current.app.exit(),
  }));

  return screen;
}
