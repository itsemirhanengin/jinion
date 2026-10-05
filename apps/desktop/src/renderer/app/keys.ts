import { nextMode } from '@jinion/core/agent/modes';
import { useSetAtom, useStore } from 'jotai';
import { useEffect } from 'react';
import { panelAtom, sidebarAtom, viewAtom } from '../state/app.js';
import { useCore } from '../state/session.js';

/**
 * The window's shortcuts: ⌘N a new thread, ⌘W closes the tab, ⌘1-9 go to a tab, ⌘B the sidebar, ⌘⌥B the side panel,
 * ⌘L the composer, ⇧Tab the next mode, Esc stops the turn.
 */
export function useShortcuts() {
  const core = useCore();
  const store = useStore();
  const setView = useSetAtom(viewAtom);
  const setSidebar = useSetAtom(sidebarAtom);
  const setPanel = useSetAtom(panelAtom);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const { sessions } = store.get(core.sessionsAtom);
      const shown = store.get(core.client.shownAtom);
      const snapshot = shown ? store.get(core.session(shown)) : undefined;
      const command = event.metaKey || event.ctrlKey;

      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (command && event.key === 'n') {
        handled();
        void core.open();
        setView('thread');
      } else if (command && event.key === 'w') {
        handled();
        if (shown) void core.close(shown);
      } else if (command && /^[1-9]$/.test(event.key)) {
        const tab = sessions[Number(event.key) - 1];

        handled();
        if (tab) void core.activate(tab.id);
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
      } else if (event.shiftKey && event.key === 'Tab' && shown && snapshot) {
        const modes = store.get(core.appAtom)?.agents.find((agent) => agent.name === snapshot.fields.agent)?.modes ?? [];

        handled();
        if (modes.length > 0) void core.setMode(shown, nextMode(modes, snapshot.fields.mode));
      } else if (event.key === 'Escape' && shown && snapshot?.fields.working) {
        handled();
        void core.interrupt(shown);
      }
    };

    addEventListener('keydown', keyDown, true);

    return () => removeEventListener('keydown', keyDown, true);
  }, [core]);
}
