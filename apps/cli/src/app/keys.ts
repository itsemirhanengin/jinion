import { useRef } from 'react';
import { useInput, usePanels, useSelection, useView } from '@jinion/tui';
import { useAtom, useAtomValue } from 'jotai';
import { nextMode } from '@jinion/core/agent/modes';
import { draftAtom } from '../prompt/draft.js';
import { usePrompt } from '../prompt/use-prompt.js';
import { agentAtom, busyAtom, dialogAtom, modeAtom, tabsAtom, worktreesAtom } from '../state/session.js';
import { useApi } from './api.js';
import { useOpenView } from './use-screen.js';

const DOUBLE_ESCAPE_MS = 600;

/** Open panels handle their own esc. */
export function useKeys() {
  const api = useApi();
  const panels = usePanels();
  const selection = useSelection();
  const view = useView();
  const openView = useOpenView();
  const prompt = usePrompt();
  const busy = useAtomValue(busyAtom);
  const mode = useAtomValue(modeAtom);
  const worktrees = useAtomValue(worktreesAtom);
  const dialog = useAtomValue(dialogAtom);
  const tabs = useAtomValue(tabsAtom);
  const { modes } = useAtomValue(agentAtom);
  const [draft, setDraft] = useAtom(draftAtom);

  const lastEscape = useRef(0);

  const free = !panels.top;
  // A dialog stays with its tab, so going to another one while it waits is fine; a picker would act on the wrong one.
  const tabsFree = free || (dialog !== undefined && panels.top?.id === dialog.id);
  const interrupt = () => api.act(api.inSession('session/interrupt', {}));

  useInput((input, key) => {
    if (key.ctrl && input === 'n' && tabsFree) return api.act(api.request('sessions/open', { activate: true }));

    if (key.meta && /^[1-9]$/.test(input) && tabsFree) {
      const tab = tabs[Number(input) - 1];

      return tab && api.act(api.request('sessions/activate', { session: tab.id }));
    }

    if (key.ctrl && input === 'o') return view.toggleExpanded();
    if (key.ctrl && input === 't' && free) return openView({ id: 'tasks' });
    if (key.ctrl && input === 'b' && busy && free) return api.act(api.inSession('session/background', {}));
    if (key.ctrl && input === 'g' && free) return api.act(api.inSession('session/worktree', { on: !worktrees }));
    if (key.tab && key.shift && free && modes.length > 1) return api.act(api.inSession('session/mode', { mode: nextMode(modes, mode) }));
    if (key.escape && busy && free) return interrupt();

    if (key.escape && !busy && free) {
      const now = Date.now();

      if (now - lastEscape.current >= DOUBLE_ESCAPE_MS) {
        lastEscape.current = now;

        return;
      }

      lastEscape.current = 0;

      return draft ? prompt.clear() : api.act(api.inSession('session/open-rewind', {}));
    }

    if (key.ctrl && input === 'q' && free) return prompt.queue();

    if (key.ctrl && input === 'c') {
      // With text selected, as in Claude Code, ctrl+c copies it rather than stopping anything.
      if (selection.copy()) return;
      if (busy) return interrupt();
      if (panels.top) return panels.close();
      if (draft) return setDraft('');

      return api.quit();
    }
  });
}
