import { atom } from 'jotai';

/**
 * The empty conversation the core keeps open once the last thread closes, since it always has one: the window shows no
 * tab or row for it, and the next new thread is it. In each project's store.
 */
export const spareThreadAtom = atom<string | undefined>(undefined);

/** The last thread is closing, so the conversation the core opens in its place is the spare. */
export const closingLastAtom = atom(false);
