import { atom } from 'jotai';

export const draftAtom = atom('');

export const historyAtom = atom<string[]>([]);

export const queueAtom = atom<string[]>([]);
