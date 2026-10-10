import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { atom, useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { statusOf, useCore } from '../../state/session.js';
import { spareThreadAtom } from '../../state/threads.js';

/** The project's open threads with their sessions, the spare left out. */
export function useOpenSessions() {
  const core = useCore();
  const spare = useAtomValue(spareThreadAtom);
  const { sessions } = useAtomValue(core.sessionsAtom);

  const ids = sessions.map((session) => session.id).join();
  const snapshots = useMemo(() => atom((get) => sessions.map((session) => get(core.session(session.id)) as SessionSnapshot | undefined)), [core, ids]);
  const open = useAtomValue(snapshots);

  return sessions.flatMap((session, index) => {
    const snapshot = open[index];

    return snapshot && session.id !== spare ? [{ id: session.id, snapshot, status: statusOf(snapshot) }] : [];
  });
}

/** The project's open threads that work or wait on the user. */
export function useActiveThreads() {
  return useOpenSessions().filter((thread) => thread.status === 'working' || thread.status === 'waiting');
}
