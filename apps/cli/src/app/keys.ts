import { draftAtom, busyAtom } from '@jinion/core/state/active';
import { useRef } from 'react';
import { useInput, usePanels, useSelection } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { useJinion } from './context.js';

const DOUBLE_ESCAPE_MS = 600;

/** Open panels handle their own esc. */
export function useKeys() {
  const jinion = useJinion();
  const panels = usePanels();
  const selection = useSelection();
  const busy = useAtomValue(busyAtom);
  const draft = useAtomValue(draftAtom);

  const lastEscape = useRef(0);

  const free = !panels.top;

  useInput((input, key) => {
    if (key.ctrl && input === 'o') return jinion.screen.toggleExpanded();
    if (key.ctrl && input === 't' && free) return jinion.screen.openView({ id: 'tasks' });
    if (key.ctrl && input === 'b' && busy && free) return jinion.session.tasks.sendToBackground();
    if (key.ctrl && input === 'g' && free) return jinion.session.worktrees.toggle();
    if (key.tab && key.shift && free && jinion.backend.modes.length > 1) return jinion.session.modes.cycle();
    if (key.escape && busy && free) return jinion.session.turns.interrupt();

    if (key.escape && !busy && free) {
      const now = Date.now();

      if (now - lastEscape.current >= DOUBLE_ESCAPE_MS) {
        lastEscape.current = now;

        return;
      }

      lastEscape.current = 0;

      return draft ? jinion.session.input.clear() : jinion.session.conversation.openRewind();
    }

    if (key.ctrl && input === 'q' && free) return jinion.session.input.queue();

    if (key.ctrl && input === 'c') {
      // With text selected, as in Claude Code, ctrl+c copies it rather than stopping anything.
      if (selection.copy()) return;
      if (busy) return jinion.session.turns.interrupt();
      if (panels.top) return panels.close();
      if (draft) return jinion.session.input.fill('');

      return jinion.quit();
    }
  });
}
