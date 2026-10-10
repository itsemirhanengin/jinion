import { atom } from 'jotai';

/** Whether the title bar's search is open; in the app's store, so ⌘K and Code's `+` open it from anywhere. */
export const quickOpenAtom = atom(false);
