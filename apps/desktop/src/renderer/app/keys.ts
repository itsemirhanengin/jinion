import type { AgentMode } from '@jinion/core/agent/agent';
import { nextMode } from '@jinion/core/agent/modes';
import { useSetAtom, useStore } from 'jotai';
import { useEffect } from 'react';
import { panelAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { useJinion } from '../state/session.js';

const MODES: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];

/**
 * The window's shortcuts: ⌘N a new thread, ⌘W closes the tab, ⌘1-9 go to a tab, ⌘B the sidebar, ⌘⌥B the side panel,
 * ⌘L the composer, ⇧Tab the next mode, Esc stops the turn.
 */
export function useShortcuts() {
  const jinion = useJinion();
  const store = useStore();
  const setView = useSetAtom(viewAtom);
  const setSidebar = useSetAtom(sidebarAtom);
  const setPanel = useSetAtom(panelAtom);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const { sessions, active } = store.get(jinion.sessionsAtom);
      const command = event.metaKey || event.ctrlKey;

      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (command && event.key === 'n') {
        handled();
        jinion.open();
        setView('thread');
      } else if (command && event.key === 'w') {
        handled();
        if (active) jinion.close(active);
      } else if (command && /^[1-9]$/.test(event.key)) {
        const tab = sessions[Number(event.key) - 1];

        handled();
        if (tab) jinion.activate(tab.id);
        setView('thread');
      } else if (command && event.altKey && event.code === 'KeyB') {
        handled();
        setPanel((panel) => ({ ...panel, open: !panel.open }));
      } else if (command && event.key === 'b') {
        handled();
        setSidebar((open) => !open);
      } else if (command && event.key === 'l') {
        handled();
        setView('thread');
        requestAnimationFrame(() => document.querySelector('textarea')?.focus());
      } else if (event.shiftKey && event.key === 'Tab' && active) {
        handled();

        const { fields } = store.get(jinion.session(active));

        jinion.setMode(active, nextMode(MODES, fields.mode));
      } else if (event.key === 'Escape' && active && store.get(jinion.session(active)).fields.working) {
        handled();
        jinion.interrupt(active);
      }
    };

    addEventListener('keydown', keyDown, true);

    return () => removeEventListener('keydown', keyDown, true);
  }, [jinion]);
}
