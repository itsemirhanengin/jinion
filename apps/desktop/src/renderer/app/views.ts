import type { View } from '@jinion/core/api/protocol';
import type { Workbench } from '@jinion/workbench';
import { useAtom, useAtomValue, useStore } from 'jotai';
import { useEffect } from 'react';
import type { Core } from '../core/core.js';
import { GIT_TAB } from '../features/git/git.js';
import { draftsAtom } from '../state/app.js';

/** The composer opens these itself, from its own menus. */
const IN_THE_COMPOSER = new Set<View['id']>(['mode', 'model', 'context']);

/** What a slash command asked to show, in the place the window has for it. */
export function useViews(core: Core, workbench: Workbench) {
  const store = useStore();
  const [asked, setAsked] = useAtom(core.viewAtom);
  const shown = useAtomValue(core.client.shownAtom);

  useEffect(() => {
    if (!asked || IN_THE_COMPOSER.has(asked.view.id)) return;

    setAsked(undefined);
    show(asked.view);
  }, [asked]);

  const show = (view: View) => {
    switch (view.id) {
      case 'account':
      case 'usage':
        return workbench.open({ kind: 'page', id: 'profile' });

      case 'memory':
        return workbench.open({ kind: 'page', id: 'memory' });

      case 'diff':
        return workbench.open(GIT_TAB);

      case 'tasks':
        return workbench.showView('bottom', 'tasks');

      case 'resume':
        if (workbench.getLayout().activity !== 'threads') workbench.activate('threads');

        return;

      // The list of commands is the composer's, so help is a `/` in it.
      case 'help':
        if (shown) store.set(draftsAtom, (drafts) => ({ ...drafts, [shown]: '/' }));
        document.querySelector<HTMLTextAreaElement>('textarea[name="message"]')?.focus();

        return;

      case 'rewind':
        return say('Hover over a message and press its rewind button to go back to before it.');

      case 'mcp':
        return say('MCP servers have no page in the desktop app yet. Turn them on or off with /mcp in the terminal app.');

      default:
        return say(`/${view.id} is only in the terminal app.`);
    }
  };

  const say = (text: string) => shown && core.act(core.notice(shown, text));
}
