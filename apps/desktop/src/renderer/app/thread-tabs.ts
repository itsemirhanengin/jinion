import { activeTab, keyOf, type Workbench } from '@jinion/workbench';
import { useEffect } from 'react';
import type { Core } from '../core/core.js';
import { PREVIEW } from '../features/preview/previews.js';

/**
 * Keeps the thread tabs and the core's open sessions as one: a session that opens gets a tab, a tab whose session closed
 * goes, the session the core shows is the tab shown, and a thread tab picked is the session the core shows.
 */
export function useThreadTabs(core: Core, workbench: Workbench) {
  useEffect(() => {
    const { store } = core.client;
    let known = new Set(threadTabs(workbench));

    const sync = () => {
      const open = new Set(store.get(core.sessionsAtom).sessions.map((session) => session.id));

      for (const id of open) if (!known.has(id)) workbench.open({ kind: 'thread', id }, { group: threadGroup(workbench) });
      for (const id of threadTabs(workbench)) if (!open.has(id)) workbench.remove(keyOf({ kind: 'thread', id }));
      known = open;
    };

    const show = () => {
      const shown = store.get(core.client.shownAtom);
      const tab = activeTab(workbench.getLayout());

      if (shown && known.has(shown) && !(tab?.kind === 'thread' && tab.id === shown)) workbench.open({ kind: 'thread', id: shown });
    };

    const follow = () => {
      const tab = activeTab(workbench.getLayout());

      if (tab?.kind === 'thread' && tab.id !== store.get(core.client.shownAtom)) core.act(core.activate(tab.id));
    };

    sync();
    show();

    const stops = [store.sub(core.sessionsAtom, sync), store.sub(core.client.shownAtom, show), workbench.subscribe(follow)];

    return () => {
      for (const stop of stops) stop();
    };
  }, [core, workbench]);
}

/** With the other threads, or in a group without previews, so threads coming back don't land among the pages. */
function threadGroup(workbench: Workbench) {
  const { groups } = workbench.getLayout();
  const threads = groups.findIndex((group) => group.tabs.some((tab) => tab.kind === 'thread'));
  const free = groups.findIndex((group) => !group.tabs.some((tab) => tab.kind === PREVIEW));

  return threads !== -1 ? threads : free !== -1 ? free : undefined;
}

function threadTabs(workbench: Workbench) {
  return workbench.tabs().flatMap((tab) => (tab.kind === 'thread' ? [tab.id] : []));
}
