import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { useCore } from '../../state/session.js';

const EVERY = 4000;

/** The uncommitted changes in the shown thread's folder, read again while in sight and when the window comes back. */
export function useGit() {
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const repos = useAtomValue(core.gitAtom);

  useEffect(() => {
    if (!shown) return;

    const read = () => void core.refreshGit(shown).catch(() => {});
    const timer = setInterval(read, EVERY);

    read();
    addEventListener('focus', read);

    return () => {
      clearInterval(timer);
      removeEventListener('focus', read);
    };
  }, [core, shown]);

  return { shown, repos };
}
