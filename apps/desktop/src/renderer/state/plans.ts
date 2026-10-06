import { atom } from 'jotai';

/** Each plan as the user changed it, by the plan's entry, until it is answered or the changes are dropped; in each project's store. */
export const planEditsAtom = atom<Record<string, string>>({});
