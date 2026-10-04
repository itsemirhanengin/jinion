import { atom } from 'jotai/vanilla';

export const draftAtom = atom('');

export const historyAtom = atom<string[]>([]);

export const queueAtom = atom<string[]>([]);
