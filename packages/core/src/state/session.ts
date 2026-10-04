import { atom } from 'jotai/vanilla';
import { atomWithLazy } from 'jotai/vanilla/utils';
import { editTurns } from '../conversation/edits.js';
import { reduce, type Action } from '../conversation/reducer.js';
import { createSessionState } from '../conversation/session.js';

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export const sessionAtom = atomWithLazy(() => createSessionState(DEFAULT_CONTEXT_WINDOW));

export const worktreeAtom = atom((get) => get(sessionAtom).worktree);

export const dispatchAtom = atom(null, (get, set, action: Action) => set(sessionAtom, reduce(get(sessionAtom), action)));

export const entriesAtom = atom((get) => get(sessionAtom).entries);

export const todosAtom = atom((get) => get(sessionAtom).todos);

export const busySinceAtom = atom((get) => get(sessionAtom).busySince);

export const busyAtom = atom((get) => get(busySinceAtom) !== undefined);

export const editTurnsAtom = atom((get) => editTurns(get(entriesAtom)));
