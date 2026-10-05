import { changedFiles, editTurns } from '@jinion/core/conversation/edits';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import type { Status } from '@jinion/ui';
import { atom, useAtomValue } from 'jotai';
import type { MockJinion } from '../mock/jinion.js';
import { jinionAtom } from './app.js';

/** Inside the project's window, where a core is always open. */
export function useJinion() {
  return useAtomValue(jinionAtom)!;
}

const none = atom(undefined);

/** The thread in the active tab, or `undefined` while none is open. */
export function useActiveSession() {
  const jinion = useJinion();
  const { active } = useAtomValue(jinion.sessionsAtom);
  const snapshot = useAtomValue(active ? jinion.session(active) : none);

  return active && snapshot ? { id: active, ...snapshot } : undefined;
}

export function useSession(jinion: MockJinion, id: string) {
  return useAtomValue(jinion.session(id));
}

export function statusOf({ state, fields }: SessionSnapshot): Status | undefined {
  if (fields.dialog) return 'waiting';
  if (fields.working) return 'working';

  const last = state.entries.findLast((entry) => entry.kind !== 'text' && entry.kind !== 'thinking');

  if (last?.kind === 'notice' && last.tone === 'error') return 'failed';
  if (state.entries.some((entry) => entry.kind === 'user')) return 'done';

  return undefined;
}

/** Every file the thread changed, with the lines, from the agent's own edits. */
export function changesOf({ state }: SessionSnapshot) {
  return changedFiles(editTurns(state.entries).reverse().flatMap((turn) => turn.edits));
}
