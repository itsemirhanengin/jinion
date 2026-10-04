import { atom, type Atom, type Getter, type PrimitiveAtom, type SetStateAction } from 'jotai/vanilla';
import type { SessionAtoms } from './session.js';

/**
 * The session the user looks at. What a client draws follows it through the atoms below, so switching sessions
 * redraws; a session's own controllers use its atoms instead, so one in the background never touches another.
 */
export const activeSessionAtom = atom<SessionAtoms | undefined>(undefined);

function active(get: Getter) {
  const atoms = get(activeSessionAtom);
  if (!atoms) throw new Error('No session is open.');

  return atoms;
}

const follow = <T>(pick: (atoms: SessionAtoms) => Atom<T>) => atom((get) => get(pick(active(get))));

const followWritable = <T>(pick: (atoms: SessionAtoms) => PrimitiveAtom<T>) =>
  atom(
    (get) => get(pick(active(get))),
    (get, set, update: SetStateAction<T>) => set(pick(active(get)), update),
  );

export const sessionAtom = follow((atoms) => atoms.state);

export const entriesAtom = follow((atoms) => atoms.entries);

export const todosAtom = follow((atoms) => atoms.todos);

export const worktreeAtom = follow((atoms) => atoms.worktree);

export const busySinceAtom = follow((atoms) => atoms.busySince);

export const busyAtom = follow((atoms) => atoms.busy);

export const editTurnsAtom = follow((atoms) => atoms.editTurns);

export const workingAtom = follow((atoms) => atoms.working);

export const draftAtom = followWritable((atoms) => atoms.draft);

export const queueAtom = follow((atoms) => atoms.queue);

export const selectionAtom = follow((atoms) => atoms.selection);

export const modelNameAtom = follow((atoms) => atoms.modelName);

export const modelLabelAtom = follow((atoms) => atoms.modelLabel);

export const modeAtom = follow((atoms) => atoms.mode);

export const tasksAtom = follow((atoms) => atoms.tasks);

export const backgroundTasksAtom = follow((atoms) => atoms.backgroundTasks);

export const waitsOnForegroundTaskAtom = follow((atoms) => atoms.waitsOnForegroundTask);
