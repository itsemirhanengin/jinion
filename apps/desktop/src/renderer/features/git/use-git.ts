import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import type { Core } from '../../core/core.js';
import { useCore } from '../../state/session.js';

const EVERY = 4000;

/** Each project's one reading of git, shared by whatever shows it, and how many do. */
const pollers = new WeakMap<Core, { users: number; stop: () => void }>();

/**
 * The uncommitted changes in the shown thread's folder, read again while something shows them and when the window comes
 * back; one reading for the whole project, and never a second while one is still out, however large the folder.
 */
export function useGit() {
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const repos = useAtomValue(core.gitAtom);

  useEffect(() => {
    const poller = pollers.get(core) ?? { users: 0, stop: () => {} };

    if (poller.users === 0) poller.stop = poll(core);
    poller.users++;
    pollers.set(core, poller);

    return () => {
      poller.users--;
      if (poller.users === 0) poller.stop();
    };
  }, [core]);

  return { shown, repos };
}

function poll(core: Core) {
  const { store } = core.client;
  let reading = false;

  const read = () => {
    const shown = store.get(core.client.shownAtom);
    if (!shown || reading) return;

    reading = true;

    void core
      .refreshGit(shown)
      .catch(() => {})
      .finally(() => {
        reading = false;
      });
  };

  const timer = setInterval(read, EVERY);
  const unsubscribe = store.sub(core.client.shownAtom, read);

  read();
  addEventListener('focus', read);

  return () => {
    clearInterval(timer);
    unsubscribe();
    removeEventListener('focus', read);
  };
}
