import { useRef, useState } from 'react';
import { useApp, usePanels, useTerminal, useView } from '@jinion/tui';
import type { Store } from 'jotai/vanilla';
import type { ScreenHandlers } from '@jinion/core/api/client';
import { draftsAtom, fillDraft } from '../prompt/draft.js';
import { viewPanel } from './views.js';

/** What the core asks of the screen, made once and reading the TUI as it is now on every call. */
export function useScreen(store: () => Store): ScreenHandlers {
  const tui = { panels: usePanels(), terminal: useTerminal(), view: useView(), app: useApp() };
  const latest = useRef(tui);

  latest.current = tui;

  const [screen] = useState<ScreenHandlers>(() => ({
    view: (view) => latest.current.panels.open(viewPanel(view)),
    fillPrompt: (session, text, fill) => store().set(draftsAtom, (drafts) => fillDraft(drafts, session, text, fill)),
    notify: (title, body) => latest.current.terminal.notify(title, body),
    expand: () => latest.current.view.toggleExpanded(),
    exit: () => latest.current.app.exit(),
  }));

  return screen;
}

/** Opens a view the way the core's commands do, for what the app opens itself, such as `ctrl+t`. */
export function useOpenView() {
  const panels = usePanels();

  return (view: Parameters<ScreenHandlers['view']>[0]) => panels.open(viewPanel(view));
}
