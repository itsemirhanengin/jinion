import { atom } from 'jotai';
import { busyAtom } from './session.js';

/** Set from the moment a turn starts, before the render that shows it, until it ends. */
export const turnAbortAtom = atom<AbortController | undefined>(undefined);

export const workingAtom = atom((get) => get(busyAtom) || get(turnAbortAtom) !== undefined);
