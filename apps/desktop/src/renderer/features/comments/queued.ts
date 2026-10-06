import type { useStore } from 'jotai';
import type { Submission } from '../../core/core.js';
import { type QueuedComments, queuedCommentsAtom } from '../../state/comments.js';

type Store = ReturnType<typeof useStore>;

/** Keeps the comments a queued message carries, forgetting those of the messages no longer in the queue. */
export function rememberQueued(store: Store, session: string, queue: Submission[], entry: QueuedComments) {
  if (entry.comments.length === 0) return;

  store.set(queuedCommentsAtom, (all) => ({
    ...all,
    [session]: [...(all[session] ?? []).filter((each) => queue.some((message) => message.text === each.text)), entry],
  }));
}

/** What went with a queued message, taken back with it. */
export function takeQueued(store: Store, session: string, text: string) {
  const entry = store.get(queuedCommentsAtom)[session]?.find((each) => each.text === text);

  if (entry) store.set(queuedCommentsAtom, (all) => ({ ...all, [session]: (all[session] ?? []).filter((each) => each !== entry) }));

  return entry;
}
