import { atom } from 'jotai';
import type { Groups } from '../features/terminal/groups.js';

/** The split groups the user made, read against the terminals there are; in each project's store, so threads share them. */
export const terminalGroupsAtom = atom<Groups>([]);

/** The terminal that takes the keys, whose group shows. */
export const focusedTerminalAtom = atom<string | undefined>(undefined);
