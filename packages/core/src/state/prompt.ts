import { atom } from 'jotai/vanilla';

/** What was sent, in every session, for `up` to bring back. */
export const historyAtom = atom<string[]>([]);
