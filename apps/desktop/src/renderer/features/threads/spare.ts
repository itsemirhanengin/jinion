import type { Workbench } from '@jinion/workbench';
import type { Core } from '../../core/core.js';
import { closingLastAtom, spareThreadAtom } from '../../state/threads.js';
import { threadGroup } from '../beside.js';

/** Closes the thread's session; the last one leaves the window without a thread rather than with a new one. */
export async function closeThread(core: Core, id: string) {
  const { store } = core.client;
  const spare = store.get(spareThreadAtom);
  const others = store.get(core.sessionsAtom).sessions.filter((session) => session.id !== id && session.id !== spare);

  // With a spare, the core shows it in this one's place, and opens nothing.
  if (others.length > 0 || spare) return core.close(id);

  // An empty thread is already what the core would open in its place.
  if (store.get(core.session(id))?.state.entries.length === 0) return store.set(spareThreadAtom, id);

  store.set(closingLastAtom, true);

  const { closed } = await core.close(id);

  if (!closed) store.set(closingLastAtom, false);
}

/** A new thread, the spare when there is one, so empty conversations don't pile up behind the window; its session. */
export async function newThread(core: Core, workbench: Workbench) {
  const { store } = core.client;
  const spare = store.get(spareThreadAtom);
  if (!spare) return core.open();

  store.set(spareThreadAtom, undefined);
  workbench.open({ kind: 'thread', id: spare }, { group: threadGroup(workbench) });
  await core.activate(spare);

  return spare;
}
