import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { changedFiles, editTurns } from '@jinion/core/conversation/edits';
import type { Status } from '@jinion/ui';
import { atom, useAtomValue } from 'jotai';
import type { Core } from '../core/core.js';
import { appStore, coreAtom } from './app.js';

/** Inside a project's window, where its core is always open. */
export function useCore() {
  return useAtomValue(coreAtom, { store: appStore }) as Core;
}

const none = atom(undefined);

/** The thread in the active tab once the client holds it, or `undefined` while none is. */
export function useActiveSession() {
  const core = useCore();
  const shown = useAtomValue(core.client.shownAtom);
  const snapshot = useAtomValue(shown ? core.session(shown) : none);

  return shown && snapshot ? { id: shown, ...snapshot } : undefined;
}

export function useSession(core: Core, id: string) {
  return useAtomValue(core.session(id));
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
