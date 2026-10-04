import { atom, type SetStateAction } from 'jotai';
import type { PromptFill } from '@jinion/core/api/protocol';
import { shownAtom } from '../state/session.js';

/** Each session's draft. It is the client's: the core only puts text in it, e.g. the message a rewind went back to. */
export const draftsAtom = atom<Record<string, string>>({});

/** The draft of the session the user looks at. */
export const draftAtom = atom(
  (get) => get(draftsAtom)[get(shownAtom).id] ?? '',
  (get, set, update: SetStateAction<string>) => {
    const session = get(shownAtom).id;

    set(draftsAtom, (drafts) => ({ ...drafts, [session]: typeof update === 'function' ? update(drafts[session] ?? '') : update }));
  },
);

/** What was sent, in every session, for `up` to bring back. */
export const historyAtom = atom<string[]>([]);

export function fillDraft(drafts: Record<string, string>, session: string, text: string, fill: PromptFill) {
  const draft = fill === 'replace' ? text : [text, drafts[session]].filter(Boolean).join('\n');

  return { ...drafts, [session]: draft };
}
